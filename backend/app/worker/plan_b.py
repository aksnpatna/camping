import asyncio
import logging
import httpx
from datetime import date
from sqlalchemy.orm import Session
from app.core.database import SessionLocal
from app.models.saved_trip import SavedTrip
from app.models.campsite import Campsite

logger = logging.getLogger(__name__)

async def check_plan_b_alerts():
    while True:
        logger.info("Running Plan B Monitor Check...")
        try:
            db = SessionLocal()
            today = date.today()
            
            def get_active_trips():
                return db.query(SavedTrip, Campsite).join(Campsite).filter(
                    SavedTrip.plan_b_alert_active == True,
                    SavedTrip.start_date >= today
                ).all()

            # Run the synchronous DB query in a thread so it doesn't block FastAPI
            trips = await asyncio.to_thread(get_active_trips)

            for trip, campsite in trips:
                logger.info(f"Checking weather for {trip.user_email}'s trip to {campsite.name}...")
                
                # We need the lon/lat
                lat = campsite.latitude
                lon = campsite.longitude
                
                async with httpx.AsyncClient() as client:
                    res = await client.get(
                        f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&daily=temperature_2m_max,precipitation_probability_max&timezone=auto"
                    )
                    
                    if res.status_code == 200:
                        data = res.json()
                        if data.get("daily"):
                            # Simple check: Is there a high chance of rain in the next 7 days?
                            # Realistically, we'd check the exact start_date/end_date, but for MVP:
                            max_rain_prob = max(data["daily"]["precipitation_probability_max"])
                            max_temp = max(data["daily"]["temperature_2m_max"])
                            
                            if max_rain_prob >= 70 or max_temp >= 35:
                                logger.warning(
                                    f"PLAN B ALERT! Sending alert to {trip.user_email} for {campsite.name}. "
                                    f"Rain Prob: {max_rain_prob}%, Max Temp: {max_temp}°C"
                                )
                                # Disable alert so we don't spam
                                trip.plan_b_alert_active = False
                                await asyncio.to_thread(db.commit)
                            else:
                                logger.info(f"Conditions look good for {campsite.name}.")

        except Exception as e:
            logger.error(f"Error in Plan B Monitor: {e}")
        finally:
            db.close()

        # Sleep for an hour (or 10 seconds for testing/MVP)
        await asyncio.sleep(60) # checking every minute for demo purposes
