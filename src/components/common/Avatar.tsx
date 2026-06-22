// Avatar.tsx — circular initials avatar with deterministic color from name.
// All presentational — no app state, no business logic, props only.

const PALETTE = [
  '#2C72DD',
  '#1fa062',
  '#9168B6',
  '#00c3eb',
  '#ff8710',
  '#553BF1',
  '#B30076',
];

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  if (words.length === 1) {
    // Single word: first letter + last letter, lowercase (e.g. 'root' → 'rt')
    const w = words[0].toLowerCase();
    if (w.length <= 1) return w;
    return w[0] + w[w.length - 1];
  }
  // Multi-word: first letter of first two words, uppercase
  return words
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

function hashColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) {
    h = (h * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[h % PALETTE.length];
}

export function Avatar({ name, size = 22 }: { name: string; size?: number }) {
  const bg = hashColor(name);
  const label = initials(name);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 600,
        lineHeight: 1,
        flexShrink: 0,
        userSelect: 'none',
      }}
      aria-label={name}
    >
      {label}
    </div>
  );
}
