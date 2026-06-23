// InfoTooltip.tsx — small accessible info "?" icon with a dark-mode tooltip.
// Opens on hover, click, or keyboard focus; closes on mouse-leave, blur,
// outside click, Escape, or when another tooltip is opened (outside click).
// Clicking the icon never bubbles, so it cannot trigger column sorting.

import { useEffect, useRef, useState } from 'react';
import { Icon } from './Icon';

export function InfoTooltip({
  text,
  label,
  size = 12,
}: {
  text: string;
  label: string;
  size?: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <span ref={ref} style={{ position: 'relative', display: 'inline-flex' }}>
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={e => {
          e.stopPropagation(); // never trigger header sort
          setOpen(true);
        }}
        onMouseEnter={() => setOpen(true)}
        onMouseLeave={() => setOpen(false)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: 'none',
          background: 'transparent',
          cursor: 'help',
          color: 'var(--text-tertiary)',
          padding: 0,
          lineHeight: 0,
        }}
      >
        <Icon name="info" size={size} />
      </button>

      {open && (
        <span
          role="tooltip"
          // Don't let the document mousedown handler immediately close it.
          onMouseDown={e => e.stopPropagation()}
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            left: 0,
            zIndex: 70,
            width: 260,
            background: 'var(--surface-elevated)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 8,
            boxShadow: 'var(--menu-shadow, 0 4px 16px rgba(0,0,0,0.5))',
            padding: '10px 12px',
            // Reset header-cell typography so the tooltip text reads normally.
            fontSize: 12,
            fontWeight: 400,
            lineHeight: 1.5,
            textTransform: 'none',
            letterSpacing: 'normal',
            whiteSpace: 'normal',
            fontFamily: 'var(--font-default-family)',
          }}
        >
          {text}
        </span>
      )}
    </span>
  );
}
