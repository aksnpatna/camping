"""
Abuse protection and request hardening for the public API.

Layers (outermost first):
  SecurityHeadersMiddleware -> RateLimitMiddleware -> BodySizeLimitMiddleware
  -> CORS -> routes (per-route ``rate_limit`` dependencies, ``require_admin``)

Design notes
* Limits are keyed on the *resolved* client IP. We only believe
  ``CF-Connecting-IP`` / ``X-Forwarded-For`` when the TCP peer is one of our own
  trusted proxies, so an attacker cannot rotate headers to dodge a limit.
* State is in-process (sliding window). Run a single API worker per container
  (see backend Dockerfile) so the limits are exact, and keep Cloudflare rules in
  front as the outer, network-wide layer.
* Every per-key structure is bounded so a flood of unique IPs cannot exhaust
  memory.
"""
import hmac
import ipaddress
import json
import math
import threading
import time
from collections import deque
from functools import lru_cache
from typing import Callable, Deque, Dict, List, Mapping, Optional, Tuple

from fastapi import Header, HTTPException, Request

from app.core.config import settings

MAX_TRACKED_KEYS = 100_000
RATE_LIMIT_EXEMPT_PATHS = {"/api/v1/health"}
NO_STORE_PREFIXES = (
    "/api/v1/saved-trips",
    "/api/v1/auth",
    "/api/v1/analytics",
    "/api/v1/trips/rooms",
)


# --------------------------------------------------------------------------- #
# Client IP resolution
# --------------------------------------------------------------------------- #
@lru_cache(maxsize=8)
def _trusted_networks(cidrs: str) -> Tuple[ipaddress._BaseNetwork, ...]:
    nets = []
    for part in cidrs.split(","):
        part = part.strip()
        if part:
            nets.append(ipaddress.ip_network(part, strict=False))
    return tuple(nets)


def _parse_ip(value: Optional[str]) -> Optional[ipaddress._BaseAddress]:
    if not value:
        return None
    try:
        return ipaddress.ip_address(value.strip())
    except ValueError:
        return None


def _is_trusted(ip: Optional[ipaddress._BaseAddress]) -> bool:
    if ip is None:
        return False
    return any(ip in net for net in _trusted_networks(settings.TRUSTED_PROXY_CIDRS))


def resolve_client_ip(headers: Mapping[str, str], peer: Optional[str]) -> str:
    """
    Return the real client address.

    ``headers`` must have lower-cased keys. Forwarding headers are honoured only
    when ``peer`` is a trusted proxy.
    """
    peer_str = peer or "unknown"
    if not _is_trusted(_parse_ip(peer)):
        return peer_str

    cf = _parse_ip(headers.get("cf-connecting-ip"))
    if cf is not None:
        return str(cf)

    # Walk X-Forwarded-For from the right (closest hop first); the first address
    # that is not one of our own proxies is the real client. Entries further left
    # are client-supplied and therefore untrusted.
    xff = headers.get("x-forwarded-for", "")
    for part in reversed([p.strip() for p in xff.split(",") if p.strip()]):
        ip = _parse_ip(part)
        if ip is not None and not _is_trusted(ip):
            return str(ip)

    return peer_str


def client_ip(request: Request) -> str:
    peer = request.client.host if request.client else None
    return resolve_client_ip({k.lower(): v for k, v in request.headers.items()}, peer)


