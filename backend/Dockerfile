FROM python:3.12-slim

WORKDIR /app

RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Run unprivileged: a compromised API process must not be root in the container.
RUN useradd --system --uid 10001 --no-create-home appuser && chown -R appuser /app
USER appuser

EXPOSE 8021

# One worker keeps the in-process rate limiter exact (sync routes already run in a
# thread pool). --limit-concurrency sheds load with 503 instead of exhausting the
# box; short keep-alive and timeouts drop slow-loris style connections.
CMD ["sh", "-c", "alembic upgrade head && exec uvicorn app.main:app --host 0.0.0.0 --port 8021 --workers 1 --limit-concurrency 200 --backlog 256 --timeout-keep-alive 5 --no-server-header --no-proxy-headers"]
