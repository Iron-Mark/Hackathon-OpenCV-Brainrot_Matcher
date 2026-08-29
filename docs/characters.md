# Brainrot character matcher

The app scores a webcam frame or still against a gallery of **Italian / Indonesian brainrot** mascots (AI-generated animal–object hybrids that went viral on TikTok in 2025).

Stills are served from `frontend/public/assets/brainrot/*.jpg` when present, otherwise Wikimedia Commons via `/models/brainrot/[id]`. Precomputed fingerprints live in `frontend/public/assets/gallery-feat.json`. Attribution: `SOURCES.md` in the stills folder.

## Roster (17)

Tralalero Tralala, Tung Tung Tung Sahur, Bombardiro Crocodilo, Bombombini Gusini, Brr Brr Patapim, Lirilì Larilà, Cappuccino Assassino, Ballerina Cappuccina, Chimpanzini Bananini, Boneca Ambalabu, Trippi Troppi, Frigo Camelo, Giraffa Celeste, Udin Din Din Dun, Ecco Cavallo Virtuoso, Frulli Frulla, Merluzzini Marraquetini.

## How Analyze works (default path is $0)

1. Optional live overlay: YuNet faces, NanoDet objects, or OpenCV filters. Objects overlay is wired and draws COCO boxes.
2. **Analyze match** always runs NanoDet + YuNet when they load in time, then isolates the subject (MediaPipe selfie/pose if the CDN models load, otherwise person/face boxes).
3. Clothes histograms sample **torso / crown / legs** and skip face + skin pixels. `stillMode` keys off segmentation / person coverage, not a raw skin ratio.
4. People scores: 70% costume families, 15% pose-zone dominant colors, 10% energy, 5% silhouette. Stills: 40% pHash, 25% OKLab/χ² hist, 20% silhouette, 15% distinctive NanoDet hint.
5. A local embedding (and optional MobileCLIP if Transformers.js loads) blends as a third engine. Default Analyze **does not** call Gemini.
6. Percentages use softmax + a flatter curve so random photos stay a weak vibe instead of a fake 90.
7. **Ask AI to rerank** is opt-in, ticketed, and rate limited.
8. Default mashup is a free on-device sticker (face oval + Reinhard). **Brew AI hybrid** stays behind a labeled credits control.
9. Sound plays that character’s `theme.freqs` sting, then the Italian chant.

This is closest-vibe matching, not identity verification. No face-identity embeddings.

## Eval

```bash
cd frontend
node scripts/test-looks.mjs
node scripts/eval-match.mjs
python3 scripts/build-gallery-feat.py   # optional, needs Pillow + network
python3 scripts/self_match.py
```

Measured on this change (no Gemini):

- Person color-family fixtures: **7/7 top-1**, MRR 1.000. Random street-gray calibrates at 34% (target ≲ 55%).
- Still self-ID from committed fingerprints: **17/17**, winner 94%, gap ≥ 0.21 (target ≥ 80% / 0.15).

## Sources used for research (not wiki dumps)

- [Know Your Meme — Italian Brainrot](https://knowyourmeme.com/memes/italian-brain-rot-ai-italian-animals)
- [Capital FM character list](https://www.capitalfm.com/internet/italian-brain-rot-meaning-list-names-explained-tiktok/)
- [Vulture explainer](https://www.vulture.com/article/italian-brain-rot-ai-characters-explained.html)
- Stills: [Wikimedia Commons: Category:Italian brainrot](https://commons.wikimedia.org/wiki/Category:Italian_brainrot) (PD-algorithm).
