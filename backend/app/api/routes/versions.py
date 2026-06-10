import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import select

from app.api.deps import CurrentUser, DbSession
from app.models.topic import Topic
from app.models.user import User
from app.models.version import Version
from app.schemas.topic import TopicRead
from app.schemas.version import VersionCreate, VersionRead, VersionSummary
from app.services.versioning import prune_auto_versions, snapshot

router = APIRouter(tags=["versions"])


async def _owned_topic(db: DbSession, user: User, topic_id: uuid.UUID) -> Topic:
    topic = await db.get(Topic, topic_id)
    if topic is None or topic.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


async def _owned_version(db: DbSession, user: User, version_id: uuid.UUID) -> tuple[Version, Topic]:
    version = await db.get(Version, version_id)
    if version is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    topic = await db.get(Topic, version.topic_id)
    if topic is None or topic.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Version not found")
    return version, topic


@router.get("/topics/{topic_id}/versions", response_model=list[VersionSummary])
async def list_versions(
    topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> list[Version]:
    await _owned_topic(db, current_user, topic_id)
    return (
        await db.execute(
            select(Version)
            .where(Version.topic_id == topic_id)
            .order_by(Version.created_at.desc(), Version.id.desc())
        )
    ).scalars().all()


@router.post(
    "/topics/{topic_id}/versions",
    response_model=VersionRead,
    status_code=status.HTTP_201_CREATED,
)
async def create_checkpoint(
    topic_id: uuid.UUID, payload: VersionCreate, current_user: CurrentUser, db: DbSession
) -> Version:
    topic = await _owned_topic(db, current_user, topic_id)
    version = snapshot(topic, label=payload.label or "Checkpoint", is_checkpoint=True)
    db.add(version)
    await db.commit()
    await db.refresh(version)
    return version


@router.get("/versions/{version_id}", response_model=VersionRead)
async def get_version(version_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Version:
    version, _ = await _owned_version(db, current_user, version_id)
    return version


@router.post("/versions/{version_id}/restore", response_model=TopicRead)
async def restore_version(
    version_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> Topic:
    version, topic = await _owned_version(db, current_user, version_id)
    topic.title = version.title_snapshot
    topic.content = version.content_snapshot
    # Record the restore itself as a new automatic version so it's reversible, then prune.
    db.add(snapshot(topic, label=f"Restored from {version.created_at:%Y-%m-%d %H:%M}"))
    await db.flush()
    await prune_auto_versions(db, topic.id)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/versions/{version_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_version(
    version_id: uuid.UUID, current_user: CurrentUser, db: DbSession
) -> None:
    version, _ = await _owned_version(db, current_user, version_id)
    await db.delete(version)
    await db.commit()
