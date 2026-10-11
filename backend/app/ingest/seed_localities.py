import csv
import logging
import os
from typing import Dict, Any, List
from sqlalchemy import text
from app.core.database import SessionLocal
from app.models.locality import AustralianLocality

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

CSV_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "data", "australian_postcodes.csv")


def seed_australian_localities(csv_path: str = CSV_PATH) -> int:
    """
    Ingest gazetted Australian localities from public postcodes dataset.
    Creates PostGIS geometry points for instant spatial lookup of nearest towns.
    """
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Localities CSV not found at {csv_path}")

    records_to_insert: List[Dict[str, Any]] = []
    seen = set()

    with open(csv_path, mode="r", encoding="utf-8", errors="ignore") as f:
        reader = csv.DictReader(f)
        for row in reader:
            try:
                lat_str = row.get("lat") or row.get("Lat_precise") or "0"
                lon_str = row.get("long") or row.get("Long_precise") or "0"
                lat = float(lat_str)
                lon = float(lon_str)

                # Skip invalid or 0 coordinates (outside Australia bounding box)
                if not (110.0 <= lon <= 155.0 and -45.0 <= lat <= -9.0):
                    continue

                locality = (row.get("locality") or "").strip().title()
                state = (row.get("state") or "").strip().upper()
                postcode = (row.get("postcode") or "").strip().zfill(4)

                if not locality or not state:
                    continue

                dedupe_key = (locality, state, postcode)
                if dedupe_key in seen:
                    continue
                seen.add(dedupe_key)

                sa3name = (row.get("sa3name") or "").strip() or None
                sa4name = (row.get("sa4name") or "").strip() or None
                region = (row.get("region") or "").strip() or None

                records_to_insert.append({
                    "postcode": postcode,
                    "locality": locality,
                    "state": state,
                    "location_wkt": f"SRID=4326;POINT({lon} {lat})",
                    "sa3name": sa3name,
                    "sa4name": sa4name,
                    "region": region,
                })
            except Exception:
                continue

    logger.info(f"Parsed {len(records_to_insert)} unique Australian localities. Seeding database...")

    with SessionLocal() as db:
        # Check current count
        current_count = db.query(AustralianLocality).count()
        if current_count >= len(records_to_insert) - 500:
            logger.info(f"Database already populated with {current_count} localities. Skipping re-seed.")
            return current_count

        # Clear and batch insert
        db.execute(text("TRUNCATE TABLE australian_localities RESTART IDENTITY;"))
        db.commit()

        insert_sql = text("""
            INSERT INTO australian_localities (postcode, locality, state, location, sa3name, sa4name, region)
            VALUES (:postcode, :locality, :state, ST_GeomFromEWKT(:location_wkt), :sa3name, :sa4name, :region)
        """)

        # Insert in chunks of 1000
        batch_size = 1000
        for i in range(0, len(records_to_insert), batch_size):
            chunk = records_to_insert[i:i + batch_size]
            db.execute(insert_sql, chunk)
            db.commit()
            logger.info(f"Inserted batch {i + len(chunk)}/{len(records_to_insert)}")

        final_count = db.query(AustralianLocality).count()
        logger.info(f"Successfully seeded {final_count} Australian localities into PostGIS.")
        return final_count


if __name__ == "__main__":
    count = seed_australian_localities()
    print(f"Total Australian Localities in DB: {count}")
