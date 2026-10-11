from typing import List, Dict, Any
from sqlalchemy.orm import Session
from fastapi import HTTPException
from app.models.campsite import Campsite
from app.schemas.checklist import ChecklistGenerateRequest, ChecklistResponse, PackingItem

class ChecklistService:
    @staticmethod
    def generate_checklist(db: Session, request: ChecklistGenerateRequest) -> ChecklistResponse:
        campsite = db.query(Campsite).filter(Campsite.id == request.campsite_id).first()
        if not campsite:
            raise HTTPException(status_code=404, detail="Campsite not found")

        owned_keywords = [item.strip().lower() for item in request.gear_profile]

        def check_owned(item_name: str, item_category: str) -> bool:
            name_lower = item_name.lower()
            cat_lower = item_category.lower()
            for kw in owned_keywords:
                if kw in name_lower or (len(kw) > 3 and kw in cat_lower):
                    return True
                # Keyword synonyms
                if "tent" in kw and "tent" in name_lower:
                    return True
                if "pad" in kw and "pad" in name_lower:
                    return True
                if ("bag" in kw or "sleep" in kw) and "sleeping bag" in name_lower:
                    return True
                if "stove" in kw and "stove" in name_lower:
                    return True
                if "cooler" in kw and "cooler" in name_lower:
                    return True
                if "light" in kw or "headlamp" in kw:
                    if "headlamp" in name_lower or "lantern" in name_lower:
                        return True
            return False

        party_size = max(1, request.party_size)
        water_litres = party_size * 5

        raw_items: List[Dict[str, Any]] = [
            # Shelter & Sleeping
            {
                "category": "Shelter & Sleeping",
                "item": f"{party_size}-Person Tent with Pegs and Rainfly",
                "quantity": "1 unit",
                "reason": "Primary weather and dew protection with waterproof seams"
            },
            {
                "category": "Shelter & Sleeping",
                "item": "Sleeping Bags (Seasonal Comfort Rated)",
                "quantity": f"{party_size} bags",
                "reason": "Cold ground temperature mitigation for Australian nights"
            },
            {
                "category": "Shelter & Sleeping",
                "item": "Insulated Sleeping Pads or Camp Mattresses",
                "quantity": f"{party_size} pads",
                "reason": "Thermal barrier preventing body heat conduction into the ground"
            },
            # Kitchen & Cooking
            {
                "category": "Kitchen & Cooking",
                "item": "Portable Gas Stove & Canisters",
                "quantity": "1 stove + 2 canisters",
                "reason": "Safe cooking surface compliant during total fire bans where wood fires are barred"
            },
            {
                "category": "Kitchen & Cooking",
                "item": "Insulated Camp Cooler (Esky) & Ice",
                "quantity": "1 unit",
                "reason": f"Maintains food safety and perishable items for {party_size} people"
            },
            {
                "category": "Kitchen & Cooking",
                "item": "Camp Cookware Set & Biodegradable Dish Soap",
                "quantity": "1 kit",
                "reason": "Leave No Trace compliance: wash dishes 50m away from natural waterways"
            },
            # Water & Hydration
            {
                "category": "Water & Hydration",
                "item": f"Drinking & Cooking Water ({water_litres}L)",
                "quantity": f"{water_litres} Litres",
                "reason": f"Standard safety baseline: 5L per person/day for Australian conditions"
            },
            {
                "category": "Water & Hydration",
                "item": "Reusable Water Canteens",
                "quantity": f"{party_size} bottles",
                "reason": "For daytime trail hikes and personal hydration tracking"
            },
            # Lighting & Power
            {
                "category": "Lighting & Power",
                "item": "LED Headlamps with Extra Batteries",
                "quantity": f"{party_size} units",
                "reason": "Hands-free illumination essential for night camp safety"
            },
            {
                "category": "Lighting & Power",
                "item": "Rugged Power Bank (10,000mAh+)",
                "quantity": "1 unit",
                "reason": "Keep navigation devices, emergency phones, and offline maps charged"
            },
            # Safety & Bush Preparedness
            {
                "category": "Safety & First Aid",
                "item": "Australian Bush First Aid Kit (with Snake Bite Bandage)",
                "quantity": "1 kit",
                "reason": "Critical pressure-immobilisation kit for Australian bushcraft"
            },
            {
                "category": "Safety & First Aid",
                "item": "Broad-Spectrum Sunscreen SPF50+ & Bush Insect Repellent",
                "quantity": "1 set",
                "reason": "High UV index and tick/mosquito deterrence near water"
            },
            {
                "category": "Safety & First Aid",
                "item": "Printed Offline Maps & Compass",
                "quantity": "1 set",
                "reason": "Zero cell service redundancy in remote bush locations"
            }
        ]

        if request.has_dog:
            raw_items.extend([
                {
                    "category": "Pet Supplies",
                    "item": "Dog Leash, Harness & Stake Anchor",
                    "quantity": "1 set",
                    "reason": "Mandatory in dog-friendly state forest areas to protect native wildlife"
                },
                {
                    "category": "Pet Supplies",
                    "item": "Dog Sleeping Mat & Warm Blanket",
                    "quantity": "1 set",
                    "reason": "Keeps your dog off damp ground and warm in sub-10°C night chills"
                },
                {
                    "category": "Pet Supplies",
                    "item": "Collapsible Bowls & Sealed Dog Food",
                    "quantity": "2 bowls + food",
                    "reason": "Sealed food storage prevents attracting wild possums or goannas"
                },
                {
                    "category": "Pet Supplies",
                    "item": "Dog First Aid (Tick Comb & Antiseptic Spray)",
                    "quantity": "1 kit",
                    "reason": "Check coat thoroughly every evening for bush ticks"
                }
            ])

        packing_items: List[PackingItem] = []
        missing_alerts: List[str] = []

        for item in raw_items:
            is_owned = check_owned(item["item"], item["category"])
            packing_items.append(PackingItem(
                category=item["category"],
                item=item["item"],
                quantity=item["quantity"],
                reason=item["reason"],
                owned=is_owned,
                borrow_first=not is_owned
            ))
            if not is_owned and item["category"] in ["Shelter & Sleeping", "Safety & First Aid", "Kitchen & Cooking"]:
                missing_alerts.append(
                    f"Missing {item['item']}: Ask a camping friend or check local gear rentals before purchasing new."
                )

        food_and_shopping = [
            f"Water Supply: {water_litres}L potable water containers",
            "Cooler Ice: 2x 5kg party ice bags before leaving highway",
            "Easy Camp Dinners: 1-pot meals (pasta, curries, canned beans)",
            "High-energy trail snacks: Dried fruit, nuts, muesli bars",
            "Heavy-duty waste bags: 100% pack-it-in pack-it-out waste removal"
        ]

        departure_tasks = [
            "Check live NSW RFS Fire Danger Rating & Total Fire Ban declarations",
            f"Download offline map pack for {campsite.name} ({campsite.latitude:.4f}, {campsite.longitude:.4f})",
            "Fill vehicle fuel tank at last major town before heading into park",
            "Verify spare tyre pressure and pack vehicle jack",
            "Inform an emergency contact in the city of your expected return time"
        ]

        return ChecklistResponse(
            campsite_id=campsite.id,
            campsite_name=campsite.name,
            packing_items=packing_items,
            food_and_shopping=food_and_shopping,
            departure_tasks=departure_tasks,
            missing_equipment_alerts=missing_alerts
        )
