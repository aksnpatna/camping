import pytest
from unittest.mock import patch, MagicMock
from app.core.database import SessionLocal
from app.core.config import settings
from app.models.campsite import Campsite, DATA_STATUS_VERIFIED
from app.models.harvest_cache import HarvestCache
from app.models.fact_evidence import FactEvidence
from app.ingest.harvest import (
    compute_content_hash,
    extract_amenities_from_html,
    extract_fees_from_html,
    fetch_page_cached,
    harvest_campsite_record,
    run_harvest_batch,
    resolve_npws_candidate_urls,
    resolve_sa_candidate_urls,
    PARSER_VERSION,
)


SAMPLE_HTML = """
<!DOCTYPE html>
<html>
<head><title>Bonnie Vale Campground</title></head>
<body>
  <h1>Bonnie Vale Campground</h1>
  <div class="facilities">
    <p>Facilities include flush toilets, hot showers, and potable drinking water taps.</p>
    <p>There are sheltered gas barbecue areas and picnic tables with wheelchair accessible pathways.</p>
    <p>Wood fire pits are available at designated spots.</p>
  </div>
  <div class="pricing">
    <p>Site fees: $34.00 per night for up to 2 adults.</p>
  </div>
</body>
</html>
"""


def test_compute_content_hash():
    h1 = compute_content_hash("<html>hello</html>")
    h2 = compute_content_hash("<html>hello</html>")
    assert h1 == h2
    assert len(h1) == 64


def test_extract_amenities_from_html():
    amenities = extract_amenities_from_html(SAMPLE_HTML)
    assert amenities["toilets"] == "flush"
    assert amenities["showers"] == "hot"
    assert amenities["drinking_water"] is True
    assert amenities["campfires"] is True
    assert amenities["bbq"] is True
    assert amenities["shelter"] is True
    assert amenities["disabled_access"] is True


def test_extract_fees_from_html():
    fee = extract_fees_from_html(SAMPLE_HTML)
    assert fee == "$34.00/night"

    free_html = "<div>Free camping in this state forest area with no camping fee.</div>"
    assert extract_fees_from_html(free_html) == "$0 (Free)"


def test_proxy_configured():
    # Verify settings has PROXY_URL loaded
    assert settings.PROXY_URL is not None
    assert "smartproxy" in settings.PROXY_URL


def test_fetch_page_cached_and_harvest():
    test_url = "https://example.com/camp/bonnie-vale"
    with SessionLocal() as db:
        # Create test campsite
        site = Campsite(
            name="Harvest Test Camp",
            location="SRID=4326;POINT(151.15 -34.08)",
            state="NSW",
            management_type="NPWS",
            booking_url=test_url,
            data_status="unverified"
        )
        db.add(site)
        db.commit()

        # Mock httpx response
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = SAMPLE_HTML
        mock_resp.headers = {"etag": "xyz-123", "last-modified": "Sun, 11 Oct 2026 12:00:00 GMT"}

        with patch("httpx.Client") as mock_client:
            instance = mock_client.return_value.__enter__.return_value
            instance.get.return_value = mock_resp

            success = harvest_campsite_record(db, site)
            assert success is True

            # Verify proxy was passed to httpx.Client
            mock_client.assert_called()
            client_kwargs = mock_client.call_args[1]
            assert "proxy" in client_kwargs

        # Verify HarvestCache was written
        cached = db.query(HarvestCache).filter(HarvestCache.url == test_url).first()
        assert cached is not None
        assert cached.status == 200
        assert cached.etag == "xyz-123"

        # Verify FactEvidence rows were recorded
        evidence_rows = db.query(FactEvidence).filter(FactEvidence.campsite_id == site.id).all()
        assert len(evidence_rows) >= 7 # 7 amenities + 1 fee
        fields = [r.field for r in evidence_rows]
        assert "facilities.toilets" in fields
        assert "facilities.bbq" in fields
        assert "fees" in fields

        # Verify campsite was updated to verified
        db.refresh(site)
        assert site.data_status == DATA_STATUS_VERIFIED
        assert site.fees == "$34.00/night"
        assert site.facilities["toilets"] == "flush"
        assert site.facilities["bbq"] is True

        # Clean up
        db.query(FactEvidence).filter(FactEvidence.campsite_id == site.id).delete()
        db.query(HarvestCache).filter(HarvestCache.url == test_url).delete()
        db.delete(site)
        db.commit()


def test_run_harvest_batch():
    test_url = "https://example.com/camp/batch-test-site"
    with SessionLocal() as db:
        site = Campsite(
            name="Batch Test Camp",
            location="SRID=4326;POINT(151.20 -33.85)",
            state="NSW",
            management_type="NPWS",
            booking_url=test_url,
            data_status="unverified"
        )
        db.add(site)
        db.commit()

        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.text = SAMPLE_HTML
        mock_resp.headers = {"etag": "xyz-456", "last-modified": "Sun, 11 Oct 2026 12:00:00 GMT"}

        with patch("httpx.Client") as mock_client:
            instance = mock_client.return_value.__enter__.return_value
            instance.get.return_value = mock_resp

            stats = run_harvest_batch(db, limit=5, state="NSW", delay=0.0, campsite_ids=[site.id])
            assert stats["attempted"] == 1
            assert stats["successful"] == 1

        db.refresh(site)
        assert site.data_status == DATA_STATUS_VERIFIED

        # Cleanup
        db.query(FactEvidence).filter(FactEvidence.campsite_id == site.id).delete()
        db.query(HarvestCache).filter(HarvestCache.url == test_url).delete()
        db.delete(site)
        db.commit()


def test_resolve_npws_candidate_urls():
    candidates = resolve_npws_candidate_urls("Horse Swamp campground")
    assert "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/horse-swamp-campground" in candidates
    assert "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/horse-swamp" in candidates


def test_resolve_sa_candidate_urls():
    candidates = resolve_sa_candidate_urls("Mount Remarkable (NP)")
    assert "https://www.parks.sa.gov.au/parks/mount-remarkable-national-park" in candidates
    assert "https://www.parks.sa.gov.au/parks/mount-remarkable" in candidates
