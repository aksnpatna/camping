"""add campsite provenance and source attribute fields

Revision ID: b7d2e5f81c04
Revises: a3f1c9d47e02
Create Date: 2026-10-11 20:35:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = 'b7d2e5f81c04'
down_revision: Union[str, Sequence[str], None] = 'a3f1c9d47e02'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    # Authoritative attributes carried verbatim from the source dataset.
    op.add_column('canonical_campsites', sa.Column('access_type', sa.String(length=50), nullable=True))
    op.add_column('canonical_campsites', sa.Column('lga', sa.String(length=100), nullable=True))
    op.add_column('canonical_campsites', sa.Column('npws_branch', sa.String(length=100), nullable=True))
    op.add_column('canonical_campsites', sa.Column('asset_comments', sa.Text(), nullable=True))
    op.add_column('canonical_campsites', sa.Column('source_modified_at', sa.Date(), nullable=True))

    # Provenance and trust.
    op.add_column('canonical_campsites', sa.Column('evidence_url', sa.Text(), nullable=True))
    op.add_column(
        'canonical_campsites',
        sa.Column(
            'data_status',
            sa.String(length=20),
            nullable=False,
            server_default='unverified',
        ),
    )
    op.add_column('canonical_campsites', sa.Column('verified_at', sa.DateTime(), nullable=True))

    op.create_index(
        op.f('ix_canonical_campsites_source_id'),
        'canonical_campsites',
        ['source_id'],
        unique=False,
    )


def downgrade() -> None:
    """Downgrade schema."""
    op.drop_index(op.f('ix_canonical_campsites_source_id'), table_name='canonical_campsites')
    op.drop_column('canonical_campsites', 'verified_at')
    op.drop_column('canonical_campsites', 'data_status')
    op.drop_column('canonical_campsites', 'evidence_url')
    op.drop_column('canonical_campsites', 'source_modified_at')
    op.drop_column('canonical_campsites', 'asset_comments')
    op.drop_column('canonical_campsites', 'npws_branch')
    op.drop_column('canonical_campsites', 'lga')
    op.drop_column('canonical_campsites', 'access_type')
