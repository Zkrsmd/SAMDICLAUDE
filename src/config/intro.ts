/**
 * The first-visit intro (src/components/layout/Intro.tsx): the session cookie that says it has played
 * this visit (read by the server in StoreChrome, so a later page never even renders it), and its
 * flip-book cards — ancient Greek sport art (public-domain museum photos, public/intro/CREDITS.md), cropped
 * by scripts/intro-cards.mjs into public/intro/.
 */
export const INTRO_COOKIE = 'stryke_intro';

export const INTRO_CARDS = [
  '01-boxers',
  '02-bronze-boxer',
  '03-wrestlers',
  '04-spearman',
  '05-pankration',
  '06-jumper',
  '07-chariot',
  '08-marble-athlete',
  '09-boxers-jug',
  '10-bronze-athlete',
  '11-boxer-fragment',
] as const;
