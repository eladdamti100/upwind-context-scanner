// Toast.tsx — fixed bottom-right notification card.
// All presentational — no app state, no business logic, props only.

export function Toast({ message }: { message: string | null }) {
  if (message === null) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        right: 20,
        bottom: 20,
        zIndex: 60,
        background: 'var(--surface-elevated)',
        boxShadow: 'var(--menu-shadow)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-8)',
        padding: '12px 16px',
        fontSize: 13,
        color: 'var(--text-primary)',
        animation: 'uwslide 140ms ease',
        maxWidth: 360,
      }}
    >
      {message}
    </div>
  );
}
