"""remove historical relevance from favorite-song scores

Revision ID: 0013_simplify_favorite_song_scores
Revises: 0012_add_soundtrack_release_type
"""
from alembic import op
import sqlalchemy as sa
from decimal import Decimal

revision = "0013_simplify_favorite_song_scores"
down_revision = "0012_add_soundtrack_release_type"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, base_score, emotional_connection, replay_value, originality FROM favorite_song_entries")).mappings()
    for row in rows:
        score = Decimal(str(row["base_score"])) * Decimal("0.25") + Decimal(str(row["emotional_connection"])) * Decimal("1.10") + Decimal(str(row["replay_value"])) * Decimal("0.30") + Decimal(str(row["originality"])) * Decimal("0.10")
        bind.execute(sa.text("UPDATE favorite_song_entries SET final_score = :score WHERE id = :id"), {"id": row["id"], "score": str(score)})
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.drop_column("historical_relevance")


def downgrade() -> None:
    with op.batch_alter_table("favorite_song_entries") as batch:
        batch.add_column(sa.Column("historical_relevance", sa.Numeric(3, 2), nullable=False, server_default="0"))
