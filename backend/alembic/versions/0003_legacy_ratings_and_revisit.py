"""add legacy ratings and album revisit state"""

from alembic import op
import sqlalchemy as sa

revision = "0003_legacy_ratings_and_revisit"
down_revision = "0002_album_cover_filename"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("albums", sa.Column("needs_revisit", sa.Boolean(), nullable=False, server_default=sa.false()))
    op.add_column("albums", sa.Column("revisit_reason", sa.Text(), nullable=True))
    op.add_column("albums", sa.Column("revisit_marked_at", sa.DateTime(timezone=True), nullable=True))
    op.create_table(
        "legacy_ratings",
        sa.Column("id", sa.Integer(), primary_key=True), sa.Column("album_id", sa.Integer(), sa.ForeignKey("albums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("legacy_final_rating", sa.Numeric(12, 8)), sa.Column("legacy_pre_rating", sa.Numeric(12, 8)), sa.Column("legacy_bad_experience", sa.Numeric(12, 8)),
        sa.Column("coherence", sa.Numeric(4, 2), nullable=False), sa.Column("emotion", sa.Numeric(4, 2), nullable=False), sa.Column("extracted_scores", sa.JSON(), nullable=False), sa.Column("pre_formula", sa.Text(), nullable=False),
        sa.Column("computed_pre_rating", sa.Numeric(12, 8)), sa.Column("computed_bad_experience", sa.Numeric(12, 8)), sa.Column("computed_final_rating", sa.Numeric(12, 8)),
        sa.Column("source", sa.String(100), nullable=False), sa.Column("reconciliation_status", sa.String(20), nullable=False), sa.Column("legacy_decade", sa.String(30)), sa.Column("legacy_genre", sa.String(300)), sa.Column("imported_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("legacy_ratings")
    op.drop_column("albums", "revisit_marked_at")
    op.drop_column("albums", "revisit_reason")
    op.drop_column("albums", "needs_revisit")
