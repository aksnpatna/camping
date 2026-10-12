import os
import json
import re
import logging
from typing import Dict, Any, Optional
import httpx

logger = logging.getLogger(__name__)

LOCAL_LLM_URL = os.environ.get("LOCAL_LLM_URL", "http://localhost:8002/v1")
LOCAL_LLM_MODEL = os.environ.get("LOCAL_LLM_MODEL", "qwen3:9b")
OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://localhost:11434")
OLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "qwen3:9b")
GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
GROQ_MODEL = os.environ.get("GROQ_MODEL", "llama3-8b-8192")

class LLMInferenceService:
    """
    Centralized Inference Service:
    Local-First with local GPU server (Qwen3-9B via guardrail gateway :8002),
    Ollama fallback, Groq cloud fallback, and deterministic heuristic fallback.
    """
    @classmethod
    async def call_local_server(cls, prompt: str, timeout: float = 5.0) -> Optional[str]:
        """
        Query local GPU server (llama.cpp / llama-swap behind gateway.py on :8002) using Qwen3-9B.
        """
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                payload = {
                    "model": LOCAL_LLM_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1,
                    "max_tokens": 512
                }
                res = await client.post(f"{LOCAL_LLM_URL}/chat/completions", json=payload)
                if res.status_code == 200:
                    data = res.json()
                    choices = data.get("choices", [])
                    if choices:
                        return choices[0].get("message", {}).get("content", "")
        except Exception as e:
            logger.info(f"Local GPU server ({LOCAL_LLM_URL}) unavailable ({e}), trying fallback.")
        return None

    @classmethod
    async def call_ollama(cls, prompt: str, is_json: bool = True, timeout: float = 3.0) -> Optional[str]:

        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                payload = {
                    "model": OLLAMA_MODEL,
                    "prompt": prompt,
                    "stream": False
                }
                if is_json:
                    payload["format"] = "json"
                res = await client.post(f"{OLLAMA_BASE_URL}/api/generate", json=payload)
                if res.status_code == 200:
                    return res.json().get("response", "")
        except Exception as e:
            logger.info(f"Ollama inference unavailable ({e}), trying fallback.")
        return None

    @classmethod
    async def call_groq(cls, prompt: str, is_json: bool = True, timeout: float = 4.0) -> Optional[str]:
        if not GROQ_API_KEY:
            return None
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                headers = {"Authorization": f"Bearer {GROQ_API_KEY}"}
                payload = {
                    "model": GROQ_MODEL,
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2
                }
                if is_json:
                    payload["response_format"] = {"type": "json_object"}
                res = await client.post("https://api.groq.com/openai/v1/chat/completions", json=payload, headers=headers)
                if res.status_code == 200:
                    return res.json()["choices"][0]["message"]["content"]
        except Exception as e:
            logger.info(f"Groq inference failed: {e}")
        return None

    @classmethod
    def parse_trip_prompt_deterministic(cls, prompt: str) -> Dict[str, Any]:
        """
        Deterministic, fast extraction fallback when LLM is unavailable.
        """
        low = prompt.lower()
        extracted: Dict[str, Any] = {}

        # Dog filter
        if any(w in low for w in ["dog", "dogs", "pet", "pets", "pup", "puppy"]):
            if "no dog" in low or "leave dog" in low or "without dog" in low:
                extracted["dog_friendly"] = False
            else:
                extracted["dog_friendly"] = True

        # Drive hours
        drive_match = re.search(r'(?:under|within|max|less than)\s*([0-9.]+)\s*(?:hours|hrs|hr|hour)', low)
        if drive_match:
            try:
                extracted["max_drive_hours"] = float(drive_match.group(1))
            except ValueError:
                pass
        
        # Origin
        if "sydney" in low:
            extracted["origin_lat"] = -33.8688
            extracted["origin_lng"] = 151.2093
        elif "melbourne" in low:
            extracted["origin_lat"] = -37.8136
            extracted["origin_lng"] = 144.9631
        elif "canberra" in low:
            extracted["origin_lat"] = -35.2809
            extracted["origin_lng"] = 149.1300
        elif "brisbane" in low:
            extracted["origin_lat"] = -27.4698
            extracted["origin_lng"] = 153.0251
        elif "perth" in low:
            extracted["origin_lat"] = -31.9505
            extracted["origin_lng"] = 115.8605
        elif "adelaide" in low:
            extracted["origin_lat"] = -34.9285
            extracted["origin_lng"] = 138.6007
        elif "hobart" in low:
            extracted["origin_lat"] = -42.8821
            extracted["origin_lng"] = 147.3272
        elif "darwin" in low:
            extracted["origin_lat"] = -12.4634
            extracted["origin_lng"] = 130.8456
        elif "cairns" in low:
            extracted["origin_lat"] = -16.9186
            extracted["origin_lng"] = 145.7781
        elif "gold coast" in low:
            extracted["origin_lat"] = -28.0167
            extracted["origin_lng"] = 153.4000
        elif "newcastle" in low:
            extracted["origin_lat"] = -32.9283
            extracted["origin_lng"] = 151.7817
        elif "wollongong" in low:
            extracted["origin_lat"] = -34.4278
            extracted["origin_lng"] = 150.8931
        elif "geelong" in low:
            extracted["origin_lat"] = -38.1499
            extracted["origin_lng"] = 144.3617

        # Rig / Shelter
        if "caravan" in low:
            extracted["rig_access"] = "CARAVAN"
        elif "tent" in low:
            extracted["rig_access"] = "TENT"

        return extracted

    @classmethod
    async def parse_trip_prompt(cls, prompt: str) -> Dict[str, Any]:
        """
        Extracts structured trip parameters from user query.
        """
        fallback_data = cls.parse_trip_prompt_deterministic(prompt)
        
        llm_prompt = f"""
You are an Australian camping trip query parser. Extract strict JSON from: "{prompt}"
JSON Schema:
{{
  "dog_friendly": true/false/null,
  "max_drive_hours": float or null,
  "origin_city": "Sydney" or null,
  "rig_access": "TENT" or "CARAVAN" or null
}}
Output JSON only.
"""
        response_text = await cls.call_local_server(llm_prompt)
        if not response_text:
            response_text = await cls.call_ollama(llm_prompt)
        if not response_text:
            response_text = await cls.call_groq(llm_prompt)

        if response_text:
            try:
                data = json.loads(response_text.strip())
                # Merge validated fields
                if data.get("dog_friendly") is not None:
                    fallback_data["dog_friendly"] = bool(data["dog_friendly"])
                if data.get("max_drive_hours"):
                    fallback_data["max_drive_hours"] = float(data["max_drive_hours"])
                if data.get("rig_access"):
                    fallback_data["rig_access"] = str(data["rig_access"])
            except Exception as e:
                logger.warning(f"Failed to parse LLM extraction JSON: {e}")

        return fallback_data

    @classmethod
    def adjust_constraints_deterministic(cls, current: Dict[str, Any], instruction: str) -> Dict[str, Any]:
        """
        Interprets follow-up conversational adjustments (What-If engine).
        """
        low = instruction.lower()
        updated = dict(current)

        # Dog adjustments
        if "dog" in low or "pet" in low:
            if "no dog" in low or "without dog" in low:
                updated["dog_friendly"] = False
            else:
                updated["dog_friendly"] = True

        # Additional drive time
        min_match = re.search(r'([0-9]+)\s*(?:more\s*)?(?:minutes|mins|min)', low)
        hr_match = re.search(r'([0-9.]+)\s*(?:more\s*)?(?:hours|hrs|hr)', low)
        current_hours = float(updated.get("max_drive_hours") or 3.0)

        if "another" in low or "more" in low or "allow" in low or "increase" in low:
            if min_match:
                added = float(min_match.group(1)) / 60.0
                updated["max_drive_hours"] = round(current_hours + added, 2)
            elif hr_match:
                added = float(hr_match.group(1))
                updated["max_drive_hours"] = round(current_hours + added, 2)
        elif min_match and ("under" in low or "limit" in low):
            updated["max_drive_hours"] = round(float(min_match.group(1)) / 60.0, 2)
        elif hr_match and ("under" in low or "limit" in low):
            updated["max_drive_hours"] = round(float(hr_match.group(1)), 2)

        # Shelter adjustments
        if "caravan" in low:
            updated["rig_access"] = "CARAVAN"
        elif "tent" in low:
            updated["rig_access"] = "TENT"

        return updated

    @classmethod
    def synthesize_weather_condition_summary_deterministic(cls, data: Dict[str, Any]) -> str:
        """
        High-quality, grounded Australian camping condition synthesis fallback when LLM is offline.
        """
        campsite_name = data.get("campsite_name") or "campground"
        temp_max = round(data.get("temp_max", 22.0))
        temp_min = round(data.get("temp_min", 12.0))
        rain_prob = int(data.get("rain_probability", 15))
        wind_max = round(data.get("wind_max_kmh", 15.0))
        sleeping_bag = data.get("sleeping_bag_rating") or "3-season bag"
        inversion = bool(data.get("valley_inversion_active", False))
        rain_mm = data.get("expected_rainfall_mm", 0.0)

        # Sentence 1: Nighttime temperature & sleep/insulation factor
        if temp_min <= 4:
            s1 = f"Expect severe overnight cold dropping to {temp_min}°C ({'sub-zero valley inversion active' if inversion else 'alpine freeze'}); an R4+ insulated sleeping mat and {sleeping_bag} are mandatory."
        elif temp_min <= 9:
            s1 = f"Night temperatures plunge to {temp_min}°C with {'cold-air pooling in low ground' if inversion else 'a brisk chill'}; pack {sleeping_bag} and thermal layers."
        elif temp_min <= 15:
            s1 = f"Mild overnight conditions around {temp_min}°C make for comfortable sleeping with a standard {sleeping_bag}."
        else:
            s1 = f"Warm overnight low of {temp_min}°C allows light bedding; keep inner tent mesh vented for air movement."

        # Sentence 2: Rain, wind, campfire & pegging impact
        if rain_prob >= 50 or rain_mm >= 5.0:
            s2 = f"With a {rain_prob}% rain risk ({rain_mm:.1f}mm expected), pitch an overhead tarp and tension guy-lines before dark."
        elif wind_max >= 30:
            s2 = f"Gusts reaching {wind_max} km/h make open campfires hazardous; double-peg tent corners and use a shielded camp stove."
        elif rain_prob >= 25:
            s2 = f"Moderate {rain_prob}% shower chance; pitch a ground footprint beneath your tent floor to block damp seep."
        elif wind_max <= 15:
            s2 = f"Calm breezes under {wind_max} km/h provide prime campfire conditions; check local park total fire bans prior to ignition."
        else:
            s2 = f"Expect pleasant daytime highs near {temp_max}°C with stable {wind_max} km/h airflow across the site."

        return f"{s1} {s2}"

    @classmethod
    async def synthesize_weather_condition_summary(cls, data: Dict[str, Any]) -> str:
        """
        Synthesizes a 2-sentence Australian camping weather briefing from microclimate telemetry
        using local Qwen3-9B (:8002), Ollama/Groq, or deterministic physics fallback.
        """
        fallback_text = cls.synthesize_weather_condition_summary_deterministic(data)
        
        campsite_name = data.get("campsite_name") or "Campground"
        temp_max = data.get("temp_max", 22.0)
        temp_min = data.get("temp_min", 12.0)
        rain_prob = data.get("rain_probability", 15)
        wind_max = data.get("wind_max_kmh", 15.0)
        sleeping_bag = data.get("sleeping_bag_rating", "3-season sleeping bag")
        inversion = data.get("valley_inversion_active", False)
        campfire_risk = data.get("campfire_wind_risk", "Moderate")

        prompt = f"""You are a seasoned Australian bush camper and remote expedition guide.
Write a concise, practical 2-sentence camping weather briefing for {campsite_name}.

Atmospheric facts:
- Day High: {temp_max}°C, Night Low: {temp_min}°C
- Valley Cold Inversion Active: {inversion}
- Rain Probability: {rain_prob}%
- Max Wind Speed: {wind_max} km/h
- Campfire Wind Risk: {campfire_risk}
- Recommended Sleeping Bag: {sleeping_bag}

Rules:
- Exactly 2 sentences.
- Direct, practical bush wisdom (mention gear, sleeping bag/mat, campfire safety, condensation).
- No greetings, no fluff.
"""
        try:
            # 1. Local GPU server Qwen3-9B (:8002)
            resp = await cls.call_local_server(prompt, timeout=2.5)
            if not resp:
                # 2. Ollama fallback
                resp = await cls.call_ollama(prompt, is_json=False, timeout=2.0)
            if not resp:
                # 3. Groq fallback
                resp = await cls.call_groq(prompt, is_json=False, timeout=2.5)

            if resp and len(resp.strip()) >= 20:
                cleaned = resp.strip().strip('"').strip("'")
                # Ensure no runaway generation
                sentences = [s.strip() for s in re.split(r'(?<=[.!?])\s+', cleaned) if s.strip()]
                if sentences:
                    return " ".join(sentences[:2])
        except Exception as e:
            logger.info(f"AI weather condition synthesis LLM failed ({e}), using deterministic synthesis.")

        return fallback_text

