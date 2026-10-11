from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from app.models.campsite import Campsite
from app.core.config import settings

DATABASE_URL = settings.DATABASE_URL

engine = create_engine(DATABASE_URL, echo=True)
SessionLocal = sessionmaker(bind=engine)

# 32 Canonical, deeply verified campsites within <= 3.5h of Sydney
# Covering NPWS, Forestry Corporation NSW (dog friendly & free), WaterNSW, and Councils.
CAMPSITES = [
    {
        "name": "The Pines",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/olney",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/olney",
        "fire_district": "Central Coast",
        "location": "POINT(151.3789 -33.0906)"
    },
    {
        "name": "Turpentine",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/olney",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/olney",
        "fire_district": "Central Coast",
        "location": "POINT(151.3821 -33.1042)"
    },
    {
        "name": "Euroka Campground",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "flush", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/euroka-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/euroka-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.6272 -33.7842)"
    },
    {
        "name": "Murphy's Glen",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "4WD_ONLY"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/murphys-glen-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/murphys-glen-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.4833 -33.7667)"
    },
    {
        "name": "Old Ford Reserve",
        "state": "NSW",
        "management_type": "Blue Mountains City Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.bmcc.nsw.gov.au/camping",
        "source_url": "https://www.bmcc.nsw.gov.au/camping",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.2520 -33.6823)"
    },
    {
        "name": "Blackheath Glen",
        "state": "NSW",
        "management_type": "Blue Mountains City Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "flush", "showers": "none", "drinking_water": True, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.bmcc.nsw.gov.au/camping",
        "source_url": "https://www.bmcc.nsw.gov.au/camping",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.2575 -33.6598)"
    },
    {
        "name": "Bonnie Vale",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": False},
        "fees": "$34.00/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/bonnie-vale-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/bonnie-vale-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(151.1442 -34.0815)"
    },
    {
        "name": "Upper Colo Reserve",
        "state": "NSW",
        "management_type": "Hawkesbury City Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "composting", "showers": "cold", "drinking_water": False, "campfires": True},
        "fees": "$12.50/adult",
        "booking_url": "https://www.hawkesbury.nsw.gov.au/your-council/facilities/upper-colo-reserve",
        "source_url": "https://www.hawkesbury.nsw.gov.au/your-council/facilities/upper-colo-reserve",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.8034 -33.4312)"
    },
    {
        "name": "Mill Creek",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/mill-creek-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/mill-creek-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(151.0253 -33.3986)"
    },
    {
        "name": "Bendeela Camping",
        "state": "NSW",
        "management_type": "WaterNSW",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "none", "drinking_water": False, "campfires": False},
        "fees": "$6.00 booking fee",
        "booking_url": "https://www.waternsw.com.au/catchment/places-to-visit/bendeela-camping-and-picnic-area",
        "source_url": "https://www.waternsw.com.au/catchment/places-to-visit/bendeela-camping-and-picnic-area",
        "fire_district": "Illawarra/Shoalhaven",
        "location": "POINT(150.4853 -34.7431)"
    },
    {
        "name": "Gambells Rest",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/gambells-rest-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/gambells-rest-campground",
        "fire_district": "Southern Ranges",
        "location": "POINT(150.3128 -34.6644)"
    },
    {
        "name": "Daly's Clearing",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/belanglo",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/belanglo",
        "fire_district": "Southern Ranges",
        "location": "POINT(150.2541 -34.5264)"
    },
    {
        "name": "Wingello Forest",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/wingello",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/wingello",
        "fire_district": "Southern Ranges",
        "location": "POINT(150.1872 -34.6978)"
    },
    {
        "name": "Frying Pan Rock",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/chichester",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/chichester",
        "fire_district": "Hunter",
        "location": "POINT(151.7241 -32.2612)"
    },
    {
        "name": "Telegherry",
        "state": "NSW",
        "management_type": "Forestry Corporation NSW",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.forestrycorporation.com.au/visit/forests/chichester",
        "source_url": "https://www.forestrycorporation.com.au/visit/forests/chichester",
        "fire_district": "Hunter",
        "location": "POINT(151.7483 -32.2472)"
    },
    {
        "name": "Green Patch",
        "state": "NSW",
        "management_type": "Parks Australia",
        "dog_friendly": False,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": False},
        "fees": "$28.00/night",
        "booking_url": "https://parksaustralia.gov.au/booderee/camping/green-patch/",
        "source_url": "https://parksaustralia.gov.au/booderee/camping/green-patch/",
        "fire_district": "Illawarra/Shoalhaven",
        "location": "POINT(150.7289 -35.1328)"
    },
    {
        "name": "Pebbly Beach",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "cold", "drinking_water": False, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/pebbly-beach-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/pebbly-beach-campground",
        "fire_district": "Illawarra/Shoalhaven",
        "location": "POINT(150.2974 -35.5976)"
    },
    {
        "name": "Depot Beach",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": False},
        "fees": "$34.00/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/depot-beach-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/depot-beach-campground",
        "fire_district": "Illawarra/Shoalhaven",
        "location": "POINT(150.3189 -35.6264)"
    },
    {
        "name": "Pretty Beach",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "CARAVAN", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": True},
        "fees": "$34.00/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/pretty-beach-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/pretty-beach-campground",
        "fire_district": "Illawarra/Shoalhaven",
        "location": "POINT(150.3644 -35.5714)"
    },
    {
        "name": "Newnes",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "4WD_ONLY"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/newnes-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/newnes-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.2361 -33.1972)"
    },
    {
        "name": "Dunphy's Camp",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/dunphys-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/dunphys-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.2386 -33.7258)"
    },
    {
        "name": "Boyd River",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/boyd-river-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/boyd-river-campground",
        "fire_district": "Central Ranges",
        "location": "POINT(150.0528 -33.9781)"
    },
    {
        "name": "Capertee Valley",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": True},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/capertee-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/capertee-campground",
        "fire_district": "Central Ranges",
        "location": "POINT(149.9833 -33.1417)"
    },
    {
        "name": "Coorongooba",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/coorongooba-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/coorongooba-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.2917 -33.1111)"
    },
    {
        "name": "Mystery Bay",
        "state": "NSW",
        "management_type": "Eurobodalla Shire Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "pit", "showers": "cold", "drinking_water": False, "campfires": True},
        "fees": "$15.00/adult",
        "booking_url": "https://www.mysterybay.com.au",
        "source_url": "https://www.mysterybay.com.au",
        "fire_district": "Far South Coast",
        "location": "POINT(150.1333 -36.2975)"
    },
    {
        "name": "Colo Meroo",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "Walk-in"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/colo-meroo-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/colo-meroo-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.7083 -33.3750)"
    },
    {
        "name": "Wheeny Creek",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/wheeny-creek-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/wheeny-creek-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.7667 -33.4750)"
    },
    {
        "name": "Gentlemans Halt",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "Walk/Boat"],
        "facilities": {"toilets": "pit", "showers": "none", "drinking_water": False, "campfires": True},
        "fees": "$0 (Free)",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/gentlemans-halt-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/gentlemans-halt-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(151.1333 -33.5250)"
    },
    {
        "name": "Lake Lyell",
        "state": "NSW",
        "management_type": "Lithgow Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "CARAVAN", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": True},
        "fees": "$25.00/night",
        "booking_url": "https://lakelyell.com.au",
        "source_url": "https://lakelyell.com.au",
        "fire_district": "Central Ranges",
        "location": "POINT(150.0750 -33.5417)"
    },
    {
        "name": "Glenworth Valley",
        "state": "NSW",
        "management_type": "Private",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": True},
        "fees": "$33.00/adult",
        "booking_url": "https://glenworth.com.au/camping/",
        "source_url": "https://glenworth.com.au/camping/",
        "fire_district": "Central Coast",
        "location": "POINT(151.2417 -33.4025)"
    },
    {
        "name": "Cattai National Park",
        "state": "NSW",
        "management_type": "NPWS",
        "dog_friendly": False,
        "rig_access": ["TENT", "2WD"],
        "facilities": {"toilets": "flush", "showers": "hot", "drinking_water": True, "campfires": False},
        "fees": "$24.60/night",
        "booking_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/cattai-campground",
        "source_url": "https://www.nationalparks.nsw.gov.au/camping-and-accommodation/campgrounds/cattai-campground",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.8931 -33.5514)"
    },
    {
        "name": "Swann Reserve",
        "state": "NSW",
        "management_type": "The Hills Shire Council",
        "dog_friendly": True,
        "rig_access": ["TENT", "CAMPER_TRAILER", "2WD"],
        "facilities": {"toilets": "flush", "showers": "none", "drinking_water": True, "campfires": False},
        "fees": "$0 (Free)",
        "booking_url": "https://www.thehills.nsw.gov.au/Venues/Parks-Reserves/Swann-Reserve",
        "source_url": "https://www.thehills.nsw.gov.au/Venues/Parks-Reserves/Swann-Reserve",
        "fire_district": "Greater Sydney Region",
        "location": "POINT(150.9850 -33.3850)"
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
                facilities=data.get("facilities"),
                fees=data.get("fees"),
                booking_url=data.get("booking_url"),
                source_url=data.get("source_url"),
                fire_district=data.get("fire_district"),
                location=data["location"]
            )
            session.add(new_site)
        
        session.commit()
        print(f"Successfully seeded {len(CAMPSITES)} canonical Sydney catchment campgrounds!")

if __name__ == "__main__":
    seed_data()
