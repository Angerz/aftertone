"""add local artist image filename

Revision ID: 0009_artist_image_filename
Revises: 0008_musicbrainz_release_id
Create Date: 2026-09-14
"""

from alembic import op
import sqlalchemy as sa


revision = "0009_artist_image_filename"
down_revision = "0008_musicbrainz_release_id"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("artists", sa.Column("image_filename", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("artists", "image_filename")
