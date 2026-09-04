"""initial music and rating revision schema"""

from alembic import op
import sqlalchemy as sa

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    release_type = sa.Enum("album", "ep", "mixtape", "compilation", name="releasetype")
    op.create_table(
        "albums",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("artist", sa.String(length=300), nullable=False),
        sa.Column("release_type", release_type, nullable=False),
        sa.Column("release_year", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
    )
    op.create_table(
        "tracks",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("albums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(length=300), nullable=False),
        sa.Column("duration_seconds", sa.Integer(), nullable=True),
        sa.UniqueConstraint("album_id", "position", name="uq_track_album_position"),
    )
    op.create_table(
        "rating_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("album_id", sa.Integer(), sa.ForeignKey("albums.id", ondelete="CASCADE"), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("CURRENT_TIMESTAMP"), nullable=False),
        sa.Column("coherence", sa.Numeric(4, 2), nullable=False),
        sa.Column("coherence_notes", sa.Text(), nullable=True),
        sa.Column("emotion", sa.Numeric(4, 2), nullable=False),
        sa.Column("emotion_notes", sa.Text(), nullable=True),
        sa.Column("album_notes", sa.Text(), nullable=True),
        sa.Column("pre_rating", sa.Numeric(12, 8), nullable=True),
        sa.Column("bad_experience", sa.Numeric(12, 8), nullable=True),
        sa.Column("final_rating", sa.Numeric(12, 8), nullable=True),
        sa.CheckConstraint("coherence >= 0 AND coherence <= 10", name="ck_revision_coherence_range"),
        sa.CheckConstraint("emotion >= 0 AND emotion <= 10", name="ck_revision_emotion_range"),
    )
    op.create_table(
        "track_rating_revisions",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("rating_revision_id", sa.Integer(), sa.ForeignKey("rating_revisions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("track_id", sa.Integer(), sa.ForeignKey("tracks.id", ondelete="RESTRICT"), nullable=False),
        sa.Column("track_title", sa.String(length=300), nullable=False),
        sa.Column("track_position", sa.Integer(), nullable=False),
        sa.Column("score", sa.Numeric(4, 2), nullable=False),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("include_in_pre_rating", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("rating_revision_id", "track_id", name="uq_revision_track"),
        sa.CheckConstraint("score >= 0 AND score <= 10", name="ck_track_rating_score_range"),
    )


def downgrade() -> None:
    op.drop_table("track_rating_revisions")
    op.drop_table("rating_revisions")
    op.drop_table("tracks")
    op.drop_table("albums")
