import uuid

from fastapi import APIRouter, File, HTTPException, Request, Response, UploadFile, status

from app.api.deps import CurrentUser, DbSession
from app.core.config import settings
from app.schemas.file_asset import FileAssetRead
from app.services.storage import storage

router = APIRouter(prefix="/files", tags=["files"])


def _public_url(request: Request, file_id: uuid.UUID) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}{settings.API_PREFIX}/files/{file_id}"


@router.post("", response_model=FileAssetRead, status_code=status.HTTP_201_CREATED)
async def upload_file(
    request: Request,
    current_user: CurrentUser,
    db: DbSession,
    file: UploadFile = File(...),
) -> FileAssetRead:
    data = await file.read()
    if not data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Empty file")
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds the {settings.MAX_UPLOAD_MB} MB limit",
        )
    asset = await storage.save(
        db,
        owner_id=current_user.id,
        filename=file.filename or "upload",
        content_type=file.content_type or "application/octet-stream",
        data=data,
    )
    await db.commit()
    return FileAssetRead(
        id=asset.id,
        filename=asset.filename,
        content_type=asset.content_type,
        size=asset.size,
        created_at=asset.created_at,
        url=_public_url(request, asset.id),
    )


@router.get("/{file_id}")
async def get_file(file_id: uuid.UUID, db: DbSession) -> Response:
    """Serve raw file bytes.

    Intentionally unauthenticated so the bytes can be referenced directly from
    ``<img src>`` tags in the editor. The unguessable UUID acts as a capability
    token. Swap to signed URLs / S3 pre-signed links when moving off Postgres.
    """
    asset = await storage.get(db, file_id=file_id)
    if asset is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return Response(
        content=asset.data,
        media_type=asset.content_type,
        headers={
            "Cache-Control": "public, max-age=31536000, immutable",
            "Content-Disposition": f'inline; filename="{asset.filename}"',
        },
    )


@router.delete("/{file_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_file(file_id: uuid.UUID, current_user: CurrentUser, db: DbSession) -> None:
    deleted = await storage.delete(db, owner_id=current_user.id, file_id=file_id)
    if not deleted:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    await db.commit()
