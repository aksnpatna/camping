import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging
from typing import List, Dict, Any, Optional
from app.core.config import settings

logger = logging.getLogger(__name__)

# Delivery outcomes. These are recorded verbatim on PlanBAlert.delivery_status,
# so they must never overstate what actually happened.
STATUS_SENT = "SENT"                      # accepted by the SMTP transport
STATUS_FAILED = "FAILED"                  # transport configured, send raised
STATUS_QUEUED_OUTBOX = "QUEUED_OUTBOX"    # dev/test outbox: recorded, NOT delivered
STATUS_DISABLED = "DISABLED"              # no transport configured: nothing left the process


class EmailService:
    def __init__(self):
        # In-memory outbox for testing, verification, and inspection.
        # Recording here is NOT delivery.
        self.outbox: List[Dict[str, Any]] = []

    @property
    def transport(self) -> str:
        return (settings.EMAIL_TRANSPORT or "none").strip().lower()

    @property
    def delivers_for_real(self) -> bool:
        return self.transport == "smtp" and bool(settings.SMTP_HOST)

    def send_magic_link(self, recipient_email: str, magic_url: str) -> str:
        subject = "Your Camp Smart Australia Access Link"
        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #071714; color: #ffffff; padding: 32px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(0, 255, 136, 0.2);">
          <div style="display: flex; align-items: center; margin-bottom: 24px;">
            <h1 style="color: #00ff88; font-size: 24px; margin: 0; font-weight: 900; letter-spacing: -0.5px;">CAMP SMART AU</h1>
          </div>
          <h2 style="color: #ffffff; font-size: 18px; margin-top: 0;">Sign in to your Trips Dashboard</h2>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.6;">Click the button below to securely access your planned camping trips, active Plan B condition alerts, and shared trip rooms:</p>
          <div style="margin: 28px 0;">
            <a href="{magic_url}" style="background: #00ff88; color: #071714; padding: 14px 28px; border-radius: 10px; font-weight: 800; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 14px rgba(0, 255, 136, 0.4);">
              Open My Trips Dashboard →
            </a>
          </div>
          <p style="color: #64748b; font-size: 12px; margin-top: 24px; line-height: 1.5; border-top: 1px solid rgba(255, 255, 255, 0.1); pt-4;">
            This magic link provides secure access to your saved trips. If you didn't request this link, you can safely ignore this email.
          </p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def send_plan_b_alert(
        self,
        recipient_email: str,
        trip_name: str,
        reason: str,
        switch_url: str,
        alternatives: List[Dict[str, Any]],
        unsubscribe_url: Optional[str] = None
    ) -> str:
        subject = f"⚠️ Plan B Alert: Important condition shift for {trip_name}"
        alts_items = ""
        for a in alternatives:
            name = a.get("name", "Alternative Campsite")
            state = a.get("state", "NSW")
            reason_text = a.get("reason", "Stable conditions matching your criteria")
            alts_items += f"""
            <li style="margin-bottom: 12px; background: rgba(255,255,255,0.05); padding: 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.1);">
              <strong style="color: #00ff88; font-size: 15px;">{name}</strong> <span style="background: rgba(0,255,136,0.1); color: #00ff88; font-size: 10px; padding: 2px 6px; border-radius: 4px; text-transform: uppercase;">{state}</span>
              <p style="color: #cbd5e1; font-size: 13px; margin: 6px 0 0 0;">{reason_text}</p>
            </li>
            """

        unsub_link = unsubscribe_url or f"{switch_url}&action=unsubscribe"

        html = f"""
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #071714; color: #ffffff; padding: 32px; border-radius: 16px; max-width: 600px; margin: 0 auto; border: 1px solid rgba(239, 68, 68, 0.4);">
          <div style="display: flex; align-items: center; margin-bottom: 20px;">
            <span style="background: #ef4444; color: #ffffff; font-size: 11px; font-weight: 800; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px;">Condition Shift Detected</span>
          </div>
          <h2 style="color: #ffffff; font-size: 20px; margin: 0 0 12px 0;">Your upcoming trip to {trip_name} needs attention</h2>
          <div style="background: rgba(239, 68, 68, 0.1); border-left: 4px solid #ef4444; padding: 14px; margin: 16px 0; border-radius: 0 8px 8px 0;">
            <p style="color: #fca5a5; font-size: 14px; margin: 0; line-height: 1.5; font-weight: 500;">{reason}</p>
          </div>
          <h3 style="color: #e2e8f0; font-size: 15px; margin: 24px 0 12px 0; text-transform: uppercase; letter-spacing: 0.5px;">Recommended Safe Alternatives:</h3>
          <ul style="list-style: none; padding: 0; margin: 0;">
            {alts_items}
          </ul>
          <div style="margin: 28px 0;">
            <a href="{switch_url}" style="background: #00ff88; color: #071714; padding: 14px 28px; border-radius: 10px; font-weight: 800; text-decoration: none; display: inline-block; font-size: 14px; box-shadow: 0 4px 14px rgba(0, 255, 136, 0.4);">
              ⚡ Review & Switch Trip in 1-Click →
            </a>
          </div>
          <p style="color: #64748b; font-size: 11px; margin-top: 24px; line-height: 1.6; border-top: 1px solid rgba(255, 255, 255, 0.1); padding-top: 16px;">
            Camp Smart continuous condition monitoring is active for this trip until departure.
            <br />
            You received this alert because you saved this camping trip on Camp Smart Australia.
            <br />
            Don't want condition alerts for this trip? <a href="{unsub_link}" style="color: #94a3b8; text-decoration: underline;">Unsubscribe from alerts for this trip</a> or manage all trips in your <a href="{switch_url}" style="color: #94a3b8; text-decoration: underline;">Camper Dashboard</a>.
          </p>
        </div>
        """
        return self._send(recipient_email, subject, html)

    def clear_outbox(self):
        self.outbox.clear()

    def _send(self, to_email: str, subject: str, html_body: str) -> str:
        record = {
            "to": to_email,
            "to_email": to_email,
            "subject": subject,
            "body": html_body,
            "body_html": html_body
        }
        self.outbox.append(record)

        transport = self.transport

        if transport == "smtp":
            if not settings.SMTP_HOST:
                logger.error(
                    "EMAIL_TRANSPORT=smtp but SMTP_HOST is unset; cannot deliver to %s",
                    to_email,
                )
                return STATUS_FAILED
            try:
                msg = MIMEMultipart("alternative")
                msg["Subject"] = subject
                msg["From"] = settings.SMTP_FROM or "alerts@campsmart.au"
                msg["To"] = to_email
                msg.attach(MIMEText(html_body, "html"))
                with smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT or 587) as server:
                    if settings.SMTP_USER and settings.SMTP_PASSWORD:
                        server.starttls()
                        server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
                    server.sendmail(msg["From"], [to_email], msg.as_string())
                logger.info("📧 [Email Sent] To: %s | Subject: %s", to_email, subject)
                return STATUS_SENT
            except Exception as e:
                logger.error("Failed to send email via SMTP to %s: %s", to_email, e)
                return STATUS_FAILED

        if transport == "outbox":
            logger.info(
                "📧 [Queued to outbox — NOT delivered] To: %s | Subject: %s",
                to_email,
                subject,
            )
            return STATUS_QUEUED_OUTBOX

        logger.warning(
            "📧 [NOT delivered — no email transport configured] To: %s | Subject: %s. "
            "Set EMAIL_TRANSPORT=smtp (or 'outbox' for development) to deliver mail.",
            to_email,
            subject,
        )
        return STATUS_DISABLED


def warn_if_no_email_transport(context: str) -> None:
    """
    Loud startup notice when Plan B alerts and magic links cannot reach campers.
    The feature is only as good as its delivery, so this must not fail silently.
    """
    if email_service.delivers_for_real:
        logger.info("[%s] Email transport ready (smtp -> %s)", context, settings.SMTP_HOST)
        return

    logger.warning(
        "[%s] EMAIL_TRANSPORT='%s' — outbound email will NOT reach campers. "
        "Magic sign-in links and Plan B alerts will be recorded as %s, not %s. "
        "Configure SMTP_HOST and EMAIL_TRANSPORT=smtp for real delivery.",
        context,
        email_service.transport,
        STATUS_QUEUED_OUTBOX if email_service.transport == "outbox" else STATUS_DISABLED,
        STATUS_SENT,
    )


# Global singleton
email_service = EmailService()
