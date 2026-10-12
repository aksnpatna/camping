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
