---
name: sports-experience-design
description: Use when designing or changing any visual surface of this sports store (hero scenes, category worlds, product pages, cards, typography, motion). Enforces the bright "Gallery" art direction.
---

# Sports experience design

## When to use
Any UI, layout, typography, colour or motion change in `src/components`, `src/app`, `src/app/globals.css`.

## Standards
- Bright first: bg `#FAFAF7`, white, stone `#EFEEE8`, ink `#171A18`. No dark sections beyond small ink elements.
- Each sport has a material world (`.world-turf`, `.world-gym`, `.world-water`, …). Accent = light/material, not boxes.
- Display type: Big Shoulders, uppercase, fitted to its container (use `cqw`). The word is part of the composition.
- Labels: Geist Mono `.eyebrow`. Body: Instrument Sans. Never Inter/Arial.
- Sharp 2px corners, hairlines, `.placard`. Vary card sizes; avoid identical rounded card grids.
- Story pattern: ACTION → EXHIBIT. Products must stay recognisable and unobstructed.
- Motion ≤ 900 ms for UI, skippable intros, `prefers-reduced-motion` respected, swipe never the only control.

## Checklist before done
1. Screenshot at 390×844 and 1440×900 (`node scripts/qa-shots.mjs …`) and look at them.
2. Text contrast ≥ 4.5:1 on world backgrounds; long words do not overflow.
3. No layout shift on load; touch targets ≥ 44 px.
