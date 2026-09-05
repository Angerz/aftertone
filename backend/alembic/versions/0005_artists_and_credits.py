"""make artists and credits structured catalogue metadata"""
from alembic import op
import sqlalchemy as sa

revision = "0005_artists_and_credits"
down_revision = "0004_reconciled_legacy_and_unrated_tracks"
branch_labels = None
depends_on = None


def _normalized(value: str) -> str:
    return " ".join(value.split()).casefold()


def upgrade() -> None:
    op.create_table("artists", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("name", sa.String(300), nullable=False), sa.Column("normalized_name", sa.String(300), nullable=False, unique=True), sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()))
    op.create_table("album_artists", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("album_id", sa.Integer(), sa.ForeignKey("albums.id", ondelete="CASCADE"), nullable=False), sa.Column("artist_id", sa.Integer(), sa.ForeignKey("artists.id", ondelete="RESTRICT"), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.UniqueConstraint("album_id", "artist_id", name="uq_album_artist"), sa.UniqueConstraint("album_id", "position", name="uq_album_artist_position"))
    op.create_table("track_artists", sa.Column("id", sa.Integer(), primary_key=True), sa.Column("track_id", sa.Integer(), sa.ForeignKey("tracks.id", ondelete="CASCADE"), nullable=False), sa.Column("artist_id", sa.Integer(), sa.ForeignKey("artists.id", ondelete="RESTRICT"), nullable=False), sa.Column("role", sa.String(20), nullable=False), sa.Column("position", sa.Integer(), nullable=False), sa.UniqueConstraint("track_id", "artist_id", "role", name="uq_track_artist_role"), sa.UniqueConstraint("track_id", "role", "position", name="uq_track_artist_role_position"))
    bind = op.get_bind()
    albums = bind.execute(sa.text("SELECT id, artist FROM albums")).mappings()
    seen: dict[str, int] = {}
    for album in albums:
        visible = album["artist"]
        normalized = _normalized(visible)
        artist_id = seen.get(normalized)
        if artist_id is None:
            existing = bind.execute(sa.text("SELECT id FROM artists WHERE normalized_name = :name"), {"name": normalized}).scalar()
            artist_id = existing or bind.execute(sa.text("INSERT INTO artists (name, normalized_name) VALUES (:visible, :normalized) RETURNING id"), {"visible": visible, "normalized": normalized}).scalar()
            seen[normalized] = artist_id
        bind.execute(sa.text("INSERT INTO album_artists (album_id, artist_id, position) VALUES (:album_id, :artist_id, 1)"), {"album_id": album["id"], "artist_id": artist_id})
    with op.batch_alter_table("albums") as batch:
        batch.drop_column("artist")


def downgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.add_column(sa.Column("artist", sa.String(300), nullable=True))
    bind = op.get_bind()
    bind.execute(sa.text("UPDATE albums SET artist = (SELECT artists.name FROM album_artists JOIN artists ON artists.id = album_artists.artist_id WHERE album_artists.album_id = albums.id ORDER BY album_artists.position LIMIT 1)"))
    with op.batch_alter_table("albums") as batch:
        batch.alter_column("artist", nullable=False)
    op.drop_table("track_artists")
    op.drop_table("album_artists")
    op.drop_table("artists")
