"""add personal favorite-song ranking

Revision ID: 0011_favorite_song_entries
Revises: 0010_artist_metadata
"""
from alembic import op
import sqlalchemy as sa

revision = "0011_favorite_song_entries"
down_revision = "0010_artist_metadata"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table("favorite_song_entries",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("track_id", sa.Integer(), sa.ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("base_score", sa.Numeric(4, 2), nullable=False), sa.Column("emotional_connection", sa.Numeric(3, 2), nullable=False),
        sa.Column("replay_value", sa.Numeric(3, 2), nullable=False), sa.Column("historical_relevance", sa.Numeric(3, 2), nullable=False), sa.Column("originality", sa.Numeric(3, 2), nullable=False),
        sa.Column("genre", sa.String(100)), sa.Column("notes", sa.Text()), sa.Column("final_score", sa.Numeric(6, 4), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()), sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.UniqueConstraint("track_id", name="uq_favorite_song_track"),
    )


def downgrade() -> None:
    op.drop_table("favorite_song_entries")
