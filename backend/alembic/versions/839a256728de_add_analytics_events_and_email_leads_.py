"""add analytics_events and email_leads tables

Revision ID: 839a256728de
Revises: a49e691e765d
Create Date: 2026-10-13 23:10:15.455248

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '839a256728de'
down_revision: Union[str, Sequence[str], None] = 'a49e691e765d'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'analytics_events',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('event_type', sa.String(length=50), nullable=False),
        sa.Column('path', sa.String(length=255), nullable=False),
        sa.Column('ip_address', sa.String(length=64), nullable=True),
        sa.Column('user_agent', sa.String(length=500), nullable=True),
        sa.Column('referrer', sa.String(length=500), nullable=True),
        sa.Column('session_id', sa.String(length=64), nullable=True),
        sa.Column('user_email', sa.String(length=255), nullable=True),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_analytics_events_id'), 'analytics_events', ['id'], unique=False)
    op.create_index(op.f('ix_analytics_events_event_type'), 'analytics_events', ['event_type'], unique=False)
    op.create_index(op.f('ix_analytics_events_path'), 'analytics_events', ['path'], unique=False)
    op.create_index(op.f('ix_analytics_events_ip_address'), 'analytics_events', ['ip_address'], unique=False)
    op.create_index(op.f('ix_analytics_events_session_id'), 'analytics_events', ['session_id'], unique=False)
    op.create_index(op.f('ix_analytics_events_user_email'), 'analytics_events', ['user_email'], unique=False)

    op.create_table(
        'email_leads',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(length=255), nullable=False),
        sa.Column('source', sa.String(length=50), nullable=False),
        sa.Column('status', sa.String(length=20), nullable=False),
        sa.Column('trips_count', sa.Integer(), nullable=False),
        sa.Column('first_ip', sa.String(length=64), nullable=True),
        sa.Column('last_active_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('meta_data', sa.JSON(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_email_leads_id'), 'email_leads', ['id'], unique=False)
    op.create_index(op.f('ix_email_leads_email'), 'email_leads', ['email'], unique=True)
    op.create_index(op.f('ix_email_leads_source'), 'email_leads', ['source'], unique=False)


def downgrade() -> None:
    op.drop_index(op.f('ix_email_leads_source'), table_name='email_leads')
    op.drop_index(op.f('ix_email_leads_email'), table_name='email_leads')
    op.drop_index(op.f('ix_email_leads_id'), table_name='email_leads')
    op.drop_table('email_leads')

    op.drop_index(op.f('ix_analytics_events_user_email'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_session_id'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_ip_address'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_path'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_event_type'), table_name='analytics_events')
    op.drop_index(op.f('ix_analytics_events_id'), table_name='analytics_events')
    op.drop_table('analytics_events')
