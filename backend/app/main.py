from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api.v1.router import api_router
from app.services.email_service import warn_if_no_email_transport
from app.services.magic_link import assert_secret_key_safe


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Fail closed on a development secret in a production-like environment, and
    # make it unmistakable when outbound email cannot reach campers.
    assert_secret_key_safe()
    warn_if_no_email_transport("api")
    yield


app = FastAPI(
    title="Camp Smart Australia API",
    description="Backend for the Camp Smart Answer-First Trip Finder",
    version="1.0.0",
    lifespan=lifespan,
)


app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3021", "http://127.0.0.1:3021", "https://camping.akstest.win"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api/v1")
