import os
import logging
from duckduckgo_search import DDGS
from tavily import TavilyClient

logger = logging.getLogger(__name__)

def check_campsite_news(campsite_name: str, state: str) -> dict:
    """
    Search for recent news, closures, or fire alerts for a specific campsite.
    Uses DuckDuckGo by default, with Tavily as a fallback.
    """
    query = f"{campsite_name} {state} national park (fire OR closure OR alert OR flood)"
    results = []
    
    try:
        logger.info(f"Searching DuckDuckGo for: {query}")
        with DDGS() as ddgs:
            # Get up to 3 recent text results
            ddg_results = list(ddgs.text(query, max_results=3, safesearch="off", timelimit="w"))
            if ddg_results:
                results = [{"title": r.get("title"), "body": r.get("body"), "source": "DuckDuckGo"} for r in ddg_results]
                
    except Exception as e:
        logger.warning(f"DuckDuckGo search failed: {e}. Falling back to Tavily.")
        results = []

    # Fallback to Tavily if DDG fails or returns empty
    if not results:
        tavily_api_key = os.environ.get("TAVILY_API_KEY")
        if tavily_api_key:
            try:
                logger.info(f"Searching Tavily for: {query}")
                tavily_client = TavilyClient(api_key=tavily_api_key)
                response = tavily_client.search(
                    query=query, 
                    search_depth="basic",
                    max_results=3
                )
                if response and "results" in response:
                    results = [{"title": r.get("title"), "body": r.get("content"), "source": "Tavily"} for r in response["results"]]
            except Exception as e:
                logger.error(f"Tavily search failed: {e}")
        else:
            logger.warning("No TAVILY_API_KEY provided in environment for fallback.")

    return {
        "campsite": campsite_name,
        "query": query,
        "results": results
    }