# --------------------------------------------------------------------------- #
# Sliding-window limiter with strikes and temporary bans
# --------------------------------------------------------------------------- #
class Limiter:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._hits: Dict[str, Tuple[Deque[float], int]] = {}
        self._bans: Dict[str, float] = {}
        self._strikes: Dict[str, Deque[float]] = {}

    def reset(self) -> None:
        with self._lock:
            self._hits.clear()
            self._bans.clear()
            self._strikes.clear()

    def hit(self, key: str, limit: int, window: int) -> Tuple[bool, int]:
        """Record an attempt. Returns (allowed, retry_after_seconds)."""
        now = time.monotonic()
        with self._lock:
            entry = self._hits.get(key)
            if entry is None:
                self._bound(self._hits)
                dq: Deque[float] = deque()
                self._hits[key] = (dq, window)
            else:
                dq = entry[0]
            while dq and now - dq[0] >= window:
                dq.popleft()
            if len(dq) >= limit:
                retry = max(1, math.ceil(window - (now - dq[0])))
                return False, retry
            dq.append(now)
            return True, 0

    def strike(self, ip: str) -> bool:
        """Count a rejection; ban the IP once it keeps hammering. True if banned."""
        now = time.monotonic()
        window = settings.BAN_STRIKE_WINDOW_SECONDS
        with self._lock:
            dq = self._strikes.get(ip)
            if dq is None:
                self._bound(self._strikes)
                dq = deque()
                self._strikes[ip] = dq
            while dq and now - dq[0] >= window:
                dq.popleft()
            dq.append(now)
            if len(dq) >= settings.BAN_STRIKE_THRESHOLD:
                self._bound(self._bans)
                self._bans[ip] = now + settings.BAN_DURATION_SECONDS
                dq.clear()
                return True
            return False

    def ban_remaining(self, ip: str) -> int:
        now = time.monotonic()
        with self._lock:
            until = self._bans.get(ip)
            if until is None:
                return 0
            if until <= now:
                del self._bans[ip]
                return 0
            return max(1, math.ceil(until - now))

    def is_banned(self, ip: str) -> bool:
        return self.ban_remaining(ip) > 0

    def _bound(self, store: dict) -> None:
        """Keep memory bounded under a flood of unique keys (caller holds lock)."""
        if len(store) < MAX_TRACKED_KEYS:
            return
        now = time.monotonic()
        if store is self._hits:
            for k in [k for k, (dq, w) in store.items() if not dq or now - dq[-1] >= w]:
                del store[k]
        elif store is self._bans:
            for k in [k for k, until in store.items() if until <= now]:
                del store[k]
        elif store is self._strikes:
            for k in [k for k, dq in store.items() if not dq or now - dq[-1] >= settings.BAN_STRIKE_WINDOW_SECONDS]:
                del store[k]
        # Still full: drop the oldest tenth (dicts preserve insertion order).
        if len(store) >= MAX_TRACKED_KEYS:
            for k in list(store.keys())[: MAX_TRACKED_KEYS // 10]:
                del store[k]


limiter = Limiter()


def _too_many(retry_after: int, detail: str = "Too many requests. Please slow down.") -> HTTPException:
    return HTTPException(status_code=429, detail=detail, headers={"Retry-After": str(retry_after)})


def rate_limit(name: str, limit: int, window: int) -> Callable[[Request], None]:
    """FastAPI dependency: ``limit`` calls per ``window`` seconds per client IP."""

    def _dependency(request: Request) -> None:
        if not settings.RATE_LIMIT_ENABLED:
            return
        allowed, retry = limiter.hit(f"{name}:{client_ip(request)}", limit, window)
        if not allowed:
            raise _too_many(retry)

    return _dependency


def check_key_rate_limit(name: str, key: str, limit: int, window: int) -> bool:
    """Non-IP limit (e.g. per target email). Returns True if the call may proceed."""
    if not settings.RATE_LIMIT_ENABLED:
        return True
    allowed, _ = limiter.hit(f"{name}:{key}", limit, window)
    return allowed


# --------------------------------------------------------------------------- #
# Admin authentication
# --------------------------------------------------------------------------- #
def require_admin(request: Request, x_admin_key: Optional[str] = Header(default=None)) -> None:
    """
    Owner-only gate. Key travels in the ``X-Admin-Key`` header (never the query
    string, which lands in access logs). Fails closed if ADMIN_KEY is unset.
    Repeated bad attempts are throttled to stop brute forcing.
    """
    ip = client_ip(request)

    if not x_admin_key:
        raise HTTPException(status_code=401, detail="Admin authentication required")

    expected = settings.ADMIN_KEY
    if expected and hmac.compare_digest(x_admin_key.encode(), expected.encode()):
        return

    if settings.RATE_LIMIT_ENABLED:
        allowed, retry = limiter.hit(f"admin-fail:{ip}", 10, 600)
        if not allowed:
            raise _too_many(retry, "Too many failed admin attempts.")
    raise HTTPException(status_code=403, detail="Invalid admin credentials")


# --------------------------------------------------------------------------- #
# ASGI middleware
# --------------------------------------------------------------------------- #
def _headers_dict(scope) -> Dict[str, str]:
    return {k.decode("latin-1").lower(): v.decode("latin-1") for k, v in scope.get("headers", [])}


def _scope_ip(scope) -> str:
    peer = scope["client"][0] if scope.get("client") else None
    return resolve_client_ip(_headers_dict(scope), peer)


async def _send_json(send, status: int, body: dict, extra_headers: Optional[List[Tuple[bytes, bytes]]] = None):
    payload = json.dumps(body).encode()
    headers = [(b"content-type", b"application/json"), (b"content-length", str(len(payload)).encode())]
    headers.extend(extra_headers or [])
    await send({"type": "http.response.start", "status": status, "headers": headers})
    await send({"type": "http.response.body", "body": payload})


class RateLimitMiddleware:
    """Per-IP flood control for every HTTP request, with escalating bans."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if (
            scope["type"] != "http"
            or not settings.RATE_LIMIT_ENABLED
            or scope["path"] in RATE_LIMIT_EXEMPT_PATHS
        ):
            await self.app(scope, receive, send)
            return

        ip = _scope_ip(scope)

        remaining = limiter.ban_remaining(ip)
        if remaining:
            await _send_json(
                send, 429, {"detail": "Too many requests. You are temporarily blocked."},
                [(b"retry-after", str(remaining).encode())],
            )
            return

        allowed, retry = limiter.hit(
            f"global:{ip}", settings.GLOBAL_RATE_LIMIT, settings.GLOBAL_RATE_WINDOW_SECONDS
        )
        if not allowed:
            if limiter.strike(ip):
                retry = settings.BAN_DURATION_SECONDS
            await _send_json(
                send, 429, {"detail": "Too many requests. Please slow down."},
                [(b"retry-after", str(retry).encode())],
            )
            return

        await self.app(scope, receive, send)


class _BodyTooLarge(Exception):
    pass


class BodySizeLimitMiddleware:
    """Reject oversized request bodies (declared or streamed) with 413."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        max_bytes = settings.MAX_BODY_BYTES
        declared = _headers_dict(scope).get("content-length")
        if declared is not None:
            try:
                if int(declared) > max_bytes:
                    await _send_json(send, 413, {"detail": "Request body too large"})
                    return
            except ValueError:
                await _send_json(send, 400, {"detail": "Invalid Content-Length"})
                return

        received = 0
        too_large = False

        async def limited_receive():
            nonlocal received, too_large
            message = await receive()
            if message["type"] == "http.request":
                received += len(message.get("body", b""))
                if received > max_bytes:
                    too_large = True
                    raise _BodyTooLarge()
            return message

        async def guarded_send(message):
            # FastAPI wraps body-read errors into a 400; surface the real 413.
            if too_large:
                if message["type"] == "http.response.start":
                    await _send_json(send, 413, {"detail": "Request body too large"})
                return
            await send(message)

        try:
            await self.app(scope, limited_receive, guarded_send)
        except _BodyTooLarge:
            if not too_large:
                raise


class SecurityHeadersMiddleware:
    """Adds baseline hardening headers to every API response."""

    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        path = scope["path"]

        async def send_with_headers(message):
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                present = {k.lower() for k, _ in headers}
                extra = [
                    (b"x-content-type-options", b"nosniff"),
                    (b"x-frame-options", b"DENY"),
                    (b"referrer-policy", b"no-referrer"),
                    (b"permissions-policy", b"geolocation=(), camera=(), microphone=()"),
                    (b"cross-origin-resource-policy", b"same-site"),
                ]
                if settings.is_production:
                    extra.append((b"strict-transport-security", b"max-age=31536000; includeSubDomains"))
                if path.startswith(NO_STORE_PREFIXES):
                    extra.append((b"cache-control", b"no-store"))
                headers.extend(h for h in extra if h[0] not in present)
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_with_headers)
