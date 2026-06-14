import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import delete, func, select

from app.api.deps import CurrentUser, DbSession
from app.models.topic import Topic
from app.models.user import User
from app.schemas.topic import (
    TopicCard,
    TopicCreate,
    TopicMove,
    TopicNode,
    TopicRead,
    TopicReorder,
    TopicUpdate,
)
from app.services.search import extract_search_text
from app.services.versioning import prune_auto_versions, snapshot

router = APIRouter(prefix="/topics", tags=["topics"])


# ───────────────────────── helpers ─────────────────────────


async def _get_owned_topic(db: DbSession, user: User, topic_id: uuid.UUID) -> Topic:
    topic = await db.get(Topic, topic_id)
    if topic is None or topic.owner_id != user.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    return topic


async def _next_position(db: DbSession, owner_id: uuid.UUID, parent_id: uuid.UUID | None) -> int:
    stmt = select(func.coalesce(func.max(Topic.position), -1)).where(Topic.owner_id == owner_id)
    stmt = stmt.where(Topic.parent_id.is_(None) if parent_id is None else Topic.parent_id == parent_id)
    return int((await db.execute(stmt)).scalar_one()) + 1


async def _is_descendant(db: DbSession, *, ancestor_id: uuid.UUID, node_id: uuid.UUID) -> bool:
    """True if ``ancestor_id`` lies on the parent chain above ``node_id`` (inclusive)."""
    current: uuid.UUID | None = node_id
    while current is not None:
        if current == ancestor_id:
            return True
        current = (
            await db.execute(select(Topic.parent_id).where(Topic.id == current))
        ).scalar_one_or_none()
    return False


async def _to_cards(db: DbSession, topics: list[Topic]) -> list[TopicCard]:
    """Build card DTOs for a set of topics, including their direct-child counts."""
    ids = [t.id for t in topics]
    counts: dict[uuid.UUID, int] = {}
    if ids:
        rows = (
            await db.execute(
                select(Topic.parent_id, func.count())
                .where(Topic.parent_id.in_(ids))
                .group_by(Topic.parent_id)
            )
        ).all()
        counts = {pid: count for pid, count in rows}
    return [
        TopicCard(
            id=t.id,
            parent_id=t.parent_id,
            title=t.title,
            position=t.position,
            is_pinned=t.is_pinned,
            tags=list(t.tags or []),
            child_count=counts.get(t.id, 0),
            preview=(t.search_text or "")[:160],
            updated_at=t.updated_at,
        )
        for t in topics
    ]


# ───────────────────────── routes ─────────────────────────


@router.get("/tree", response_model=list[TopicNode])
async def get_tree(current_user: CurrentUser, db: DbSession) -> list[TopicNode]:
    """Return the full topic tree for the current user (titles only, no content)."""
    rows = (
        await db.execute(
            select(Topic.id, Topic.parent_id, Topic.title, Topic.position, Topic.is_pinned)
            .where(Topic.owner_id == current_user.id)
            .order_by(Topic.parent_id, Topic.position)
        )
    ).all()

    nodes: dict[uuid.UUID, TopicNode] = {
        r.id: TopicNode(
            id=r.id, parent_id=r.parent_id, title=r.title, position=r.position, is_pinned=r.is_pinned
        )
        for r in rows
    }
    roots: list[TopicNode] = []
    for r in rows:
        node = nodes[r.id]
        if r.parent_id is None:
            roots.append(node)
        elif (parent := nodes.get(r.parent_id)) is not None:
            parent.children.append(node)
    roots.sort(key=lambda n: n.position)
    return roots


@router.post("", response_model=TopicRead, status_code=status.HTTP_201_CREATED)
async def create_topic(payload: TopicCreate, current_user: CurrentUser, db: DbSession) -> Topic:
    if payload.parent_id is not None:
        await _get_owned_topic(db, current_user, payload.parent_id)  # validate parent ownership
    position = (
        payload.position
        if payload.position is not None
        else await _next_position(db, current_user.id, payload.parent_id)
    )
    topic = Topic(
        owner_id=current_user.id,
        parent_id=payload.parent_id,
        title=payload.title,
        position=position,
        content=[],
    )
    db.add(topic)
    await db.commit()
    await db.refresh(topic)
    return topic


