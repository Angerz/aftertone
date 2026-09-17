"""add favorite-song rank movement and active Top 100 tenure

Revision ID: 0014_add_favorite_song_rank_history
Revises: 0013_simplify_favorite_song_scores
"""
from datetime import datetime, timezone
from decimal import Decimal

from alembic import op
import sqlalchemy as sa


revision = "0014_add_favorite_song_rank_history"
down_revision = "0013_simplify_favorite_song_scores"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.add_column(sa.Column("previous_canonical_position", sa.Integer(), nullable=True))
        batch.add_column(sa.Column("top_100_entered_at", sa.DateTime(timezone=True), nullable=True))

    bind = op.get_bind()
    rows = bind.execute(sa.text("""
        SELECT favorite_song_entries.id, favorite_song_entries.created_at,
               favorite_song_entries.final_score, favorite_song_entries.emotional_connection,
               favorite_song_entries.replay_value, favorite_song_entries.base_score,
               favorite_song_entries.originality, tracks.title
        FROM favorite_song_entries
        JOIN tracks ON tracks.id = favorite_song_entries.track_id
    """)).mappings()
    ranked = sorted(rows, key=lambda row: (
        -Decimal(str(row["final_score"])), -Decimal(str(row["emotional_connection"])),
        -Decimal(str(row["replay_value"])), -Decimal(str(row["base_score"])),
        -Decimal(str(row["originality"])), row["title"].casefold(),
    ))
    activation_time = datetime.now(timezone.utc)
    for position, row in enumerate(ranked, 1):
        if position <= 100:
            bind.execute(sa.text("""
                UPDATE favorite_song_entries
                SET previous_canonical_position = :position,
                    top_100_entered_at = :entered_at
                WHERE id = :id
            """), {"id": row["id"], "position": position, "entered_at": row["created_at"] or activation_time})


def downgrade() -> None:
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.drop_column("top_100_entered_at")
        batch.drop_column("previous_canonical_position")
