from datetime import datetime
from sqlalchemy import Column, Integer, String, Text, DateTime, Date, ForeignKey
from app.core.database import Base


class FactEvidence(Base):
    """
    Evidence row recording granular observations for specific campsite facts.

    Stores exactly what fact was observed, which source URL evidenced it,
    when it was retrieved, and the parser version used.
    """
    __tablename__ = "fact_evidence"

    id = Column(Integer, primary_key=True, index=True)
    campsite_id = Column(Integer, ForeignKey("canonical_campsites.id"), nullable=False, index=True)
    field = Column(String(50), nullable=False)  # e.g. "facilities.bbq", "fee_tier", "toilets"
    value = Column(Text, nullable=False)
    source_url = Column(Text, nullable=False)
    evidence_snippet = Column(Text, nullable=True)
    retrieved_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    published_at = Column(Date, nullable=True)
    parser_version = Column(String(20), nullable=True)
    data_status = Column(String(20), default="verified", nullable=False)  # verified | rule_derived | unverified
