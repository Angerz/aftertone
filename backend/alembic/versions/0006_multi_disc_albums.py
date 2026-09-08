"""add first-class multi-disc album support"""

from alembic import op
import sqlalchemy as sa


revision = "0006_multi_disc_albums"
down_revision = "0005_artists_and_credits"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.add_column(sa.Column("disc_count", sa.Integer(), nullable=False, server_default="1"))
        batch.create_check_constraint("ck_album_disc_count_positive", "disc_count >= 1")
    with op.batch_alter_table("tracks") as batch:
        batch.add_column(sa.Column("disc_number", sa.Integer(), nullable=False, server_default="1"))
        batch.drop_constraint("uq_track_album_position", type_="unique")
        batch.create_unique_constraint("uq_track_album_disc_position", ["album_id", "disc_number", "position"])
        batch.create_check_constraint("ck_track_disc_number_positive", "disc_number >= 1")
        batch.create_check_constraint("ck_track_position_positive", "position >= 1")
    with op.batch_alter_table("track_rating_revisions") as batch:
        batch.add_column(sa.Column("disc_number", sa.Integer(), nullable=False, server_default="1"))


def downgrade() -> None:
    bind = op.get_bind()
    rows = bind.execute(sa.text("SELECT id, album_id FROM tracks ORDER BY album_id, disc_number, position, id")).mappings()
    position_by_album: dict[int, int] = {}
    for row in rows:
        position = position_by_album.get(row["album_id"], 0) + 1
        position_by_album[row["album_id"]] = position
        bind.execute(sa.text("UPDATE tracks SET position = :position WHERE id = :id"), {"position": position, "id": row["id"]})
    with op.batch_alter_table("track_rating_revisions") as batch:
        batch.drop_column("disc_number")
    with op.batch_alter_table("tracks") as batch:
        batch.drop_constraint("ck_track_disc_number_positive", type_="check")
        batch.drop_constraint("ck_track_position_positive", type_="check")
        batch.drop_constraint("uq_track_album_disc_position", type_="unique")
        batch.create_unique_constraint("uq_track_album_position", ["album_id", "position"])
        batch.drop_column("disc_number")
    with op.batch_alter_table("albums") as batch:
        batch.drop_constraint("ck_album_disc_count_positive", type_="check")
        batch.drop_column("disc_count")
