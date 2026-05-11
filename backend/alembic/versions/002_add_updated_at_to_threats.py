"""add updated_at to threats

Revision ID: 002_add_updated_at_to_threats
Revises: 001
Create Date: 2026-05-11 12:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '002_add_updated_at_to_threats'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # add updated_at column with default now()
    op.add_column('threats', sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False))

    # create function and trigger to auto-update 'updated_at' on row UPDATE
    op.execute("""
    CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ language 'plpgsql';
    """)

    op.execute("""
    CREATE TRIGGER update_threats_updated_at
    BEFORE UPDATE ON threats
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
    """)


def downgrade():
    # drop trigger and function, then drop column
    op.execute("DROP TRIGGER IF EXISTS update_threats_updated_at ON threats;")
    op.execute("DROP FUNCTION IF EXISTS update_updated_at_column();")
    op.drop_column('threats', 'updated_at')
