import uuid

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.topic import Topic
from app.models.version import Version


def snapshot(topic: Topic, *, label: str | None = None, is_checkpoint: bool = False) -> Version:
    """Build a Version capturing the topic's current title and content."""
    return Version(
        topic_id=topic.id,
        title_snapshot=topic.title,
        content_snapshot=topic.content,
        label=label,
        is_checkpoint=is_checkpoint,
    )


async def prune_auto_versions(db: AsyncSession, topic_id: uuid.UUID) -> None:
    """Keep only the newest MAX_AUTO_VERSIONS automatic snapshots; never touch checkpoints.

    Call this after adding an automatic snapshot (and flushing it) so the new row is
    included in the ordering.
    """
    stale = (
        await db.execute(
            select(Version.id)
            .where(Version.topic_id == topic_id, Version.is_checkpoint.is_(False))
            .order_by(Version.created_at.desc(), Version.id.desc())
            .offset(settings.MAX_AUTO_VERSIONS)
        )
    ).scalars().all()
    if stale:
        await db.execute(delete(Version).where(Version.id.in_(stale)))
