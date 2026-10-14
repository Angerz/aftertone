"""Add owner sessions and persistent login throttling, without changing journal data."""

import sqlalchemy as sa

from alembic import op

revision = "0017"
down_revision = "0016_add_album_release_date"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "owner_sessions",
        sa.Column("token_hash", sa.String(64), primary_key=True),
        sa.Column("expires_at", sa.Integer(), nullable=False),
        sa.Column("credential_hash", sa.String(64), nullable=False),
    )
    op.create_index("ix_owner_sessions_expires_at", "owner_sessions", ["expires_at"])
    op.create_table(
        "login_throttle",
        sa.Column("id", sa.Integer(), primary_key=True),
        sa.Column("window_start", sa.Integer(), nullable=False),
        sa.Column("attempts", sa.Integer(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("login_throttle")
    op.drop_table("owner_sessions")
