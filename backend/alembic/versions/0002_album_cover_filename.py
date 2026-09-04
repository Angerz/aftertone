"""add album cover storage key"""

from alembic import op
import sqlalchemy as sa

revision = "0002_album_cover_filename"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("albums", sa.Column("cover_filename", sa.String(length=100), nullable=True))


def downgrade() -> None:
    op.drop_column("albums", "cover_filename")
