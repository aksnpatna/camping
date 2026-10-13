import sys
import os
from logging.config import fileConfig

from sqlalchemy import engine_from_config
from sqlalchemy import pool
from alembic import context

# Add backend directory to path so we can import app
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.config import settings
from app.core.database import Base

# Import every model so Base.metadata is fully populated for autogenerate.
from app.models.campsite import Campsite  # noqa: F401
from app.models.saved_trip import SavedTrip  # noqa: F401
from app.models.trip_room import TripRoom  # noqa: F401
from app.models.plan_b_alert import PlanBAlert  # noqa: F401
from app.models.magic_token import MagicToken  # noqa: F401
from app.models.policy_rule import PolicyRule  # noqa: F401
from app.models.harvest_cache import HarvestCache  # noqa: F401
from app.models.fact_evidence import FactEvidence  # noqa: F401
from app.models.check_in import CampsiteCheckIn  # noqa: F401
from app.models.analytics import AnalyticsEvent, EmailLead  # noqa: F401

# this is the Alembic Config object, which provides
# access to the values within the .ini file in use.
config = context.config

# Interpret the config file for Python logging.
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Override the sqlalchemy.url dynamically from our settings
config.set_main_option("sqlalchemy.url", settings.DATABASE_URL)

target_metadata = Base.metadata

def include_object(object, name, type_, reflected, compare_to):
    # Ignore the PostGIS spatial_ref_sys table so Alembic doesn't try to drop it
    if type_ == "table" and name == "spatial_ref_sys":
        return False
    return True

def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
        include_object=include_object,
    )
    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )
    with connectable.connect() as connection:
        context.configure(
            connection=connection, 
            target_metadata=target_metadata,
            include_object=include_object
        )
        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
