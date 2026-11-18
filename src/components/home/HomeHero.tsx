'use client';
import { useCallback, useRef } from 'react';
import { Hero } from '@/components/hero/Hero';
import { HeroDrip } from './HeroDrip';
import { heroSlides } from '@/config/hero';

/** Hero + the liquid holo edge that oozes onto the white page below. */
export function HomeHero() {
  const sport = useRef<string>('football');
  const onScroll = useCallback((_p: number, i: number) => {
    sport.current = heroSlides[i]?.id ?? 'football';
  }, []);
  return (
    <>
      <Hero onScrollProgress={onScroll} />
      <div className="relative z-10 h-0">
        <HeroDrip sport={sport} />
      </div>
    </>
  );
}
