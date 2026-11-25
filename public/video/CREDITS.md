# Hero films

Two shapes per film: `<name>.mp4` (landscape, desktop) and `<name>-p.mp4` (portrait, phones), each with a
`.webp` poster still. Football, martial arts, fitness and diving are clips used WHOLE (no cuts), re-encoded by
`scripts/full-films.mjs` (a portrait clip sits in the middle of the desktop shape over a blurred copy of itself).
Sportswear, swimming and basketball (the Competition slide) are short edits cut by `scripts/edit-films.mjs`.
Every film loops in the hero.

| Sport      | Source clips | Rights |
| ---------- | ------------ | ------ |
| Football   | `tiktok/football-full.mp4` — owner-supplied clip (used whole) | Supplied by the site owner; commercial use must be cleared with the creator |
| Sportswear | `tiktok/football.mp4` — owner-supplied clip (a brand campaign film; the former football edit) | Supplied by the site owner; commercial use must be cleared with the rights holder |
| Martial arts | `tiktok/martial-arts-full.mov` — owner-supplied clip (heavy-bag training, used whole) | Supplied by the site owner; commercial use must be cleared with the creator |
| Fitness    | `tiktok/gym-full.mp4` — owner-supplied clip (gym training, used whole) | Supplied by the site owner; commercial use must be cleared with the creator |
| Diving     | `media-src/video-raw/b/underwater.mp4` — underwater swimmer (used whole) | Stock clip from the earlier media pull; check its licence before heavy promotion |
| Swimming   | `tiktok/swiming1.mp4` · `tiktok/Swiming2.mp4` (after its on-screen caption) — owner-supplied clips | Supplied by the site owner; commercial use must be cleared with the creators |
| Basketball (Competition) | https://www.pexels.com/video/bosnian-boy-dunk-windmill-18812173/ · https://www.pexels.com/video/dynamic-basketball-dunking-on-outdoor-court-32067896/ | [Pexels License](https://www.pexels.com/license/) (free for commercial use) |

The raw clips live in `tiktok/` and `media-src/video-raw/` and are not committed — only the cut films ship.
