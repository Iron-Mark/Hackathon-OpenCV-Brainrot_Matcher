# AGENTS.md

## Scope
- OpenCV Cloud Vision / Brainrot Matcher fullstack app (`Iron-Mark/Hackathon-OpenCV-Brainrot_Matcher`, branch `main`).
- Follow root `C:\Codes Local\AGENTS.md` first, then this file. Defer to `frontend/AGENTS.md` when editing inside `frontend/`.

## Project Layout
- `backend/` — Python 3.11/3.12 FastAPI + OpenCV headless + NumPy + Pillow + pytest (`.venv`)
- `frontend/` — Next.js 16 + React 19 (npm, `frontend/AGENTS.md`)
- `infra/` — `Dockerfile.backend`, `Dockerfile.frontend`, `docker-compose.yml`
- `.dockerignore` — excludes build caches, `.venv`, `node_modules`, and `.env*` secrets

## Key Commands
- Backend (`backend/`): `.\.venv\Scripts\python.exe -m pip check`, `.\.venv\Scripts\python.exe -B -m pytest -v`
- Frontend (`frontend/`): `npm run dev`, `npm run build`, `npm run lint`, `npm run test:ai-guard`

## Secrets / Env
- Reference `.env.example` for configuration variable names. Never print or commit `.env*` secrets.
