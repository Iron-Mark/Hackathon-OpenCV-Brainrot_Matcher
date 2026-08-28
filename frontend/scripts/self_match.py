#!/usr/bin/env python3
"""Offline self-id check for the brainrot gallery (mirrors frontend/lib/match-brainrot.ts)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

SIZE = 160
H_BINS = 18
S_BINS = 10
GRID = 2
PROF_BINS = 32
ROOT = Path(__file__).resolve().parents[1] / "public/assets/brainrot"

IDS = [
    "tralalero-tralala",
    "tung-tung-tung-sahur",
    "bombardiro-crocodilo",
    "bombombini-gusini",
    "brr-brr-patapim",
    "lirili-larila",
    "cappuccino-assassino",
    "ballerina-cappuccina",
    "chimpanzini-bananini",
    "boneca-ambalabu",
    "trippi-troppi",
    "frigo-camelo",
    "giraffa-celeste",
    "udin-din-din-dun",
    "ecco-cavallo-virtuoso",
    "frulli-frulla",
    "merluzzini-marraquetini",
]


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


def load_pixels(path: Path) -> tuple[list[tuple[int, int, int]], int, int]:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    return list(im.getdata()), w, h


def corner_mean(pix: list[tuple[int, int, int]], w: int, h: int) -> tuple[float, float, float]:
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


def fg_crop(pix: list[tuple[int, int, int]], w: int, h: int) -> tuple[list[tuple[int, int, int]], int, int, float]:
    br, bg, bb = corner_mean(pix, w, h)
    xs: list[int] = []
    ys: list[int] = []
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
    cw, ch = x1 - x0, y1 - y0
    return cropped, cw, ch, cw / ch if ch else 1.0


def resize(pix: list[tuple[int, int, int]], w: int, h: int) -> list[tuple[int, int, int]]:
    im = Image.new("RGB", (w, h))
    im.putdata(pix)
    im = im.resize((SIZE, SIZE), Image.Resampling.BILINEAR)
    return list(im.getdata())


def extract(path: Path) -> tuple:
    pix, w, h = load_pixels(path)
    cropped, cw, ch, aspect = fg_crop(pix, w, h)
    small = resize(cropped, cw, ch)
    hist = [0.0] * (H_BINS * S_BINS)
    spatial = [0.0] * (GRID * GRID * H_BINS * S_BINS)
    hprof = [0.0] * PROF_BINS
    vprof = [0.0] * PROF_BINS
    edges = [0.0] * PROF_BINS
    n = 0
    r = g = b = hh = ss = vv = 0.0
    for i, (pr, pg, pb) in enumerate(small):
        h, s, v = rgb_to_hsv(pr, pg, pb)
        if near_white(pr, pg, pb, s):
            continue
        n += 1
        hi = min(H_BINS - 1, int(h * H_BINS))
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
        hh += h
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
    color = [r, g, b, math.sqrt(rs / n), math.sqrt(gs / n), math.sqrt(bs / n), hh / n, ss / n, vv / n]
    for y in range(SIZE):
        for x in range(1, SIZE):
            i = y * SIZE + x
            j = i - 1
            g1 = small[i][0] * 0.3 + small[i][1] * 0.59 + small[i][2] * 0.11
            g0 = small[j][0] * 0.3 + small[j][1] * 0.59 + small[j][2] * 0.11
            edges[min(PROF_BINS - 1, int(y / SIZE * PROF_BINS))] += abs(g1 - g0)

    def norm(vec: list[float]) -> list[float]:
        ssum = sum(vec) or 1.0
        return [v / ssum for v in vec]

    return (
        norm(hist),
        norm(spatial),
        color,
        norm(hprof),
        norm(vprof),
        norm(edges),
        aspect,
    )


def corr(a: list[float], b: list[float]) -> float:
    ma = sum(a) / len(a)
    mb = sum(b) / len(b)
    num = da = db = 0.0
    for xa, xb in zip(a, b):
        xa -= ma
        xb -= mb
        num += xa * xb
        da += xa * xa
        db += xb * xb
    den = math.sqrt(da * db)
    if den < 1e-8:
        return inter(a, b)
    return num / den


def inter(a: list[float], b: list[float]) -> float:
    return sum(min(x, y) for x, y in zip(a, b))


def color_sim(a: list[float], b: list[float]) -> float:
    d = sum((x - y) ** 2 for x, y in zip(a[:6], b[:6]))
    return math.exp(-math.sqrt(d) / 70)


def visual(a: tuple, b: tuple) -> float:
    h = max(0.0, 0.5 * inter(a[0], b[0]) + 0.5 * corr(a[0], b[0]))
    s = max(0.0, inter(a[1], b[1]))
    c = color_sim(a[2], b[2])
    sil = 0.5 * max(0.0, inter(a[3], b[3])) + 0.5 * max(0.0, inter(a[4], b[4]))
    e = max(0.0, corr(a[5], b[5]))
    asp = 1 - min(1.0, abs(a[6] - b[6]) / 1.4)
    return 0.28 * h + 0.22 * s + 0.18 * c + 0.18 * sil + 0.10 * e + 0.04 * asp


def to_percent(raw: float, best: float, second: float, winner: bool) -> int:
    absv = max(0.0, min(1.0, (raw - 0.18) / 0.78))
    rel = raw / best if best else 0.0
    gap = best - second
    pct = 100 * (absv**1.08) * (0.62 + 0.38 * rel)
    if winner:
        pct = min(99, pct + 8 * min(1.0, gap / 0.08) * absv)
    return max(0, min(99, round(pct)))


def main() -> None:
    feats = {cid: extract(ROOT / f"{cid}.jpg") for cid in IDS}
    misses = []
    for cid in IDS:
        ranked = sorted(
            ((other, visual(feats[cid], feats[other])) for other in IDS),
            key=lambda item: item[1],
            reverse=True,
        )
        top, score = ranked[0]
        second = ranked[1][1]
        pct = to_percent(score, score, second, True)
        print(f"{cid:28} -> {top:28} {pct:3d}%  gap={score - second:.3f}")
        if top != cid:
            misses.append(cid)
    if misses:
        raise SystemExit(f"self-id failed: {misses}")
    print("self-id 17/17")


if __name__ == "__main__":
    main()
