"""support reconciled legacy revisions and unrated snapshot tracks"""
from alembic import op
import sqlalchemy as sa
revision = "0004_reconciled_legacy_and_unrated_tracks"
down_revision = "0003_legacy_ratings_and_revisit"
branch_labels = None
depends_on = None
def upgrade() -> None:
    with op.batch_alter_table("track_rating_revisions") as batch:
        batch.alter_column("score", existing_type=sa.Numeric(4, 2), nullable=True)
    with op.batch_alter_table("legacy_ratings") as batch:
        batch.add_column(sa.Column("reconciled_revision_id", sa.Integer(), nullable=True))
        batch.create_foreign_key("fk_legacy_reconciled_revision", "rating_revisions", ["reconciled_revision_id"], ["id"], ondelete="RESTRICT")
def downgrade() -> None:
    with op.batch_alter_table("legacy_ratings") as batch:
        batch.drop_constraint("fk_legacy_reconciled_revision", type_="foreignkey")
        batch.drop_column("reconciled_revision_id")
    with op.batch_alter_table("track_rating_revisions") as batch:
        batch.alter_column("score", existing_type=sa.Numeric(4, 2), nullable=False)
