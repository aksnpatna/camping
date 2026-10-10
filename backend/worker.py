import time
import logging
from app.worker.plan_b import run_plan_b_check

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

if __name__ == "__main__":
    logger.info("Starting Plan B Worker Process...")
    while True:
        try:
            run_plan_b_check()
        except Exception as e:
            logger.error(f"Worker crashed during execution: {e}")
            
        logger.info("Sleeping for 1 hour...")
        time.sleep(3600)
