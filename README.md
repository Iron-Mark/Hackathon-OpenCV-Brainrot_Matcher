# opencv-cloud

A small computer-vision starter: **docs**, **frontend**, **backend**, and **infra**.

The Vercel build runs **live OpenCV in the browser** and can **match a photo or webcam frame to Italian brainrot characters**. The Python backend is optional (YOLOX stills).

Production: [https://opencv-cloud.vercel.app](https://opencv-cloud.vercel.app)

```
opencv-cloud/
├── docs/        architecture, API, models, deploy
├── frontend/    Next.js + OpenCV.js + NanoDet (Vercel)
├── backend/     FastAPI + OpenCV DNN (optional YOLOX)
└── infra/       Docker Compose + Dockerfiles
```

## Quick start (frontend only)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). Use **Start live camera** or upload a still. No Python process is required for faces / objects / edges / grayscale / blur.

## Quick start (Docker, including YOLOX)

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

- **Live app** → Vercel, root directory `frontend` (OpenCV.js + YuNet + NanoDet, no backend required).
- **Optional API** → container from `infra/Dockerfile.backend`, then set `API_URL` for YOLOX stills.

Details: [docs/deploy.md](docs/deploy.md) and [docs/integrations.md](docs/integrations.md).

## Docs

| Doc | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Index |
| [docs/architecture.md](docs/architecture.md) | How the four folders fit together |
| [docs/api.md](docs/api.md) | Backend HTTP contract |
| [docs/models.md](docs/models.md) | Open-weight models and licenses |
| [docs/integrations.md](docs/integrations.md) | Which models and hosts make the project work |
| [docs/characters.md](docs/characters.md) | Brainrot roster and Analyze matcher |

## License

MIT. Third-party model licenses are listed in [docs/models.md](docs/models.md).
