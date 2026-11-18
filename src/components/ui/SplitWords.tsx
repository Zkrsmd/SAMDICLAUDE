import { Fragment } from 'react';

/**
 * Words that rise out of a mask, one after another (compositor transforms only).
 * Inside an element with `data-reveal="words"` they play when it scrolls in; with `play` they
 * play on mount (re-key the parent to replay). `from` offsets the stagger index, so several
 * runs in one heading continue the same cascade.
 */
export function SplitWords({ text, className = '', from = 0, play = false }: { text: string; className?: string; from?: number; play?: boolean }) {
  const words = text.split(/\s+/).filter(Boolean);
  return (
    <>
      {words.map((w, i) => (
        <Fragment key={`${w}-${i}`}>
          <span className={`sw${play ? ' sw-play' : ''}`}>
            <span className={className} style={{ ['--i' as string]: from + i }}>
              {w}
            </span>
          </span>
          {i < words.length - 1 ? ' ' : null}
        </Fragment>
      ))}
    </>
  );
}
