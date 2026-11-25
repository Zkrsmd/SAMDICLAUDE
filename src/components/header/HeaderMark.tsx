/**
 * The STRYKE letters and the electric-blue slash, cut from the owner's logo into two masks
 * (public/brand/stryke-letters.webp, stryke-slash.webp). The letters take `--sh-ink` from the
 * header (bone white on dark, deep navy on light); styles: `.sh-mark` in globals.css.
 */
export function HeaderMark({ className = '' }: { className?: string }) {
  return (
    <span className={`sh-mark ${className}`} aria-hidden>
      <span className="sh-letters" />
      <span className="sh-slash" />
    </span>
  );
}
