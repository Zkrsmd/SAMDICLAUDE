import type { Metadata } from 'next';
import './admin.css';

export const metadata: Metadata = {
  title: { default: 'Admin', template: '%s · Admin' },
  robots: { index: false, follow: false },
};

/** The admin has its own frame (no store header, footer, grain or smooth scroll), always in English, left to right. */
export default function AdminRoot({ children }: { children: React.ReactNode }) {
  return (
    <div lang="en" dir="ltr">
      {children}
    </div>
  );
}
