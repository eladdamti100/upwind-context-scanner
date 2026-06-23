import { FINDINGS } from '../../data';
import { effPriority } from '../../lib/priority';
import { useStore } from '../../state/StoreContext';
import { Icon, IconName } from '../common/Icon';

interface CardProps {
  label: string;
  value: number;
  valueColor: string;
  helper: string;
  iconName: IconName;
  tileBg: string;
  iconStroke: string;
}

function Card({ label, value, valueColor, helper, iconName, tileBg, iconStroke }: CardProps) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 10,
        boxShadow: 'var(--shadow-sm)',
        padding: '14px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      {/* Icon tile */}
      <div
        style={{
          flexShrink: 0,
          width: 38,
          height: 38,
          borderRadius: 9,
          background: tileBg,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name={iconName} size={18} stroke={iconStroke} strokeWidth={2} />
      </div>

      {/* Text stack */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <span
          style={{
            fontSize: 26,
            fontWeight: 700,
            lineHeight: 1,
            letterSpacing: '-0.02em',
            color: valueColor,
          }}
        >
          {value}
        </span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: 'var(--text-primary)',
            lineHeight: 1.3,
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 10.5,
            color: 'var(--text-tertiary)',
            lineHeight: 1.3,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {helper}
        </span>
      </div>
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
        gap: 12,
        marginBottom: 12,
      }}
    >
      <Card
        label="Total exposed findings"
        value={totalCount}
        valueColor="var(--text-primary)"
        helper="Context-aware findings"
        iconName="database"
        tileBg="var(--uw-blue-06)"
        iconStroke="var(--uw-blue-03)"
      />
      <Card
        label="Critical findings"
        value={criticalCount}
        valueColor="var(--severity-critical)"
        helper="Need immediate attention"
        iconName="alert-triangle"
        tileBg="var(--severity-critical-bg)"
        iconStroke="var(--severity-critical)"
      />
      <Card
        label="Validated active"
        value={validatedActiveCount}
        valueColor="var(--text-primary)"
        helper="Confirmed live credentials"
        iconName="shield"
        tileBg="var(--severity-safe-bg)"
        iconStroke="var(--severity-safe)"
      />
      <Card
        label="Publicly exposed"
        value={publiclyExposedCount}
        valueColor="var(--uw-cyan-02)"
        helper="Public or internet-facing assets"
        iconName="globe"
        tileBg="var(--uw-cyan-06, var(--severity-info-bg))"
        iconStroke="var(--uw-cyan-02)"
      />
    </div>
  );
}
