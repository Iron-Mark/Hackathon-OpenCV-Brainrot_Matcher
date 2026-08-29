#!/usr/bin/env python3
"""Download roster stills and write public/assets/gallery-feat.json."""

from __future__ import annotations

import io
import json
import math
import time
import urllib.parse
import urllib.request
from pathlib import Path

from PIL import Image

SIZE = 160
H_BINS = 18
S_BINS = 10
GRID = 2
PROF_BINS = 32
ROOT = Path(__file__).resolve().parents[1]
STILLS = ROOT / "public/assets/brainrot"
OUT = ROOT / "public/assets/gallery-feat.json"

COMMONS = {
    "tralalero-tralala": "Tralalero Tralala.webp",
    "tung-tung-tung-sahur": "Full image of Tung Tung Tung Sahur.png",
    "bombardiro-crocodilo": "Bombardiro Crocodillo.jpg",
    "bombombini-gusini": "Bombini Gusini.webp",
    "brr-brr-patapim": "Brr brr patapim.jpg",
    "lirili-larila": "Lirilì Larilà.webp",
    "cappuccino-assassino": "Cappucino assasino.webp",
    "ballerina-cappuccina": "Ballerina Cappuccina.png",
    "chimpanzini-bananini": "ChimpanziniBananini.webp",
    "boneca-ambalabu": "Boneca Ambalabu.jpg",
    "trippi-troppi": "Trippi Troppi Italian brainrot.png",
    "frigo-camelo": "Frigo Camelo.png",
    "giraffa-celeste": "Giraffa Celeste.jpg",
    "udin-din-din-dun": "Udin din din din dun.jpg",
    "ecco-cavallo-virtuoso": "Ecco Cavallo Virtuoso.webp",
    "frulli-frulla": "Frulli Frulla.jpg",
    "merluzzini-marraquetini": "Merluzzini Marraquetini.png",
}


def rgb_to_hsv(r: float, g: float, b: float) -> tuple[float, float, float]:
    rr, gg, bb = r / 255.0, g / 255.0, b / 255.0
    mx = max(rr, gg, bb)
    mn = min(rr, gg, bb)
    d = mx - mn
    h = 0.0
    if d:
        if mx == rr:
            h = ((gg - bb) / d) % 6
        elif mx == gg:
            h = (bb - rr) / d + 2
        else:
            h = (rr - gg) / d + 4
        h /= 6
        if h < 0:
            h += 1
    s = 0.0 if mx == 0 else d / mx
    return h, s, mx


def near_white(r: float, g: float, b: float, sat: float) -> bool:
    return r > 232 and g > 232 and b > 232 and sat < 0.14


def download(cid: str, name: str) -> Path:
    STILLS.mkdir(parents=True, exist_ok=True)
    dest = STILLS / f"{cid}.jpg"
    if dest.exists() and dest.stat().st_size > 1000:
        return dest
    url = "https://commons.wikimedia.org/wiki/Special:FilePath/" + urllib.parse.quote(name) + "?width=256"
    last_err: Exception | None = None
    for attempt in range(6):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "opencv-cloud-gallery/0.1 (eval; +https://opencv-cloud.vercel.app)"})
            with urllib.request.urlopen(req, timeout=30) as res:
                data = res.read()
            im = Image.open(io.BytesIO(data)).convert("RGB")
            im.thumbnail((256, 256))
            im.save(dest, "JPEG", quality=86)
            return dest
        except Exception as err:
            last_err = err
            time.sleep(2 ** attempt)
    raise RuntimeError(f"download failed {cid}: {last_err}")


