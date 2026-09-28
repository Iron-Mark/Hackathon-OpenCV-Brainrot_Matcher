# Deploy

The **Vercel production build is the live app**. Webcam + YuNet + NanoDet + filters run entirely in the browser.

## Frontend (Vercel)

- GitHub repo: `brainrot-matcher` (formerly `opencv-cloud`)
- Vercel project: `opencv-cloud` (root directory `frontend`) — keep this name so the live URL stays https://opencv-cloud.vercel.app
- Production: https://opencv-cloud.vercel.app
- No `API_URL` is required. OpenCV.js and onnxruntime-web load from jsDelivr; YuNet and NanoDet are fetched through `/models/*` and cached.

After a push to `main`, Vercel rebuilds automatically.

Camera access needs HTTPS (Vercel) or localhost.

## Optional Python backend

Only required if you want **YOLOX-S** on still uploads (higher accuracy than in-browser NanoDet). Set `API_URL` on the Vercel project to the container origin, no trailing slash. Local rewrites still point at `http://127.0.0.1:8000` when not on Vercel.

```bash
docker build -f infra/Dockerfile.backend -t opencv-cloud-api .
docker run --rm -p 8000:8000 \
  -e BACKEND_API_TOKEN='<at-least-32-random-characters>' \
  -e BACKEND_CORS_ORIGINS='https://opencv-cloud.vercel.app' \
  opencv-cloud-api
```

Suggested hosts: Fly.io, Railway (Dockerfile, not Nixpacks), Cloud Run, Hugging Face Spaces (Docker). Give the container **≥ 1 GB RAM**. Keep the service private when the host supports it. If it must be public, configure a strong `BACKEND_API_TOKEN`, pass it only from a trusted server, and set `BACKEND_CORS_ORIGINS` to exact origins. The process route rejects compressed uploads above 8 MB or decoded images above 2,073,600 pixels.

## Local

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 and use **Start live camera** or a still image.
