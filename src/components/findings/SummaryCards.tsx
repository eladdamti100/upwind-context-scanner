import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';
import { useStore } from '../../state/StoreContext';

interface CardProps {
  label: string;
  value: number;
  color: string;
  helper: string;
}

function Card({ label, value, color, helper }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 12,
        boxShadow: 'var(--shadow-sm)',
        padding: 20,
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
      }}
    >
      <span style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        {label}
      </span>
      <span style={{ fontSize: 32, fontWeight: 600, color, lineHeight: 1.1 }}>
        {value}
      </span>
      <span style={{ fontSize: 11, color: 'var(--text-tertiary)', lineHeight: 1.4 }}>
        {helper}
      </span>
    </div>
  );
}

export function SummaryCards() {
  const { state } = useStore();
  const sensitivity = state.settings.sensitivity;

  const totalCount = FINDINGS.length;

  const criticalCount = FINDINGS.filter(
    (f) => effPriority(f, sensitivity) === 'critical',
  ).length;

  const validatedActiveCount = FINDINGS.filter(
    (f) => (state.validations[f.id] ?? f.validation) === 'validated-active',
  ).length;

  const publiclyExposedCount = FINDINGS.filter(
    (f) => f.exposure === 'Public' || f.exposure === 'Internet-facing',
  ).length;

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(4, 1fr)',
        gap: 16,
        marginBottom: 24,
      }}
    >
      <Card
        label="Total exposed findings"
        value={totalCount}
        color="var(--text-primary)"
        helper="Context-aware findings"
      />
      <Card
        label="Critical findings"
        value={criticalCount}
        color="var(--severity-critical)"
        helper="Need immediate attention"
      />
      <Card
        label="Validated active"
        value={validatedActiveCount}
        color="var(--severity-high)"
        helper="Confirmed live credentials"
      />
      <Card
        label="Publicly exposed"
        value={publiclyExposedCount}
        color="var(--uw-cyan-02)"
        helper="Public or internet-facing assets"
      />
    </div>
  );
}