@router.post("/reorder", status_code=status.HTTP_204_NO_CONTENT)
async def reorder_topics(payload: TopicReorder, current_user: CurrentUser, db: DbSession) -> None:
    """Reassign sibling positions under ``parent_id`` to match ``ordered_ids``."""
    if payload.parent_id is not None:
        await _get_owned_topic(db, current_user, payload.parent_id)
    topics = (
        await db.execute(
            select(Topic).where(
                Topic.id.in_(payload.ordered_ids), Topic.owner_id == current_user.id
            )
        )
    ).scalars().all()
    by_id = {t.id: t for t in topics}
    # The payload must list the parent's children exactly once each, so reordering
    # can't leave unlisted siblings with stale positions or accept duplicates.
    existing = (
        await db.execute(
            select(Topic.id).where(
                Topic.owner_id == current_user.id,
                Topic.parent_id.is_(None)
                if payload.parent_id is None
                else Topic.parent_id == payload.parent_id,
            )
        )
    ).scalars().all()
    if set(payload.ordered_ids) != set(existing) or len(payload.ordered_ids) != len(existing):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="ordered_ids must list every sibling under the parent exactly once",
        )
    for index, tid in enumerate(payload.ordered_ids):
        # Reparenting must go through /move (which does cycle detection); reorder
        # only rearranges existing siblings.
        by_id[tid].position = index
    await db.commit()


@router.get("/children", response_model=list[TopicCard])
async def list_children(
    current_user: CurrentUser, db: DbSession, parent_id: uuid.UUID | None = None
) -> list[TopicCard]:
    """List direct children as cards. Omit ``parent_id`` for top-level notes."""
    if parent_id is not None:
        await _get_owned_topic(db, current_user, parent_id)
    stmt = select(Topic).where(Topic.owner_id == current_user.id)
    stmt = stmt.where(Topic.parent_id.is_(None) if parent_id is None else Topic.parent_id == parent_id)
    topics = (await db.execute(stmt.order_by(Topic.position))).scalars().all()
    return await _to_cards(db, list(topics))


@router.get("/pinned", response_model=list[TopicCard])
async def list_pinned(current_user: CurrentUser, db: DbSession) -> list[TopicCard]:
    topics = (
        await db.execute(
            select(Topic)
            .where(Topic.owner_id == current_user.id, Topic.is_pinned.is_(True))
            .order_by(Topic.updated_at.desc())
        )
    ).scalars().all()
    return await _to_cards(db, list(topics))


@router.get("/{topic_id}", response_model=TopicRead)
async def get_topic(topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> Topic:
    return await _get_owned_topic(db, current_user, topic_id)


@router.patch("/{topic_id}", response_model=TopicRead)
async def update_topic(
    topic_id: uuid.UUID, payload: TopicUpdate, current_user: CurrentUser, db: DbSession
) -> Topic:
    topic = await _get_owned_topic(db, current_user, topic_id)
    content_changed = payload.content is not None and payload.content != topic.content

    if payload.title is not None:
        topic.title = payload.title
    if payload.tags is not None:
        topic.tags = payload.tags
    if payload.is_pinned is not None:
        topic.is_pinned = payload.is_pinned
    if payload.content is not None:
        topic.content = payload.content
        topic.search_text = extract_search_text(payload.content)

    # Every content save is recorded as an automatic version (Google-Docs style history).
    if content_changed:
        db.add(snapshot(topic))
        await db.flush()
        await prune_auto_versions(db, topic.id)

    await db.commit()
    await db.refresh(topic)
    return topic


@router.delete("/{topic_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_topic(topic_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    # Descendants and versions are removed via ON DELETE CASCADE at the DB level.
    result = await db.execute(
        delete(Topic).where(Topic.id == topic_id, Topic.owner_id == current_user.id)
    )
    if result.rowcount == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Topic not found")
    await db.commit()


@router.post("/{topic_id}/move", response_model=TopicRead)
async def move_topic(
    topic_id: uuid.UUID, payload: TopicMove, current_user: CurrentUser, db: DbSession
) -> Topic:
    topic = await _get_owned_topic(db, current_user, topic_id)
    if payload.parent_id is not None:
        if payload.parent_id == topic.id:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="A topic cannot be its own parent")
        await _get_owned_topic(db, current_user, payload.parent_id)
        if await _is_descendant(db, ancestor_id=topic.id, node_id=payload.parent_id):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot move a topic into its own descendant",
            )
    topic.parent_id = payload.parent_id
    topic.position = payload.position
    await db.commit()
    await db.refresh(topic)
    return topic
