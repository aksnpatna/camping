from typing import Optional, Any, Literal
from pydantic import BaseModel, Field, computed_field

BasisType = Literal[
    "official",   # Directly from government GIS dataset (NPWS, DEECA, QPWS, etc.)
    "verified",   # Field-checked or confirmed with park authority
    "rule",       # Derived from statutory regulation (e.g. NPWS National Parks Act no-dog rule)
    "community",  # Ground report from a camper (<14 days decay)
    "model",      # Climatology / forecast model (e.g. Open-Meteo, BOM analog)
    "estimate",   # Calculated estimate (e.g. haversine route distance/time)
    "unknown"     # Data missing / not confirmed
]

class Fact(BaseModel):
    value: Any = None
    basis: BasisType = "unknown"
    confidence: int = Field(default=0, ge=0, le=3)
    source: Optional[str] = None
    url: Optional[str] = None
    as_of: Optional[str] = None
    note: Optional[str] = None

    @classmethod
    def unknown(cls, note: Optional[str] = None) -> "Fact":
        return cls(value=None, basis="unknown", confidence=0, note=note)

class CampsiteFacts(BaseModel):
    dog_friendly: Fact
    campfires: Fact
    toilets: Fact
    water: Fact
    vehicle_access: Fact
    telco: Fact
    fees: Fact
    fire_status: Fact
    driving_time: Fact

    def _facts(self) -> list[Fact]:
        """Every fact carried by this record, in declaration order."""
        return [
            self.dog_friendly,
            self.campfires,
            self.toilets,
            self.water,
            self.vehicle_access,
            self.telco,
            self.fees,
            self.fire_status,
            self.driving_time,
        ]

    @computed_field
    @property
    def known_facts_count(self) -> int:
        """Facts whose basis is anything other than `unknown`."""
        return sum(1 for f in self._facts() if f.basis != "unknown")

    @computed_field
    @property
    def total_facts_count(self) -> int:
        """Total number of tracked facts, derived from the fields themselves."""
        return len(self._facts())

    @computed_field
    @property
    def official_or_verified_count(self) -> int:
        """Facts sourced from a government dataset or field-verified on site."""
        return sum(1 for f in self._facts() if f.basis in ("official", "verified"))
