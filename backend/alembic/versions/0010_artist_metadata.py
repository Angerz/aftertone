"""add artist metadata

Revision ID: 0010_artist_metadata
Revises: 0009_artist_image_filename
Create Date: 2026-09-15
"""

from alembic import op
import sqlalchemy as sa


revision = "0010_artist_metadata"
down_revision = "0009_artist_image_filename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    artist_type = sa.Enum("person", "group", "unknown", name="artisttype")
    op.add_column("artists", sa.Column("artist_type", artist_type, nullable=False, server_default="unknown"))
    op.add_column("artists", sa.Column("country_code", sa.String(length=2), nullable=True))
    op.add_column("artists", sa.Column("birth_date", sa.Date(), nullable=True))
    op.add_column("artists", sa.Column("death_date", sa.Date(), nullable=True))
    op.add_column("artists", sa.Column("formed_year", sa.Integer(), nullable=True))
    op.add_column("artists", sa.Column("dissolved_year", sa.Integer(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("artists") as batch:
        batch.drop_column("dissolved_year")
        batch.drop_column("formed_year")
        batch.drop_column("death_date")
        batch.drop_column("birth_date")
        batch.drop_column("country_code")
        batch.drop_column("artist_type")
