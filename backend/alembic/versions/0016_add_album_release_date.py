"""add optional exact album release date

Revision ID: 0016_add_album_release_date
Revises: 0015_persist_favorite_song_rank_movement
"""
from alembic import op
import sqlalchemy as sa


revision = "0016_add_album_release_date"
down_revision = "0015_persist_favorite_song_rank_movement"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.add_column(sa.Column("release_date", sa.Date(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.drop_column("release_date")
