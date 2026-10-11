import logging
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.auth import MagicLinkRequest, MagicLinkResponse
from app.services.email_service import email_service
from app.services.magic_link import build_magic_link, issue_magic_token

logger = logging.getLogger(__name__)

router = APIRouter()

# Deliberately generic: the endpoint must not disclose whether an address is
# known, otherwise it becomes an account-enumeration oracle.
DISPATCH_MESSAGE = (
    "If that address has saved trips with Camp Smart, a secure sign-in link is on "
    "its way. The link expires shortly after it is sent."
)


@router.post("/request-magic-link", response_model=MagicLinkResponse)
def request_magic_link(req: MagicLinkRequest, db: Session = Depends(get_db)):
    email = req.email.strip().lower()

    token = issue_magic_token(db, email)
    magic_link = build_magic_link(email, token)

    status = email_service.send_magic_link(email, magic_link)
    if status != "SENT":
        logger.warning(
            "Magic link for %s was not delivered via SMTP (status=%s); the camper "
            "will not receive it until a real transport is configured.",
            email,
            status,
        )

    # The response intentionally carries neither the token nor the link.
    return MagicLinkResponse(email=email, message=DISPATCH_MESSAGE)
