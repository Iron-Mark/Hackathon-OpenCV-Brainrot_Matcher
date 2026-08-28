# Docs

Starter documentation for **opencv-cloud**. Keep this folder the source of truth for architecture and operations — not the code comments.

| File | Read when |
| --- | --- |
| [architecture.md](architecture.md) | You need the folder map and request flow |
| [api.md](api.md) | You are calling or changing the backend |
| [models.md](models.md) | You are swapping or redistributing weights |
| [integrations.md](integrations.md) | You need a model + backend that can actually run on Vercel or a container |
| [characters.md](characters.md) | Brainrot roster, Wikimedia stills, Analyze scoring |

## Local vs cloud

| Surface | Local | Cloud |
| --- | --- | --- |
| Live camera / stills (faces, objects, filters) | `npm run dev` in `frontend/` | Vercel production (OpenCV.js + YuNet + NanoDet) |
| YOLOX object stills | `uvicorn` in `backend/` | Optional container + `API_URL` |
| Both | `docker compose -f infra/docker-compose.yml up` | Frontend on Vercel; backend only if you want YOLOX |
