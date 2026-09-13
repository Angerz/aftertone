"""store optional MusicBrainz release provenance"""

from alembic import op
import sqlalchemy as sa


revision = "0008_musicbrainz_release_id"
down_revision = "0007_artist_active_state"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.add_column(sa.Column("musicbrainz_release_id", sa.String(36), nullable=True))
        batch.create_unique_constraint("uq_albums_musicbrainz_release_id", ["musicbrainz_release_id"])


def downgrade() -> None:
    with op.batch_alter_table("albums") as batch:
        batch.drop_constraint("uq_albums_musicbrainz_release_id", type_="unique")
        batch.drop_column("musicbrainz_release_id")
