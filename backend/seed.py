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
    },
    {
        "name": "Wilpena Pound Resort",
        "state": "SA",
        "management_type": "Private/National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "MOTORHOME", "CAMPER_TRAILER"],
        "location": "POINT(138.6019 -31.5305)"
    },
    {
        "name": "Lucky Bay",
        "state": "WA",
        "management_type": "DBCA",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(122.2272 -33.9961)"
    },
    {
        "name": "Dales Campground",
        "state": "WA",
        "management_type": "DBCA",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(118.3614 -22.4727)"
    },
    {
        "name": "Richardsons Beach",
        "state": "TAS",
        "management_type": "Parks and Wildlife",
        "dog_friendly": False,
        "rig_access": ["TENT", "MOTORHOME", "CARAVAN"],
        "location": "POINT(148.2913 -42.1287)"
    },
    {
        "name": "Cradle Mountain Discovery Parks",
        "state": "TAS",
        "management_type": "Private",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "MOTORHOME", "CAMPER_TRAILER"],
        "location": "POINT(145.9298 -41.5832)"
    },
    {
        "name": "Garnamarr Campground",
        "state": "NT",
        "management_type": "Parks Australia",
        "dog_friendly": False,
        "rig_access": ["TENT", "4WD_ONLY"],
        "location": "POINT(132.8105 -13.3278)"
    },
    {
        "name": "Ayers Rock Campground",
        "state": "NT",
        "management_type": "Voyages",
        "dog_friendly": True,
        "rig_access": ["TENT", "CARAVAN", "MOTORHOME", "CAMPER_TRAILER"],
        "location": "POINT(130.9859 -25.2443)"
    },
    {
        "name": "Osprey Bay",
        "state": "WA",
        "management_type": "DBCA",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(113.9875 -22.2038)"
    },
    {
        "name": "El Questro Station",
        "state": "WA",
        "management_type": "Private",
        "dog_friendly": True,
        "rig_access": ["TENT", "4WD_ONLY", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(127.9806 -16.0064)"
    },
    {
        "name": "Yangie Bay",
        "state": "SA",
        "management_type": "National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(135.3496 -34.6293)"
    },
    {
        "name": "Stringybark Campground",
        "state": "SA",
        "management_type": "National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN", "MOTORHOME"],
        "location": "POINT(138.2255 -35.6179)"
    },
    {
        "name": "Cosy Corner North",
        "state": "TAS",
        "management_type": "Parks and Wildlife",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(148.2711 -41.1738)"
    },
    {
        "name": "Friendly Beaches",
        "state": "TAS",
        "management_type": "Parks and Wildlife",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(148.2831 -41.9866)"
    },
    {
        "name": "Wangi Falls",
        "state": "NT",
        "management_type": "Parks and Wildlife",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(130.6094 -13.1611)"
    },
    {
        "name": "Ormiston Gorge",
        "state": "NT",
        "management_type": "Parks and Wildlife",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "CARAVAN"],
        "location": "POINT(132.7275 -23.6300)"
    },
    {
        "name": "Noah Beach",
        "state": "QLD",
        "management_type": "National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER"],
        "location": "POINT(145.4419 -16.1417)"
    },
    {
        "name": "Carnarvon Gorge",
        "state": "QLD",
        "management_type": "National Park",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER"],
        "location": "POINT(148.2575 -25.0747)"
    }
]

def seed_data():
    with SessionLocal() as session:
        # Delete old test data
        session.execute(text("TRUNCATE TABLE canonical_campsites CASCADE"))
        
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
        print(f"Successfully seeded {len(CAMPSITES)} iconic campgrounds!")

if __name__ == "__main__":
    seed_data()
