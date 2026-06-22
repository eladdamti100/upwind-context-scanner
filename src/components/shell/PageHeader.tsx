export function PageHeader() {
  return (
    <div style={{ padding: '24px 32px 0' }}>
      <h1
        style={{
          fontSize: 26,
          fontWeight: 600,
          letterSpacing: '-0.02em',
          margin: 0,
          color: 'var(--text-primary)',
          fontFamily: 'var(--font-default-family)',
        }}
      >
        Exposed Sensitive Data
      </h1>
      <p
        style={{
          fontSize: 13.5,
          color: 'var(--text-secondary)',
          maxWidth: 780,
          margin: '8px 0 0',
          fontFamily: 'var(--font-default-family)',
          lineHeight: 1.5,
        }}
      >
        Prioritize sensitive data exposure using file context, validation status, asset exposure,
        and model-based risk scoring.
      </p>
    </div>
  );
}
