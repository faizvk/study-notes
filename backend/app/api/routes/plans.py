import uuid

from fastapi import APIRouter, HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.orm import selectinload

from app.api.deps import CurrentUser, DbSession
from app.models.plan import Plan
from app.models.plan_step import PlanStep
from app.models.topic import Topic
from app.models.user import User
from app.schemas.plan import (
    PlanCreate,
    PlanRead,
    PlanSummary,
    PlanUpdate,
    StepRead,
)

router = APIRouter(prefix="/plans", tags=["plans"])


async def _owned_plan(db: DbSession, user: User, plan_id: uuid.UUID, *, with_steps: bool = False) -> Plan:
    stmt = select(Plan).where(Plan.id == plan_id, Plan.owner_id == user.id)
    if with_steps:
        stmt = stmt.options(selectinload(Plan.steps))
    plan = (await db.execute(stmt)).scalar_one_or_none()
    if plan is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


async def _plan_read(db: DbSession, plan: Plan) -> PlanRead:
    """Serialise a plan with steps, resolving linked note titles."""
    topic_ids = [s.topic_id for s in plan.steps if s.topic_id]
    titles: dict[uuid.UUID, str] = {}
    if topic_ids:
        rows = (await db.execute(select(Topic.id, Topic.title).where(Topic.id.in_(topic_ids)))).all()
        titles = {r.id: r.title for r in rows}
    steps = [
        StepRead.model_validate(s).model_copy(update={"topic_title": titles.get(s.topic_id) if s.topic_id else None})
        for s in plan.steps
    ]
    done = sum(1 for s in plan.steps if s.status == "done")
    return PlanRead.model_validate(plan).model_copy(
        update={"steps": steps, "total_steps": len(plan.steps), "done_steps": done}
    )


@router.get("", response_model=list[PlanSummary])
async def list_plans(current_user: CurrentUser, db: DbSession) -> list[PlanSummary]:
    plans = (
        await db.execute(
            select(Plan).where(Plan.owner_id == current_user.id).order_by(Plan.position, Plan.created_at)
        )
    ).scalars().all()
    counts = (
        await db.execute(
            select(
                PlanStep.plan_id,
                func.count().label("total"),
                func.count().filter(PlanStep.status == "done").label("done"),
            )
            .join(Plan, Plan.id == PlanStep.plan_id)
            .where(Plan.owner_id == current_user.id)
            .group_by(PlanStep.plan_id)
        )
    ).all()
    by_plan = {r.plan_id: (r.total, r.done) for r in counts}
    return [
        PlanSummary.model_validate(p).model_copy(
            update={"total_steps": by_plan.get(p.id, (0, 0))[0], "done_steps": by_plan.get(p.id, (0, 0))[1]}
        )
        for p in plans
    ]


@router.post("", response_model=PlanRead, status_code=status.HTTP_201_CREATED)
async def create_plan(payload: PlanCreate, current_user: CurrentUser, db: DbSession) -> PlanRead:
    max_pos = (
        await db.execute(
            select(func.coalesce(func.max(Plan.position), -1)).where(Plan.owner_id == current_user.id)
        )
    ).scalar_one()
    plan = Plan(
        owner_id=current_user.id,
        title=payload.title,
        kind=payload.kind,
        description=payload.description,
        position=int(max_pos) + 1,
    )
    db.add(plan)
    await db.commit()
    plan = await _owned_plan(db, current_user, plan.id, with_steps=True)
    return await _plan_read(db, plan)


@router.get("/{plan_id}", response_model=PlanRead)
async def get_plan(plan_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> PlanRead:
    plan = await _owned_plan(db, current_user, plan_id, with_steps=True)
    return await _plan_read(db, plan)


@router.patch("/{plan_id}", response_model=PlanRead)
async def update_plan(
    plan_id: uuid.UUID, payload: PlanUpdate, current_user: CurrentUser, db: DbSession
) -> PlanRead:
    plan = await _owned_plan(db, current_user, plan_id, with_steps=True)
    if payload.title is not None:
        plan.title = payload.title
    if payload.description is not None:
        plan.description = payload.description
    await db.commit()
    plan = await _owned_plan(db, current_user, plan_id, with_steps=True)
    return await _plan_read(db, plan)


@router.delete("/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_plan(plan_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    plan = await _owned_plan(db, current_user, plan_id)
    await db.delete(plan)
    await db.commit()
