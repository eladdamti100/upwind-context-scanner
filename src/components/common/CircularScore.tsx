// CircularScore.tsx — compact circular progress ring with the score centered.
// SVG-based (no charting library). Color follows score-range semantics.

export function CircularScore({
  score,
  size = 40,
  stroke = 4,
  label,
}: {
  score: number;
  size?: number;
  stroke?: number;
  label?: string;
}) {
  const s = Math.max(0, Math.min(100, Math.round(score)));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - s / 100);

  // Score-range accent (clean, no gradients/glow).
  const color =
    s >= 75 ? 'var(--severity-high)' // orange/red — high confidence
    : s >= 50 ? 'var(--severity-medium)' // amber/yellow
    : s >= 25 ? 'var(--uw-metal-blue-02)' // blue/neutral
    : 'var(--text-tertiary)'; // muted low

  return (
    <span
      role="img"
      aria-label={label ?? `Confidence Level ${s} out of 100`}
      style={{
        position: 'relative',
        display: 'inline-flex',
        width: size,
        height: size,
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }} aria-hidden="true">
        {/* Muted dark track */}
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-tertiary)" strokeWidth={stroke} />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeDasharray={circ}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        aria-hidden="true"
        style={{
          position: 'absolute',
          fontSize: size >= 44 ? 13 : 12,
          fontWeight: 600,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-default-family)',
          lineHeight: 1,
        }}
      >
        {s}
      </span>
    </span>
  );
}
