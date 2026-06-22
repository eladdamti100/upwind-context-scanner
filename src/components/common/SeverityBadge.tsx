// SeverityBadge.tsx — small severity pill using priStyle/priLabel from classify.
// All presentational — no app state, no business logic, props only.

import type { Priority } from '../../types';
import { priStyle, priLabel } from '../../lib/classify';

export function SeverityBadge({
  priority,
  label,
}: {
  priority: Priority;
  label?: string;
}) {
  const { fg, bg } = priStyle(priority);
  const text = label ?? priLabel(priority);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        height: 21,
        padding: '0 7px',
        borderRadius: 5,
        background: bg,
        fontSize: 11,
        fontWeight: 600,
        color: fg,
        lineHeight: 1,
        whiteSpace: 'nowrap',
      }}
    >
      {/* 6px dot */}
      <span
        style={{
          width: 6,
          height: 6,
          borderRadius: '50%',
          background: fg,
          flexShrink: 0,
        }}
      />
      {text}
    </span>
  );
}
