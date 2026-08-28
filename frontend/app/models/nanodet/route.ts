const NANODET_URL =
  "https://huggingface.co/opencv/object_detection_nanodet/resolve/main/object_detection_nanodet_2022nov_int8.onnx";

export async function GET() {
  const upstream = await fetch(NANODET_URL, {
    headers: { "user-agent": "opencv-cloud/0.1" },
    next: { revalidate: 86400 },
  });
  if (!upstream.ok) {
    return new Response("Failed to fetch NanoDet weights", { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      "content-type": "application/octet-stream",
      "cache-control": "public, max-age=86400, immutable",
    },
  });
}
