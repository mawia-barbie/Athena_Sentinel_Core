"""create users table

Revision ID: 001
Revises: 
Create Date: 2026-05-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = '001'
down_revision = None
branch_labels = None
depends_on = None


def upgrade():
    op.create_table(
        'users',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('username', sa.String(64), nullable=False, unique=True, index=True),
        sa.Column('password_hash', sa.String(256), nullable=False),
        sa.Column('bio', sa.String(512), nullable=True),
        sa.Column('profile_image', sa.String(256), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
    )


def downgrade():
    op.drop_table('users')
