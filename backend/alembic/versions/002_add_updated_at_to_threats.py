"""create threats table

Revision ID: 002_create_threats_table
Revises: 001
Create Date: 2026-05-14 17:40:00.000000
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = '002_add_updated_at_to_threats'
down_revision = '001'
branch_labels = None
depends_on = None


def upgrade():
    # create threats table
    op.create_table(
        'threats',
        sa.Column('id', sa.Integer, primary_key=True),
        sa.Column('external_id', sa.String(128), nullable=True),
        sa.Column('title', sa.String(256), nullable=False),
        sa.Column('description', sa.String(2048), nullable=True),
        sa.Column('type', sa.String(64), nullable=False),
        sa.Column('severity', sa.String(16), nullable=False),
        sa.Column('source', sa.String(128), nullable=True),
        sa.Column('url', sa.String(512), nullable=True),
        sa.Column('tags', postgresql.JSONB, nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=False),
    )

    # indexes
    op.create_index('ix_threats_external_id', 'threats', ['external_id'], unique=False)
    op.create_index('ix_threats_type_severity', 'threats', ['type', 'severity'], unique=False)


def downgrade():
    op.drop_index('ix_threats_type_severity', table_name='threats')
    op.drop_index('ix_threats_external_id', table_name='threats')
    op.drop_table('threats')
