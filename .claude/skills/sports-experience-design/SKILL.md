---
name: sports-experience-design
description: Use when designing or changing any visual surface of this sports store (hero scenes, category worlds, product pages, cards, typography, motion). Enforces the bright "Gallery" art direction.
---

# Sports experience design

## When to use
Any UI, layout, typography, colour or motion change in `src/components`, `src/app`, `src/app/globals.css`.

## Standards
- Glacier palette: frost `#F3F4F6`, white, stone `#E8EBEF`, steel `#8E99A8`, ink `#0F1216`, one accent cobalt `#2B59FF`. No rainbow colours. Hero = cool atmospheric grey; rest of the site frost-white.
- Each sport has a light, not a colour box: studio tints in the hero, coded light shafts, accent glows. Cards are bright panels whose photo lights up on hover/centre.
- Display type: Unbounded, uppercase, fitted to its container (use `cqw`); giant words are raised white/pearl, not black. The word is part of the composition.
- Labels: Geist Mono `.eyebrow`. Body: Sora. Never Inter/Arial.
- White holo-edged pills (`.btn-holo`), light glass (`.btn-glass-light`, `.glass-strong`), `.arena` light-up cards, `.tilt` plates. Vary card sizes.
- Story pattern: ACTION → EXHIBIT. Products must stay recognisable and unobstructed.
- Motion ≤ 900 ms for UI, skippable intros, `prefers-reduced-motion` respected, swipe never the only control.

## Checklist before done
1. Screenshot at 390×844 and 1440×900 (`node scripts/qa-shots.mjs …`) and look at them.
2. Text contrast ≥ 4.5:1 on world backgrounds; long words do not overflow.
3. No layout shift on load; touch targets ≥ 44 px.