def corner_mean(pix, w, h):
    s = min(14, w // 6, h // 6) or 1
    acc = [0.0, 0.0, 0.0]
    n = 0
    for x0, y0 in ((0, 0), (w - s, 0), (0, h - s), (w - s, h - s)):
        for y in range(y0, y0 + s):
            for x in range(x0, x0 + s):
                r, g, b = pix[y * w + x]
                acc[0] += r
                acc[1] += g
                acc[2] += b
                n += 1
    n = n or 1
    return acc[0] / n, acc[1] / n, acc[2] / n


def fg_crop(pix, w, h):
    br, bg, bb = corner_mean(pix, w, h)
    xs, ys = [], []
    for y in range(h):
        for x in range(w):
            r, g, b = pix[y * w + x]
            sat = rgb_to_hsv(r, g, b)[1]
            dist = math.hypot(r - br, g - bg, b - bb)
            if not near_white(r, g, b, sat) and (dist > 32 or sat > 0.18):
                xs.append(x)
                ys.append(y)
    if len(xs) < w * h * 0.06:
        return pix, w, h, w / h
    pad = int(0.08 * max(w, h))
    x0 = max(0, min(xs) - pad)
    y0 = max(0, min(ys) - pad)
    x1 = min(w, max(xs) + pad + 1)
    y1 = min(h, max(ys) + pad + 1)
    cropped = [pix[y * w + x] for y in range(y0, y1) for x in range(x0, x1)]
    return cropped, x1 - x0, y1 - y0, (x1 - x0) / max(1, y1 - y0)


def dct1(vec: list[float]) -> list[float]:
    n = len(vec)
    out = [0.0] * n
    for u in range(n):
        acc = 0.0
        for x, val in enumerate(vec):
            acc += val * math.cos(((2 * x + 1) * u * math.pi) / (2 * n))
        out[u] = (math.sqrt(1 / n) if u == 0 else math.sqrt(2 / n)) * acc
    return out


def dct2(gray, n):
    rows = [dct1(gray[y * n : (y + 1) * n]) for y in range(n)]
    cols = [dct1([rows[y][x] for y in range(n)]) for x in range(n)]
    out = [0.0] * (n * n)
    for y in range(n):
        for x in range(n):
            out[y * n + x] = cols[x][y]
    return out


def phash(small):
    gray = []
    for y in range(32):
        for x in range(32):
            sx = min(SIZE - 1, int(x / 32 * SIZE))
            sy = min(SIZE - 1, int(y / 32 * SIZE))
            r, g, b = small[sy * SIZE + sx]
            gray.append(r * 0.3 + g * 0.59 + b * 0.11)
    dct = dct2(gray, 32)
    coeffs = [dct[y * 32 + x] for y in range(8) for x in range(8) if not (x == 0 and y == 0)]
    mid = sorted(coeffs)[len(coeffs) // 2]
    bits = 0
    for i, c in enumerate(coeffs[:64]):
        if c > mid:
            bits |= 1 << i
    return bits


def extract(path: Path) -> dict:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    pix = list(im.getdata())
    cropped, cw, ch, aspect = fg_crop(pix, w, h)
    small_im = Image.new("RGB", (cw, ch))
    small_im.putdata(cropped)
    small_im = small_im.resize((SIZE, SIZE), Image.Resampling.BILINEAR)
    small = list(small_im.getdata())
    hist = [0.0] * (H_BINS * S_BINS)
    spatial = [0.0] * (GRID * GRID * H_BINS * S_BINS)
    hprof = [0.0] * PROF_BINS
    vprof = [0.0] * PROF_BINS
    edges = [0.0] * PROF_BINS
    n = 0
    r = g = b = hh = ss = vv = 0.0
    for i, (pr, pg, pb) in enumerate(small):
        hv, s, v = rgb_to_hsv(pr, pg, pb)
        if near_white(pr, pg, pb, s):
            continue
        n += 1
        hi = min(H_BINS - 1, int(hv * H_BINS))
        si = min(S_BINS - 1, int(s * S_BINS))
        hist[hi * S_BINS + si] += 1
        x = i % SIZE
        y = i // SIZE
        gx = 0 if x < SIZE / 2 else 1
        gy = 0 if y < SIZE / 2 else 1
        spatial[((gy * GRID + gx) * H_BINS + hi) * S_BINS + si] += 1
        r += pr
        g += pg
        b += pb
        hh += hv
        ss += s
        vv += v
        hprof[min(PROF_BINS - 1, int(y / SIZE * PROF_BINS))] += 1
        vprof[min(PROF_BINS - 1, int(x / SIZE * PROF_BINS))] += 1
    n = n or 1
    r, g, b = r / n, g / n, b / n
    rs = gs = bs = 0.0
    for pr, pg, pb in small:
        s = rgb_to_hsv(pr, pg, pb)[1]
        if near_white(pr, pg, pb, s):
            continue
        rs += (pr - r) ** 2
        gs += (pg - g) ** 2
        bs += (pb - b) ** 2

    def norm(vec):
        ssum = sum(vec) or 1.0
        return [v / ssum for v in vec]

    for y in range(SIZE):
        for x in range(1, SIZE):
            i = y * SIZE + x
            j = i - 1
            g1 = small[i][0] * 0.3 + small[i][1] * 0.59 + small[i][2] * 0.11
            g0 = small[j][0] * 0.3 + small[j][1] * 0.59 + small[j][2] * 0.11
            edges[min(PROF_BINS - 1, int(y / SIZE * PROF_BINS))] += abs(g1 - g0)
    return {
        "id": path.stem,
        "hist": norm(hist),
        "spatial": norm(spatial),
        "color": [r, g, b, math.sqrt(rs / n), math.sqrt(gs / n), math.sqrt(bs / n), hh / n, ss / n, vv / n],
        "hProf": norm(hprof),
        "vProf": norm(vprof),
        "edges": norm(edges),
        "aspect": aspect,
        "phash": str(phash(small)),
    }


def main() -> None:
    items = []
    for cid, name in COMMONS.items():
        path = download(cid, name)
        items.append(extract(path))
        print("feat", cid, path.stat().st_size)
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"version": 3, "items": items}, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, "items", len(items))


if __name__ == "__main__":
    main()
