from fastapi import APIRouter, Query
from sqlalchemy import func, or_, select

from app.api.deps import CurrentUser, DbSession
from app.models.topic import Topic
from app.schemas.topic import SearchResult
from app.services.search import make_snippet

router = APIRouter(tags=["search"])


@router.get("/search", response_model=list[SearchResult])
async def search(
    current_user: CurrentUser,
    db: DbSession,
    q: str = Query(default="", max_length=200),
    tag: str | None = None,
    limit: int = Query(default=50, ge=1, le=200),
) -> list[SearchResult]:
    """Search the current user's notes by title + content text, optionally by tag."""
    q = q.strip()
    stmt = select(Topic).where(Topic.owner_id == current_user.id)
    if q:
        # Escape LIKE wildcards so e.g. "_" or "100%" match literally.
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        like = f"%{escaped}%"
        stmt = stmt.where(
            or_(
                Topic.title.ilike(like, escape="\\"),
                Topic.search_text.ilike(like, escape="\\"),
            )
        )
    if tag:
        stmt = stmt.where(Topic.tags.any(tag))
    stmt = stmt.order_by(Topic.is_pinned.desc(), Topic.updated_at.desc()).limit(limit)

    topics = (await db.execute(stmt)).scalars().all()
    results: list[SearchResult] = []
    for t in topics:
        if q and q.lower() in t.title.lower():
            matched_in, snippet = "title", ""
        elif q:
            matched_in, snippet = "content", make_snippet(t.search_text, q)
        else:
            matched_in, snippet = "title", (t.search_text or "")[:120]
        results.append(
            SearchResult(
                id=t.id,
                parent_id=t.parent_id,
                title=t.title,
                snippet=snippet,
                matched_in=matched_in,
                tags=list(t.tags or []),
                is_pinned=t.is_pinned,
            )
        )
    return results


@router.get("/tags", response_model=list[str])
async def list_tags(current_user: CurrentUser, db: DbSession) -> list[str]:
    rows = (
        await db.execute(
            select(func.unnest(Topic.tags)).where(Topic.owner_id == current_user.id).distinct()
        )
    ).scalars().all()
    return sorted(r for r in rows if r)
