# brainrot-matcher

Point a camera or drop a photo. **Analyze match** scores clothes and vibe against 17 Italian / Indonesian brainrot mascots on-device (no AI credits), then you can save a free sticker mashup or opt into a paid AI brew.

Live app: [https://opencv-cloud.vercel.app](https://opencv-cloud.vercel.app)

```
brainrot-matcher/
├── docs/        architecture, API, models, deploy, character roster
├── frontend/    Next.js matcher (Vercel): OpenCV.js, NanoDet, local score, chants
├── backend/     FastAPI + OpenCV DNN (optional YOLOX stills)
└── infra/       Docker Compose + Dockerfiles
```

## What it does

- Live camera or image upload
- **Analyze match** → on-device percentage + runners-up (NanoDet crop, pose zones, pHash / families / CLIP blend)
- **Ask AI to rerank** → optional, ticketed, rate limited
- Free on-device sticker, or labeled **Brew AI hybrid** (Gateway credits)
- Per-character sting + Italian chant
- Optional OpenCV overlays: faces, objects, edges, gray, blur

This is closest-vibe matching, not identity verification.

## Quick start (frontend only)

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). No Python process is required for matching.

```bash
npm run eval:looks
npm run eval:match
```

## Cloud

- **Live app** → Vercel, root directory `frontend`
- **Optional YOLOX API** → container from `infra/Dockerfile.backend`, then set `API_URL`

Details: [docs/deploy.md](docs/deploy.md), [docs/characters.md](docs/characters.md)

## Docs

| Doc | Contents |
| --- | --- |
| [docs/README.md](docs/README.md) | Index |
| [docs/architecture.md](docs/architecture.md) | How the four folders fit together |
| [docs/api.md](docs/api.md) | Backend HTTP contract |
| [docs/models.md](docs/models.md) | Open-weight models and licenses |
| [docs/integrations.md](docs/integrations.md) | Which models and hosts make the project work |
| [docs/characters.md](docs/characters.md) | Brainrot roster, scoring, and chants |

## License

MIT. Third-party model licenses are listed in [docs/models.md](docs/models.md).
