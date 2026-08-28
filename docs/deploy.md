# Deploy

The **Vercel production build is the live app**. Webcam + YuNet + filters run entirely in the browser.

## Frontend (Vercel)

- Project: `opencv-cloud` (root directory `frontend`)
- Production: https://opencv-cloud.vercel.app
- No `API_URL` is required. OpenCV.js loads from jsDelivr; YuNet is fetched through `/models/yunet` and cached.

After a push to `main`, Vercel rebuilds automatically.

Camera access needs HTTPS (Vercel) or localhost.

## Optional Python backend

Only required for the **Detect objects** pipeline (YOLOX-S). Set `API_URL` on the Vercel project to the container origin, no trailing slash. Local rewrites still point at `http://127.0.0.1:8000` when not on Vercel.

```bash
docker build -f infra/Dockerfile.backend -t opencv-cloud-api .
docker run --rm -p 8000:8000 opencv-cloud-api
```

## Local

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:3000 and use **Start live camera** or a still image.
