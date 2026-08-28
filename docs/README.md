# Docs

Starter documentation for **opencv-cloud**. Keep this folder the source of truth for architecture and operations — not the code comments.

| File | Read when |
| --- | --- |
| [architecture.md](architecture.md) | You need the folder map and request flow |
| [api.md](api.md) | You are calling or changing the backend |
| [models.md](models.md) | You are swapping or redistributing weights |
| [deploy.md](deploy.md) | You are putting this on a cloud platform |

## Local vs cloud

| Surface | Local | Cloud |
| --- | --- | --- |
| Frontend | `npm run dev` in `frontend/` | Vercel, root `frontend/` |
| Backend | `uvicorn` in `backend/` | Container from `infra/Dockerfile.backend` |
| Glue | `API_URL` rewrite | Same env var on Vercel |
| Both | `docker compose -f infra/docker-compose.yml up` | Frontend on Vercel + backend on a container host |
