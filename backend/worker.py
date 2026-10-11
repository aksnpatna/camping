import time
import logging

from app.services.email_service import warn_if_no_email_transport
from app.services.magic_link import assert_secret_key_safe
from app.worker.plan_b import run_plan_b_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Plan B Worker Process...")

    # Refuse to run silently mis-configured: a worker that cannot deliver alerts
    # gives campers false confidence that they are being watched.
    assert_secret_key_safe()
    warn_if_no_email_transport("plan-b-worker")

    while True:
        try:
            run_plan_b_check()
        except Exception as e:
            logger.error(f"Worker crashed during execution: {e}")

        logger.info("Sleeping for 1 hour...")
        time.sleep(3600)
