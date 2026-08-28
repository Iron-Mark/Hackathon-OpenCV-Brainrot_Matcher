const YUNET_URL =
  "https://huggingface.co/opencv/face_detection_yunet/resolve/main/face_detection_yunet_2023mar.onnx";

export async function GET() {
  const upstream = await fetch(YUNET_URL, {
    headers: { "user-agent": "opencv-cloud/0.1" },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) {
    return new Response("Failed to fetch YuNet weights", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
