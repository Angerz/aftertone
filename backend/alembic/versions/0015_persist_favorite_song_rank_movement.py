"""persist per-song favorite rank movement

Revision ID: 0015_persist_favorite_song_rank_movement
Revises: 0014_add_favorite_song_rank_history
"""
from alembic import op
import sqlalchemy as sa


revision = "0015_persist_favorite_song_rank_movement"
down_revision = "0014_add_favorite_song_rank_history"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.add_column(sa.Column("last_rank_from", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("last_rank_to", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("last_rank_changed_at", sa.DateTime(timezone=True), nullable=True))
        batch.drop_column("previous_canonical_position")


def downgrade() -> None:
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.add_column(sa.Column("previous_canonical_position", sa.Integer(), nullable=True))
        batch.drop_column("last_rank_changed_at")
        batch.drop_column("last_rank_to")
        batch.drop_column("last_rank_from")
