# Brainrot character matcher

The app scores a webcam frame or still against a gallery of **Italian / Indonesian brainrot** mascots (AI-generated animal–object hybrids that went viral on TikTok in 2025).

Stills live in `frontend/public/assets/brainrot/` (Wikimedia Commons, PD-algorithm). Attribution: `SOURCES.md` in that folder.

## Roster (17)

Tralalero Tralala, Tung Tung Tung Sahur, Bombardiro Crocodilo, Bombombini Gusini, Brr Brr Patapim, Lirilì Larilà, Cappuccino Assassino, Ballerina Cappuccina, Chimpanzini Bananini, Boneca Ambalabu, Trippi Troppi, Frigo Camelo, Giraffa Celeste, Udin Din Din Dun, Ecco Cavallo Virtuoso, Frulli Frulla, Merluzzini Marraquetini.

## How Analyze works

1. OpenCV.js scans the frame (optional live overlay: faces / objects / edges / gray / blur).
2. On **Analyze match**, matching runs even if OpenCV.js is still loading. If OpenCV is ready, NanoDet lists COCO objects as a hint; color + silhouette fingerprints are compared to every gallery still.
3. Score mix: 55% HSV histogram correlation, 25% mean/std color, 20% horizontal-edge silhouette. A small boost if NanoDet labels overlap a character’s hints (airplane → Bombardiro, cup → Cappuccino, cat → Trippi Troppi, …).
4. The UI shows a percentage and the next three runners-up. This is a **closest-vibe** score, not identity verification — a random bus photo can still land ~50% on the shark.

## Sources used for research (not wiki dumps)

- [Know Your Meme — Italian Brainrot](https://knowyourmeme.com/memes/italian-brainrot-ai-italian-animals)
- [Capital FM character list](https://www.capitalfm.com/internet/italian-brain-rot-meaning-list-names-explained-tiktok/)
- [Vulture explainer](https://www.vulture.com/article/italian-brain-rot-ai-characters-explained.html)
- Stills: [Wikimedia Commons: Category:Italian brainrot](https://commons.wikimedia.org/wiki/Category:Italian_brainrot) (PD-algorithm). The matcher route serves `public/assets/brainrot/*.jpg` when present, otherwise Commons `Special:FilePath`.
