import logging
from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.security import check_key_rate_limit, client_ip, rate_limit
from app.crud import analytics as crud_analytics
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


@router.post(
    "/request-magic-link",
    response_model=MagicLinkResponse,
    dependencies=[Depends(rate_limit("magic-link", 5, 600))],
)
def request_magic_link(req: MagicLinkRequest, request: Request, db: Session = Depends(get_db)):
    email = req.email.strip().lower()

    # Per-address cap stops many different clients mail-bombing one victim. The
    # response stays identical so this never reveals whether the address exists.
    if not check_key_rate_limit("magic-link-email", email, 3, 3600):
        logger.warning("Magic link throttled for %s (per-address limit)", email)
        return MagicLinkResponse(email=email, message=DISPATCH_MESSAGE)

    # Capture lead for future communications
    client_ip_value = client_ip(request)

    crud_analytics.record_or_update_lead(
        db=db,
        email=email,
        source="magic_link",
        ip_address=client_ip_value,
        metadata={"action": "requested_dashboard_access"}
    )

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
