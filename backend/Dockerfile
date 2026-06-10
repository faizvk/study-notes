FROM python:3.12-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install dependencies first to leverage Docker layer caching.
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# Run DB migrations, then start the API via run.py (sets a psycopg-compatible
# event loop; enables autoreload in development). A migration failure is loudly
# warned but non-fatal because dev relies on AUTO_CREATE_TABLES; set
# AUTO_CREATE_TABLES=false in production so schema problems surface immediately.
CMD ["sh", "-c", "alembic upgrade head || echo 'WARNING: alembic upgrade failed — relying on AUTO_CREATE_TABLES'; python run.py"]
