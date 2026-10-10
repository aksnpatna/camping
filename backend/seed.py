from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.campsite import Campsite
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)

CAMPSITES = [
    {
        "name": "Green Patch",
        "state": "NSW",
        "management_type": "National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER"],
        "location": "POINT(150.7289 -35.1328)"
    },
    {
        "name": "Tidal River",
        "state": "VIC",
        "management_type": "Parks Victoria",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "MOTORHOME"],
        "location": "POINT(146.3211 -39.0305)"
    },
    {
        "name": "Pebbly Beach",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "4WD_ONLY"],
        "location": "POINT(150.2974 -35.5976)"
    },
    {
        "name": "Johanna Beach",
        "state": "VIC",
        "management_type": "Parks Victoria",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER"],
        "location": "POINT(143.3769 -38.7610)"
    },
    {
        "name": "Cylinder Beach",
        "state": "QLD",
        "management_type": "Minjerribah Camping",
        "dog_friendly": False,
        "rig_access": ["TENT", "4WD_ONLY", "CARAVAN"],
        "location": "POINT(153.5350 -27.4260)"
    }
]

def seed_data():
    with SessionLocal() as session:
        # Delete old test data
        session.execute(text("DELETE FROM canonical_campsites"))
        
        for data in CAMPSITES:
            new_site = Campsite(
                name=data["name"],
                state=data["state"],
                management_type=data["management_type"],
                dog_friendly=data["dog_friendly"],
                rig_access=data["rig_access"],
                location=data["location"]
            )
            session.add(new_site)
        
        session.commit()
        print("Successfully seeded 5 iconic campgrounds!")

if __name__ == "__main__":
    seed_data()
