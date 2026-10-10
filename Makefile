.PHONY: dev-frontend dev-backend test-backend db-migrate

dev-frontend:
	cd frontend && npm run dev

dev-backend:
	cd backend && . venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port 8021

test-backend:
	cd backend && . venv/bin/activate && pytest

db-migrate:
	cd backend && . venv/bin/activate && alembic upgrade head
