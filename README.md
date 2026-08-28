# opencv-cloud

A small computer-vision starter: **docs**, **frontend**, **backend**, and **infra**.

Upload an image, run an OpenCV pipeline, get boxes and a rendered result. Detection uses open-weight models from the [OpenCV Zoo](https://github.com/opencv/opencv_zoo) (YuNet, YOLOX). Classic filters (edges, grayscale, blur) need no weights.

```
opencv-cloud/
├── docs/        architecture, API, models, deploy
├── frontend/    Next.js app (Vercel)
├── backend/     FastAPI + OpenCV DNN
└── infra/       Docker Compose + Dockerfiles
```

## Quick start (Docker)

```bash
docker compose -f infra/docker-compose.yml up --build
```

- App: [http://localhost:3000](http://localhost:3000)
- API: [http://localhost:8000/health](http://localhost:8000/health)

First backend boot downloads YuNet and YOLOX into `backend/weights/` (cached afterwards).

## Quick start (local)

```bash
# backend
cd backend
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python scripts/download_models.py
uvicorn app.main:app --reload --port 8000

# frontend (second terminal)
cd frontend
npm install
npm run dev
```

The Next.js app proxies `/api/*` to `API_URL` (default `http://127.0.0.1:8000`). See `.env.example`.

## Cloud

- **Frontend** → Vercel, root directory `frontend`, env `API_URL` pointing at the backend.
- **Backend** → any container host (Cloud Run, Fly, Railway). Image is `infra/Dockerfile.backend`.

Details: [docs/deploy.md](docs/deploy.md).

## Docs

| Doc | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Index |
| [docs/architecture.md](docs/architecture.md) | How the four folders fit together |
| [docs/api.md](docs/api.md) | Backend HTTP contract |
| [docs/models.md](docs/models.md) | Open-weight models and licenses |
| [docs/deploy.md](docs/deploy.md) | Vercel + container backend |

## License

MIT. Third-party model licenses are listed in [docs/models.md](docs/models.md).
