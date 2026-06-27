"""Entrypoint that guarantees a psycopg-compatible event loop on Windows.

uvicorn only switches to the selector loop on Windows when it spawns a subprocess
(i.e. with --reload). Running without reload (e.g. in production) would otherwise
leave the default ProactorEventLoop, which psycopg's async mode cannot use. Setting
the policy here — before uvicorn creates the loop — makes every mode work.

Use this for native runs:  python run.py
"""
import asyncio
import os
import sys

if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

import uvicorn  # noqa: E402

from app.core.config import settings  # noqa: E402

if __name__ == "__main__":
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        # Hosts like Render/Koyeb inject the port to bind via $PORT.
        port=int(os.environ.get("PORT", "8000")),
        reload=settings.ENVIRONMENT == "development",
        # Behind the platform's proxy: trust X-Forwarded-* so request URLs (and
        # the absolute file URLs we build) use the public https origin.
        proxy_headers=True,
        forwarded_allow_ips="*",
    )
