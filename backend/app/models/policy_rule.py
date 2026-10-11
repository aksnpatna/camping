from sqlalchemy import Column, Integer, String, Text, Date, Boolean
from app.core.database import Base


class PolicyRule(Base):
    """
    Versioned land-manager policy rules.

    Stores statewide or jurisdiction-wide rules as versioned data rows rather
    than code constants, so policy changes (e.g. fee restructuring, booking
    system changes) are updated via data rows with verifiable evidence citations.
    """
    __tablename__ = "policy_rules"

    id = Column(Integer, primary_key=True, index=True)
    land_manager = Column(String(100), nullable=False, index=True)  # e.g. "NPWS", "Forestry Corporation"
    field = Column(String(50), nullable=False)  # e.g. "dog_friendly", "fees", "booking_status", "booking_url"
    value = Column(Text, nullable=False)  # stored representation e.g. "False", "$0 (Free)"
    evidence_url = Column(Text, nullable=False)
    description = Column(Text, nullable=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
