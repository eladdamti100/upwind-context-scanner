// Secret-safety guard. SignalLens only ever handles MASKED values; this helper
// enforces that invariant so a full secret can never slip into logic/logs/UI.
// A value is considered masked if it contains a mask glyph (• or *) or is blank.
export const isMasked = (v: string): boolean => /[•*]/.test(v) || v.trim() === '';

export function assertMasked(v: string): string {
  if (!isMasked(v)) throw new Error('Refusing to handle an unmasked secret value');
  return v;
}
