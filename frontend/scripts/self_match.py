#!/usr/bin/env python3
"""Offline self-id check for the brainrot gallery (mirrors frontend/lib/match-brainrot.ts)."""

from __future__ import annotations

import math
from pathlib import Path

from PIL import Image

SIZE = 128
H_BINS = 16
S_BINS = 12
EDGE_BINS = 24
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
    s = 0.0 if mx == 0 else d / mx
    return h, s, mx


def extract(path: Path) -> tuple[list[float], list[float], list[float]]:
    im = Image.open(path).convert("RGB").resize((SIZE, SIZE), Image.Resampling.BILINEAR)
    pix = list(im.getdata())
    hist = [0.0] * (H_BINS * S_BINS)
    n = len(pix)
    r = g = b = 0.0
    for pr, pg, pb in pix:
        r += pr
        g += pg
        b += pb
        h, s, _ = rgb_to_hsv(pr, pg, pb)
        hi = min(H_BINS - 1, int(h * H_BINS))
        si = min(S_BINS - 1, int(s * S_BINS))
        hist[hi * S_BINS + si] += 1
    hist = [v / n for v in hist]
    r, g, b = r / n, g / n, b / n
    rs = gs = bs = 0.0
    for pr, pg, pb in pix:
        rs += (pr - r) ** 2
        gs += (pg - g) ** 2
        bs += (pb - b) ** 2
    color = [r, g, b, math.sqrt(rs / n), math.sqrt(gs / n), math.sqrt(bs / n)]

    prof = [0.0] * EDGE_BINS
    step = SIZE / EDGE_BINS
    data = im.load()
    for bin_i in range(EDGE_BINS):
        y0 = int(bin_i * step)
        y1 = max(y0 + 1, int((bin_i + 1) * step))
        acc = count = 0
        for y in range(y0, y1):
            for x in range(1, SIZE):
                p1 = data[x, y]
                p0 = data[x - 1, y]
                g1 = p1[0] * 0.3 + p1[1] * 0.59 + p1[2] * 0.11
                g0 = p0[0] * 0.3 + p0[1] * 0.59 + p0[2] * 0.11
                acc += abs(g1 - g0)
                count += 1
        prof[bin_i] = acc / count if count else 0
    ssum = sum(prof) or 1
    prof = [v / ssum for v in prof]
    return hist, color, prof


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
    return num / (math.sqrt(da * db) or 1e-6)


def color_sim(a: list[float], b: list[float]) -> float:
    d = sum((x - y) ** 2 for x, y in zip(a, b))
    return math.exp(-math.sqrt(d) / 80)


def visual(a: tuple, b: tuple) -> float:
    h = max(0.0, corr(a[0], b[0]))
    c = color_sim(a[1], b[1])
    e = max(0.0, corr(a[2], b[2]))
    return 0.55 * h + 0.25 * c + 0.2 * e


def to_percent(raw: float) -> int:
    return max(0, min(99, round(((raw - 0.15) / 0.8) * 100)))


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
        pct = to_percent(score)
        print(f"{cid:28} -> {top:28} {pct}%")
        if top != cid:
            misses.append(cid)
    if misses:
        raise SystemExit(f"self-id failed: {misses}")
    print("self-id 17/17")


if __name__ == "__main__":
    main()
