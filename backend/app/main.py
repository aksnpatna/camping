import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.core.config import settings
from app.core.security import (
    BodySizeLimitMiddleware,
    RateLimitMiddleware,
    SecurityHeadersMiddleware,
)
from app.services.email_service import warn_if_no_email_transport
from app.services.magic_link import assert_secret_key_safe

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail closed on a development secret in a production-like environment, and
    # make it unmistakable when outbound email cannot reach campers.
    assert_secret_key_safe()
    warn_if_no_email_transport("api")
    if settings.is_production and not settings.ADMIN_KEY:
        logger.warning("ADMIN_KEY is not set: analytics and admin endpoints are locked for everyone.")
    if not settings.RATE_LIMIT_ENABLED:
        logger.warning("RATE_LIMIT_ENABLED is off: the API has no flood protection.")
    yield


# Interactive docs enumerate every route; only expose them when asked for.
_docs_enabled = settings.ENABLE_DOCS or not settings.is_production

app = FastAPI(
    title="Camp Smart Australia API",
    description="Backend for the Camp Smart Answer-First Trip Finder",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if _docs_enabled else None,
    redoc_url="/redoc" if _docs_enabled else None,
    openapi_url="/openapi.json" if _docs_enabled else None,
)

# Added innermost -> outermost. Client IPs are resolved by app.core.security
# (trusted-proxy aware), so uvicorn's blanket ProxyHeadersMiddleware is not used.
app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.allowed_origins_list,
    # Auth is by URL token / header, never cookies, so credentials stay off.
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "X-Admin-Key"],
)
app.add_middleware(BodySizeLimitMiddleware)
app.add_middleware(RateLimitMiddleware)
app.add_middleware(SecurityHeadersMiddleware)

app.include_router(api_router, prefix="/api/v1")
