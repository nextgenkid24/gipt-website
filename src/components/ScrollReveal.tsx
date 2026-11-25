import React, { useEffect, useRef, useState } from 'react';

type RevealVariant = 'fade-up' | 'fade-in' | 'scale-in' | 'slide-up';

interface ScrollRevealProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
  variant?: RevealVariant;
  once?: boolean;
  immediate?: boolean;
  as?: 'div' | 'section' | 'article' | 'aside' | 'li';
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return false;
  }
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

const HIDDEN_TRANSFORM: Record<RevealVariant, string> = {
  'fade-up': 'translate3d(0, 22px, 0)',
  'slide-up': 'translate3d(0, 14px, 0)',
  'scale-in': 'translate3d(0, 16px, 0) scale(0.97)',
  'fade-in': 'translate3d(0, 0, 0)',
};

export function ScrollReveal({
  children,
  className = '',
  delay = 0,
  variant = 'fade-up',
  once = true,
  immediate = false,
  as = 'div',
}: ScrollRevealProps) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState<boolean>(() => prefersReducedMotion());

  useEffect(() => {
    if (prefersReducedMotion()) {
      setVisible(true);
      return;
    }

    if (immediate) {
      const raf = window.requestAnimationFrame(() => setVisible(true));
      return () => window.cancelAnimationFrame(raf);
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            if (once) {
              observer.unobserve(entry.target);
            }
          } else if (!once) {
            setVisible(false);
          }
        }
      },
      {
        threshold: 0.08,
        rootMargin: '0px 0px -36px 0px',
      }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [immediate, once]);

  const Component = as as React.ElementType;

  return (
    <Component
      ref={ref}
      className={`gipt-reveal ${className}`}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translate3d(0, 0, 0) scale(1)' : HIDDEN_TRANSFORM[variant],
        transitionProperty: 'opacity, transform',
        transitionDuration: '650ms',
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: visible ? `${delay}ms` : '0ms',
      }}
    >
      {children}
    </Component>
  );
}

interface CountUpStatProps {
  value: string;
  className?: string;
}

/**
 * Parses numeric impact strings like "1,450+", "85+", "11", or "94%" and
 * animates smoothly from 0 when scrolled into view, while keeping non-numeric
 * values like "Open" crisp and intact.
 */
export function CountUpStat({ value, className = '' }: CountUpStatProps) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const match = /^([^0-9]*)([0-9][0-9,]*(?:\.[0-9]+)?)(.*)$/.exec((value || '').trim());
  const hasNumber = Boolean(match);
  const prefix = match?.[1] ?? '';
  const rawNum = match?.[2] ?? '';
  const suffix = match?.[3] ?? '';
  const target = hasNumber ? Number(rawNum.replace(/,/g, '')) : 0;
  const hasCommas = rawNum.includes(',');
  const decimals = rawNum.includes('.') ? rawNum.split('.')[1].length : 0;

  const [display, setDisplay] = useState<string>(() => {
    if (!hasNumber || prefersReducedMotion()) return value;
    return `${prefix}0${suffix}`;
  });
  const startedRef = useRef(false);

  useEffect(() => {
    if (!hasNumber || prefersReducedMotion()) {
      setDisplay(value);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setDisplay(value);
      return;
    }

    let rafId = 0;

    const runAnimation = () => {
      if (startedRef.current) return;
      startedRef.current = true;
      const duration = 1100;
      const startTime = performance.now();

      const step = (now: number) => {
        const progress = Math.min(1, (now - startTime) / duration);
        // Smooth easeOutExpo curve
        const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
        const current = target * eased;
        const formatted = hasCommas
          ? Math.round(current).toLocaleString('en-US')
          : decimals > 0
          ? current.toFixed(decimals)
          : String(Math.round(current));
        setDisplay(`${prefix}${formatted}${suffix}`);
        if (progress < 1) {
          rafId = window.requestAnimationFrame(step);
        } else {
          setDisplay(value);
        }
      };

      rafId = window.requestAnimationFrame(step);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            runAnimation();
            observer.unobserve(entry.target);
          }
        }
      },
      { threshold: 0.25 }
    );

    observer.observe(node);
    return () => {
      observer.disconnect();
      if (rafId) window.cancelAnimationFrame(rafId);
    };
  }, [decimals, hasCommas, hasNumber, prefix, suffix, target, value]);

  return (
    <span ref={ref} className={className}>
      {display}
    </span>
  );
}
