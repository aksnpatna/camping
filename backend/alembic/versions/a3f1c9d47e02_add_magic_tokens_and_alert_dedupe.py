"""add magic_tokens table and plan_b alert dedupe fields

Revision ID: a3f1c9d47e02
Revises: 5786ce495831
Create Date: 2026-10-11 18:05:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'a3f1c9d47e02'
down_revision: Union[str, Sequence[str], None] = '5786ce495831'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table(
        'magic_tokens',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('token_hash', sa.String(length=64), nullable=False),
        sa.Column('expires_at', sa.DateTime(), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('last_used_at', sa.DateTime(), nullable=True),
        sa.Column('revoked_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
        sa.UniqueConstraint('token_hash'),
    )
    op.create_index(op.f('ix_magic_tokens_id'), 'magic_tokens', ['id'], unique=False)
    op.create_index(op.f('ix_magic_tokens_email'), 'magic_tokens', ['email'], unique=False)
    op.create_index(op.f('ix_magic_tokens_token_hash'), 'magic_tokens', ['token_hash'], unique=True)
    op.create_index(op.f('ix_magic_tokens_expires_at'), 'magic_tokens', ['expires_at'], unique=False)

    # Coarse escalation level so an unchanged condition is not re-alerted hourly,
    # while a genuine worsening still gets through.
    op.add_column(
        'plan_b_alerts',
        sa.Column('severity', sa.Integer(), nullable=False, server_default='1'),
    )
    # Origin URL for news-derived alerts, so one headline alerts a trip once.
    op.add_column('plan_b_alerts', sa.Column('source_url', sa.Text(), nullable=True))


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_column('plan_b_alerts', 'source_url')
    op.drop_column('plan_b_alerts', 'severity')
    op.drop_index(op.f('ix_magic_tokens_expires_at'), table_name='magic_tokens')
    op.drop_index(op.f('ix_magic_tokens_token_hash'), table_name='magic_tokens')
    op.drop_index(op.f('ix_magic_tokens_email'), table_name='magic_tokens')
    op.drop_index(op.f('ix_magic_tokens_id'), table_name='magic_tokens')
    op.drop_table('magic_tokens')
