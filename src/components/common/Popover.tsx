// Popover.tsx — absolutely-positioned overlay, closes on outside click.
// All presentational — no app state, no business logic, props only.

import React, { useEffect, useRef } from 'react';

export function Popover({
  open,
  onClose,
  children,
  style,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function handleMouseDown(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      ref={ref}
      style={{
        position: 'absolute',
        zIndex: 40,
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-8)',
        boxShadow: 'var(--menu-shadow)',
        padding: 6,
        ...style,
      }}
    >
      {children}
    </div>
  );
}
