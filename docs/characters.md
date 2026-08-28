# Brainrot character matcher

The app scores a webcam frame or still against a gallery of **Italian / Indonesian brainrot** mascots (AI-generated animal–object hybrids that went viral on TikTok in 2025).

Stills live in `frontend/public/assets/brainrot/` (Wikimedia Commons, PD-algorithm). Attribution: `SOURCES.md` in that folder.

## Roster (17)

Tralalero Tralala, Tung Tung Tung Sahur, Bombardiro Crocodilo, Bombombini Gusini, Brr Brr Patapim, Lirilì Larilà, Cappuccino Assassino, Ballerina Cappuccina, Chimpanzini Bananini, Boneca Ambalabu, Trippi Troppi, Frigo Camelo, Giraffa Celeste, Udin Din Din Dun, Ecco Cavallo Virtuoso, Frulli Frulla, Merluzzini Marraquetini.

## How Analyze works

1. OpenCV.js scans the frame (optional live overlay: faces / objects / edges / gray / blur).
2. On **Analyze match**, matching runs even if OpenCV.js is still loading. If OpenCV is ready, NanoDet lists COCO objects and YuNet counts faces. The matcher crops to the scanned subject (distinctive object, or a large person box) and ignores studio-white / corner-sampled background.
3. Score mix on the isolated subject: 28% global HSV histogram (intersection + correlation), 22% 2×2 spatial color layout, 18% foreground mean/std color, 18% horizontal+vertical occupancy silhouette, 10% edge profile, 4% bounding-box aspect. A modest boost only if NanoDet sees a **distinctive** label (airplane, giraffe, cup, banana, …) at decent size and confidence. Generic `person` / `face` hits do not boost a character — webcams always have those.
4. The UI percentage is calibrated from both the raw fingerprint and the gap to second place, so a unique look can hit the high 90s while a random photo stays a weak vibe instead of a fake ~50%. This is still closest-vibe matching, not identity verification.
5. When Analyze finishes, the page plays that character’s theme: a unique Web Audio sting plus Italian/Indonesian TTS of their chant (Tralalero Tralala, Tung tung tung sahur, …). **Replay** on the match card repeats it. Tap any roster card to preview that character. Toggle sound under Analyze.

## Sources used for research (not wiki dumps)

- [Know Your Meme — Italian Brainrot](https://knowyourmeme.com/memes/italian-brainrot-ai-italian-animals)
- [Capital FM character list](https://www.capitalfm.com/internet/italian-brain-rot-meaning-list-names-explained-tiktok/)
- [Vulture explainer](https://www.vulture.com/article/italian-brain-rot-ai-characters-explained.html)
- Stills: [Wikimedia Commons: Category:Italian brainrot](https://commons.wikimedia.org/wiki/Category:Italian_brainrot) (PD-algorithm). The matcher route serves `public/assets/brainrot/*.jpg` when present, otherwise Commons `Special:FilePath`.
