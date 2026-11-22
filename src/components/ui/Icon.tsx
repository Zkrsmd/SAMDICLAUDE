type Name =
  | 'search'
  | 'bag'
  | 'heart'
  | 'heart-fill'
  | 'menu'
  | 'close'
  | 'arrow-right'
  | 'arrow-left'
  | 'chevron-down'
  | 'plus'
  | 'check'
  | 'minus'
  | 'rotate'
  | 'expand'
  | 'reset'
  | 'filter'
  | 'trash'
  | 'user'
  | 'phone'
  | 'pin'
  | 'home'
  | 'store'
  | 'facebook'
  | 'instagram'
  | 'tiktok';

const paths: Record<Name, React.ReactNode> = {
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-4.2-4.2" />
    </>
  ),
  bag: (
    <>
      <path d="M5 8h14l-1.2 12H6.2z" />
      <path d="M9 8V6.5a3 3 0 0 1 6 0V8" />
    </>
  ),
  heart: <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  'heart-fill': <path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" fill="currentColor" />,
  menu: (
    <>
      <path d="M4 8h16" />
      <path d="M4 16h11" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  'arrow-right': (
    <>
      <path d="M4 12h15" />
      <path d="m14 7 5 5-5 5" />
    </>
  ),
  'arrow-left': (
    <>
      <path d="M20 12H5" />
      <path d="m10 7-5 5 5 5" />
    </>
  ),
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  minus: <path d="M5 12h14" />,
  rotate: (
    <>
      <path d="M20 12a8 8 0 1 1-2.3-5.6" />
      <path d="M20 4v4h-4" />
    </>
  ),
  expand: (
    <>
      <path d="M4 9V4h5" />
      <path d="M20 9V4h-5" />
      <path d="M4 15v5h5" />
      <path d="M20 15v5h-5" />
    </>
  ),
  reset: (
    <>
      <path d="M4 12a8 8 0 1 0 2.3-5.6" />
      <path d="M4 4v4h4" />
    </>
  ),
  filter: (
    <>
      <path d="M4 7h16" />
      <path d="M7 12h10" />
      <path d="M10 17h4" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14" />
      <path d="M9 7V5h6v2" />
      <path d="M7 7l1 13h8l1-13" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8.5" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  phone: <path d="M7.5 3.5h2.2l1.3 4-1.8 1.3a11 11 0 0 0 6 6l1.3-1.8 4 1.3v2.2a2 2 0 0 1-2.2 2A16 16 0 0 1 5.5 5.7a2 2 0 0 1 2-2.2z" />,
  pin: (
    <>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" />
      <circle cx="12" cy="10" r="2.3" />
    </>
  ),
  home: (
    <>
      <path d="M4 11 12 4l8 7" />
      <path d="M6 9.5V20h12V9.5" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  store: (
    <>
      <path d="M4 9h16l-1.2-4H5.2z" />
      <path d="M5 9v11h14V9" />
      <path d="M9.5 20v-6h5v6" />
    </>
  ),
  facebook: <path d="M14.5 8H16V4.8a19 19 0 0 0-2.3-.1c-2.3 0-3.9 1.4-3.9 4V11H7.2v3.5h2.6V21h3.3v-6.5h2.6l.4-3.5h-3V9c0-.9.3-1 1.4-1z" />,
  instagram: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="5" />
      <circle cx="12" cy="12" r="3.6" />
      <circle cx="16.9" cy="7.1" r=".6" />
    </>
  ),
  tiktok: <path d="M14 4v10.5a3.5 3.5 0 1 1-3.5-3.5M14 4c.4 2.6 2.2 4.3 5 4.5" />,
};

export function Icon({ name, size = 22, className = '' }: { name: Name; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      // arrows and chevrons point the other way in right-to-left languages
      className={/arrow|chevron/.test(name) ? `rtl-flip ${className}` : className}
    >
      {paths[name]}
    </svg>
  );
}
