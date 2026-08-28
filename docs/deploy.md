# Deploy

Target shape: **frontend on Vercel**, **backend as a container**. OpenCV does not belong in a Vercel Function.

## Frontend (Vercel)

- Project root directory: `frontend`
- Framework preset: Next.js
- Environment variable: `API_URL` = public origin of the backend, no trailing slash  
  Example: `https://opencv-cloud-api.fly.dev`

The Next.js rewrite sends `/api/:path*` to `$API_URL/:path*`. After changing `API_URL`, redeploy so the rewrite is rebuilt.

## Backend (container)

Build from the repo root:

```bash
docker build -f infra/Dockerfile.backend -t opencv-cloud-api .
docker run --rm -p 8000:8000 opencv-cloud-api
```

The image downloads models at build time so cold start does not hit Hugging Face.

Any host that runs a Linux container works: Cloud Run, Fly.io, Railway, ECS. Expose port `8000`. Give the process at least ~1 GB RAM for YOLOX-S on CPU.

### Cloud Run sketch

```bash
gcloud run deploy opencv-cloud-api \
  --source . \
  --timeout 60 \
  --memory 1Gi \
  --allow-unauthenticated
```

Point the Dockerfile with `--set-build-env-vars` or a `cloudbuild.yaml` if the host does not auto-detect `infra/Dockerfile.backend`.

## Local parity

```bash
docker compose -f infra/docker-compose.yml up --build
```

Compose sets `API_URL=http://backend:8000` for the frontend build so browser calls to `/api` land on the backend service.
