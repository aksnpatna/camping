import logging
import httpx
from datetime import date
from app.core.database import SessionLocal
from app.models.saved_trip import SavedTrip
from app.models.campsite import Campsite
from app.services.news_scraper import check_campsite_news

logger = logging.getLogger(__name__)

def run_plan_b_check():
    logger.info("Running Plan B Monitor Check (Single Pass)...")
    with SessionLocal() as db:
        today = date.today()
        # Fetch active trips
        trips = db.query(SavedTrip, Campsite).join(Campsite).filter(
            SavedTrip.plan_b_alert_active == True,
            SavedTrip.start_date >= today
        ).all()

        for trip, campsite in trips:
            logger.info(f"Checking trip to {campsite.name} from {trip.start_date} to {trip.end_date}...")
            
            # 1. Check weather (synchronous httpx client for background worker)
            try:
                with httpx.Client() as client:
                    # We should check the exact start_date and end_date if we want to be accurate,
                    # but for MVP we will look at the forecast within the trip dates.
                    # open-meteo allows start_date and end_date parameters:
                    res = client.get(
                        f"https://api.open-meteo.com/v1/forecast?latitude={campsite.latitude}&longitude={campsite.longitude}&daily=temperature_2m_max,precipitation_probability_max&timezone=auto&start_date={trip.start_date}&end_date={trip.end_date}"
                    )
                    
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("daily"):
                            max_rain_prob = max(data["daily"]["precipitation_probability_max"])
                            max_temp = max(data["daily"]["temperature_2m_max"])
                            
                            if max_rain_prob >= 70 or max_temp >= 35:
                                logger.warning(
                                    f"PLAN B ALERT! Weather alert for {trip.user_email} at {campsite.name}. "
                                    f"Rain Prob: {max_rain_prob}%, Max Temp: {max_temp}°C"
                                )
                                trip.plan_b_alert_active = False
                                db.commit()
                                continue  # Skip news if weather already disabled it
                            else:
                                logger.info(f"Weather looks good for {campsite.name}.")
            except Exception as e:
                logger.error(f"Weather check failed for {campsite.name}: {e}")
                
            # 2. Check DuckDuckGo / Tavily for news alerts (fires, closures)
            try:
                news_data = check_campsite_news(campsite.name, campsite.state)
                if news_data and news_data.get("results"):
                    # Basic keyword check to avoid false positives from general search results
                    alert_keywords = ["fire", "flood", "closed", "closure", "warning", "evacuate"]
                    for result in news_data["results"]:
                        text = (result.get("title", "") + " " + result.get("body", "")).lower()
                        if any(kw in text for kw in alert_keywords):
                            logger.warning(
                                f"PLAN B ALERT! Found recent danger news for {campsite.name}. "
                                f"Top result: {result['title']} ({result['source']})"
                            )
                            trip.plan_b_alert_active = False
                            db.commit()
                            break
            except Exception as e:
                logger.error(f"News check failed for {campsite.name}: {e}")
