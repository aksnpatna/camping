import hmac
import hashlib
from fastapi import APIRouter
from app.core.config import settings
from app.schemas.auth import MagicLinkRequest, MagicLinkResponse
from app.services.email_service import email_service

router = APIRouter()

def generate_magic_token(email: str) -> str:
    secret = (settings.SECRET_KEY or "dev-secret-key").encode()
    return hmac.new(secret, email.strip().lower().encode(), hashlib.sha256).hexdigest()

@router.post("/request-magic-link", response_model=MagicLinkResponse)
def request_magic_link(req: MagicLinkRequest):
    email = req.email.strip().lower()
    token = generate_magic_token(email)
    frontend_base = settings.FRONTEND_URL.rstrip("/")
    magic_link = f"{frontend_base}/?email={email}&token={token}"

    email_service.send_magic_link(email, magic_link)

    return MagicLinkResponse(
        email=email,
        token=token,
        magic_link=magic_link,
        message="Magic sign-in link dispatched successfully"
    )
