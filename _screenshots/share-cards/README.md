# Share card baselines

Canonical registry order:

| # | Variant | Concept | Story (1080×1920) | Twitter (1200×675) |
|---|---|---|---|---|
| 01 | Wrapped | Core year-in-film summary | `01-default--story-1080x1920.png` | `01-default--twitter-1200x675.png` |
| 02 | Apple | Quiet, system-led summary | `02-apple-hig--story-1080x1920.png` | `02-apple-hig--twitter-1200x675.png` |
| 03 | Editorial | Magazine-style year review | `03-editorial--story-1080x1920.png` | `03-editorial--twitter-1200x675.png` |
| 04 | Variant 3 | Alternate results composition | `04-variant-3--story-1080x1920.png` | `04-variant-3--twitter-1200x675.png` |
| 05 | Double Feature | Actor and director become co-stars on one sheet | `05-double-feature--story-1080x1920.png` | `05-double-feature--twitter-1200x675.png` |
| 06 | Contact Sheet | People become frames in the film year | `06-contact-sheet--story-1080x1920.png` | `06-contact-sheet--twitter-1200x675.png` |
| 07 | Admit One | Identity prints validate the selected people | `07-admit-one--story-1080x1920.png` | `07-admit-one--twitter-1200x675.png` |

The portrait files intentionally use the 9:16 story canvas. Each card renders on
its fixed 675×1200 DOM surface and exports at 1.6× to an exact 1080×1920 PNG.
That preserves the in-product composition while producing a native Instagram
Story asset instead of stretching or cropping the landscape card.

Generate and validate all 14 deterministic baseline PNGs:

```bash
cd frontend
UPDATE_SHARE_SCREENSHOTS=1 npm run test:share-cards
```

Generated from revision: `5c651eb` (`test(share): add visual share card matrix`).
