from datetime import datetime
from sqlalchemy import Column, String, Integer, Text, DateTime
from app.core.database import Base


class HarvestCache(Base):
    """
    HTTP response cache for polite, resumable page harvesting.

    Stores raw web responses keyed by URL with ETag and Last-Modified to support
    conditional HTTP requests (304 Not Modified). Content-hash gating ensures
    parser improvements replay against cached HTML with zero network traffic.
    """
    __tablename__ = "harvest_cache"

    url = Column(Text, primary_key=True)
    status = Column(Integer, nullable=False)
    etag = Column(String(100), nullable=True)
    last_modified = Column(String(100), nullable=True)
    content_hash = Column(String(64), nullable=False, index=True)
    body = Column(Text, nullable=False)
    retrieved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    parser_version = Column(String(20), nullable=True)
