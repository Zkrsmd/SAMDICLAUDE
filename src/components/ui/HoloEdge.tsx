/**
 * The travelling chrome edge (and its soft halo) as real elements: a fixed conic gradient that
 * rotates on the compositor, clipped to the ring by a static mask. Put it first inside a
 * `.holo-border` / `.btn-holo` element that carries `data-edge`.
 */
export function HoloEdge({ halo = true, variant }: { halo?: boolean; variant?: 'btn' }) {
  return (
    <>
      <span aria-hidden className={`holo-ring${variant === 'btn' ? ' holo-ring-btn' : ''}`}>
        <span />
      </span>
      {halo && (
        <span aria-hidden className="holo-halo">
          <span />
        </span>
      )}
    </>
  );
}
