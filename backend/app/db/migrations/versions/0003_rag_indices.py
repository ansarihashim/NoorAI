"""rag_indices — persistent FAISS storage for ephemeral hosts.

On hosts without a persistent disk (Render free, Fly free, etc.) the local
storage/rag/{doc_id}/ tree gets wiped on every redeploy. Mirroring the FAISS
bytes + chunks + page-meta into Postgres means an uploaded document remains
queryable after a cold-start, without the user having to re-upload.

Revision ID: 0003_rag_indices
Revises: 0002_user_password
"""
from alembic import op
import sqlalchemy as sa


revision = "0003_rag_indices"
down_revision = "0002_user_password"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rag_indices",
        sa.Column("doc_id",      sa.String(length=32), primary_key=True),
        sa.Column("index_bytes", sa.LargeBinary(),     nullable=False),
        sa.Column("chunks_json", sa.Text(),            nullable=False),
        sa.Column("meta_json",   sa.Text(),            nullable=False),
        sa.Column("updated_at",  sa.DateTime(timezone=True),
                  server_default=sa.text("now()"), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("rag_indices")
