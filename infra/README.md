# Infra

Docker files that wrap the frontend and backend. Run from the **repository root**:

```bash
docker compose -f infra/docker-compose.yml up --build
```

| File | Purpose |
| --- | --- |
| `Dockerfile.backend` | Python 3.12 + OpenCV + Zoo weights baked in |
| `Dockerfile.frontend` | Next.js production server, `API_URL=http://backend:8000` |
| `docker-compose.yml` | Local two-service stack on ports 3000 and 8000 |

Cloud mapping is in [docs/deploy.md](../docs/deploy.md): Vercel does not use these Dockerfiles for the frontend; the backend image is what you push to Cloud Run / Fly / Railway.
