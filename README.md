# 📚 Study Notes

A platform for building, organizing, and versioning your study notes as an
infinitely-nestable tree of topics, with a block-based editor (text, code,
images, links) that supports paste & image upload.

- **Frontend:** React + TypeScript (Vite), BlockNote editor, TanStack Query, Tailwind, dnd-kit
- **Backend:** Python FastAPI (async SQLAlchemy 2.0 + psycopg3), JWT auth
- **Database:** PostgreSQL
- **Migrations:** Alembic

### Features

- **Page-per-note, drill-down cards** — every note is its own page (`/n/:id`) showing its
  content first, then its subtopics as clickable cards. Click a card to drill in; nest forever.
- **Block content** — text, headings, code blocks, images (paste or upload), and links.
- **Versioning** — automatic snapshots on every save + named checkpoints; restore any version.
- **Global search (⌘K)** — searches titles *and* content text (notes, code, link URLs).
- **Tags & filtering** — tag notes; click a tag to search within it.
- **Pin / favourite** — pin notes to the sidebar for quick access.
- **Drag & drop** — drag a card's grip to reorder; drop a card onto another to nest it.
- **Collapsible sidebar** — toggle the tree/pinned/tags sidebar; dark theme throughout.
- **Planner** — roadmaps (ordered milestones) and checklists for the work around studying:
  steps with todo/doing/done status, due dates with overdue/today reminders, progress
  bars, and steps that link straight to the relevant note. A due-now badge on the
  sidebar keeps obligations visible from anywhere.

## Core concepts

| Concept | What it is |
|---|---|
| **Topic** | A node in your notes tree. A *root* topic (no parent) is a top-level "note" with its own title; it nests into sub-topics, recursively, with no depth limit. |
| **Content** | Each topic holds a [BlockNote](https://www.blocknotejs.org/) document (a JSON array of blocks). Add text, headings, code, images (pasted or uploaded), and links. |
| **Version** | A point-in-time snapshot of a topic's title + content. Every content save creates an *automatic* version; you can also flag named **checkpoints** that are kept forever. Restore any version with one click. |
| **File** | Uploaded images/files. Stored as binary in Postgres for now, served by an endpoint, behind a `StorageBackend` interface so it can move to S3 later. |

## Quick start (Docker — recommended)

Requires Docker Desktop.

```bash
cp .env.example .env          # tweak SECRET_KEY etc. if you like
docker compose up --build
```

- Frontend: http://localhost:5173
- API + interactive docs: http://localhost:8000/docs

Tables are created automatically on first boot (`AUTO_CREATE_TABLES=true`).

## Quick start (native / no Docker)

You'll need a running PostgreSQL. The easiest is to start just the DB with Docker:

```bash
docker compose up -d db
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate            # Windows
# source .venv/bin/activate       # macOS/Linux
pip install -r requirements.txt
cp .env.example .env              # uses localhost DB host
python run.py                     # use run.py (not bare uvicorn) — see note below
```

API at http://localhost:8000 — docs at http://localhost:8000/docs.

> **Windows note:** start the backend with `python run.py`, not `uvicorn app.main:app`.
> psycopg's async driver needs the selector event loop; `run.py` selects it before
> the loop is created. (On macOS/Linux either works.)

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

App at http://localhost:5173.

## Database migrations (Alembic)

Tables auto-create on startup for convenience — but `create_all` only creates
*missing tables*; it does **not** add new columns to a table that already exists.
So after changing a model during development, either recreate the database
(`docker compose down -v` — destroys data) or use Alembic migrations.

To manage schema with real migrations, set `AUTO_CREATE_TABLES=false` and use Alembic:

```bash
cd backend
alembic revision --autogenerate -m "initial schema"
alembic upgrade head
```

## API overview

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/auth/register` | Create account, returns JWT |
| `POST` | `/api/auth/login` | Log in, returns JWT |
| `GET`  | `/api/auth/me` | Current user |
| `GET`  | `/api/topics/tree` | Full nested topic tree (titles only) |
| `POST` | `/api/topics` | Create a topic (optionally under a parent) |
| `GET`  | `/api/topics/{id}` | Topic with full content |
| `PATCH`| `/api/topics/{id}` | Update title/content (auto-versions on content change) |
| `POST` | `/api/topics/{id}/move` | Move under a new parent / position |
| `POST` | `/api/topics/reorder` | Reorder siblings |
| `GET`  | `/api/topics/children` | Child cards (omit `parent_id` for top-level notes) |
| `GET`  | `/api/topics/pinned` | Pinned notes |
| `DELETE`| `/api/topics/{id}` | Delete topic + descendants |
| `GET`  | `/api/topics/{id}/versions` | List versions |
| `POST` | `/api/topics/{id}/versions` | Create a named checkpoint |
| `POST` | `/api/versions/{id}/restore` | Restore a version |
| `POST` | `/api/files` | Upload a file (multipart) |
| `GET`  | `/api/files/{id}` | Serve raw file bytes |
| `GET`  | `/api/search?q=&tag=` | Search titles + content (notes, code, links), optional tag |
| `GET`  | `/api/tags` | All tags for the current user |
| `GET`  | `/api/plans` | List plans with progress counts |
| `POST` | `/api/plans` | Create a roadmap or checklist |
| `GET`  | `/api/plans/agenda` | Due/overdue steps (reminders feed) |
| `GET/PATCH/DELETE` | `/api/plans/{id}` | Read, rename/describe, delete a plan |
| `POST` | `/api/plans/{id}/steps` | Add a step (due date, linked note) |
| `PATCH/DELETE` | `/api/plans/steps/{id}` | Update status/title/due/link, delete |
| `POST` | `/api/plans/{id}/steps/reorder` | Reorder steps |

## Project layout

```
study-notes/
├── docker-compose.yml
├── backend/
│   ├── app/
│   │   ├── core/        # config, db, security
│   │   ├── models/      # SQLAlchemy models (User, Topic, Version, FileAsset)
│   │   ├── schemas/     # Pydantic request/response models
│   │   ├── api/routes/  # auth, topics, versions, files
│   │   ├── services/    # storage backend (Postgres → S3 swap point)
│   │   └── main.py
│   └── alembic/         # migrations
└── frontend/
    └── src/
        ├── auth/        # AuthContext + ProtectedRoute
        ├── components/  # TopicTree, NoteEditor, VersionPanel
        ├── pages/       # Login, Register, Workspace
        └── lib/         # axios api client, query client
```

## Notes & known trade-offs

- **File serving is unauthenticated by UUID** (a capability URL) so images render
  in `<img>` tags. Fine for personal use; switch to signed URLs when moving to S3.
- **Files in Postgres** keeps ops simple but grows the DB; the `StorageBackend`
  abstraction in `app/services/storage.py` is the single place to swap in S3.
- Auto-versions are pruned to the most recent `MAX_AUTO_VERSIONS` (default 50);
  named checkpoints are never pruned.
