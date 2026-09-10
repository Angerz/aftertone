"""add active state to artists"""

from alembic import op
import sqlalchemy as sa


revision = "0007_artist_active_state"
down_revision = "0006_multi_disc_albums"
branch_labels = None
depends_on = None


def upgrade() -> None:
    with op.batch_alter_table("artists") as batch:
        batch.add_column(sa.Column("is_active", sa.Boolean(), nullable=False, server_default=sa.true()))


def downgrade() -> None:
    with op.batch_alter_table("artists") as batch:
        batch.drop_column("is_active")
