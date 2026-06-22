// AssetPanel.tsx — Right-side slide-in panel for map asset details.
// Resolves the selected key against MAP_ASSETS first, then EXTERNAL_AI_NODES.
// Never displays full secrets — all findings use masked/structured values only.

import { MAP_ASSETS, EXTERNAL_AI_NODES } from '../../data';
import { priStyle, priLabel } from '../../lib/classify';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import type { Priority } from '../../types';

// ---- Priority chip -----------------------------------------------------------

function PriorityChip({ priority }: { priority: Priority }) {
  const { fg, bg } = priStyle(priority);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 6,
        background: bg,
        color: fg,
        fontSize: 11,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: '50%', background: fg, flexShrink: 0 }} />
      {priLabel(priority)}
    </span>
  );
}

// ---- Fact row ----------------------------------------------------------------

function Fact({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 8,
        padding: '6px 0',
        borderBottom: '1px solid var(--border-subtle)',
        alignItems: 'flex-start',
      }}
    >
      <span
        style={{
          flex: '0 0 140px',
          fontSize: 12,
          color: 'var(--text-tertiary)',
          fontWeight: 500,
          paddingTop: 1,
        }}
      >
        {label}
      </span>
      <span style={{ fontSize: 12, color: 'var(--text-primary)', flex: 1 }}>{value}</span>
    </div>
  );
}

// ---- Action button -----------------------------------------------------------

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: '1px solid var(--border-subtle)',
        background: 'var(--surface-elevated)',
        color: 'var(--text-primary)',
        fontSize: 12,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: 'var(--font-default-family)',
        transition: 'background 120ms',
      }}
    >
      {label}
    </button>
  );
}

// ---- AssetPanel --------------------------------------------------------------

export function AssetPanel() {
  const { state, dispatch } = useStore();
  if (!state.mapKey) return null;

  const asset  = MAP_ASSETS[state.mapKey];
  const aiNode = EXTERNAL_AI_NODES.find(n => n.key === state.mapKey);

  if (!asset && !aiNode) return null;

  const close = () => dispatch({ type: 'CLOSE_MAP_ASSET' });
  const toast = (msg: string) => dispatch({ type: 'SHOW_TOAST', message: msg });

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={close}
        style={{ position: 'fixed', inset: 0, zIndex: 40 }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          right: 0,
          top: 0,
          width: 380,
          height: '100%',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border-subtle)',
          overflow: 'auto',
          zIndex: 50,
          animation: 'uwslide 140ms ease',
          fontFamily: 'var(--font-default-family)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-subtle)',
            position: 'sticky',
            top: 0,
            background: 'var(--surface)',
            zIndex: 1,
            gap: 8,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div
              style={{
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--text-primary)',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {asset ? asset.name : aiNode!.provider}
            </div>
            {aiNode && (
              <div style={{ fontSize: 11, color: 'var(--uw-royal-purple-03)', marginTop: 2 }}>
                External AI service
              </div>
            )}
          </div>
          <button
            onClick={close}
            aria-label="Close panel"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-tertiary)',
              padding: 4,
              borderRadius: 4,
              flexShrink: 0,
            }}
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '16px 20px', flex: 1, overflowY: 'auto' }}>
          {asset ? (
            <>
              {/* Facts */}
              <div style={{ marginBottom: 20 }}>
                <Fact label="Cloud"            value={asset.cloud} />
                <Fact label="Kind"             value={asset.kind} />
                <Fact label="Exposure"         value={asset.exposure} />
                <Fact label="Environment"      value={asset.environment} />
                <Fact label="Asset criticality" value={asset.assetCriticality} />
                <Fact label="Highest severity" value={<PriorityChip priority={asset.highestSeverity} />} />
                <Fact label="Validation"       value={asset.validationSummary} />
              </div>

              {/* Findings */}
              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Findings
                <span
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 20,
                    padding: '1px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {asset.findings.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 22 }}>
                {asset.findings.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 7,
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 3,
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {f.detectedType}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{f.validation}</div>
                    </div>
                    <PriorityChip priority={f.priority} />
                  </div>
                ))}
              </div>

              {/* Actions */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                <button
                  onClick={() => {
                    dispatch({ type: 'SET_TAB', tab: 'findings' });
                    dispatch({ type: 'CLOSE_MAP_ASSET' });
                    toast('Showing findings for ' + asset.name);
                  }}
                  style={{
                    padding: '6px 14px',
                    borderRadius: 6,
                    border: 'none',
                    background: 'var(--action-primary)',
                    color: 'var(--text-inverse)',
                    fontSize: 12,
                    fontWeight: 600,
                    cursor: 'pointer',
                    fontFamily: 'var(--font-default-family)',
                  }}
                >
                  View findings
                </button>
                <ActionBtn label="Validate all" onClick={() => toast('Validation triggered for ' + asset.name)} />
                <ActionBtn label="Export"       onClick={() => toast('Exported findings for ' + asset.name)} />
                <ActionBtn label="Suppress"     onClick={() => toast('Suppressed findings for ' + asset.name)} />
              </div>
            </>
          ) : (
            /* External AI node panel */
            <>
              <div
                style={{
                  background: 'var(--uw-royal-purple-06)',
                  border: '1px solid var(--uw-royal-purple-04)',
                  borderRadius: 8,
                  padding: '11px 14px',
                  fontSize: 12,
                  color: 'var(--uw-royal-purple-02)',
                  marginBottom: 20,
                  lineHeight: 1.55,
                }}
              >
                Sensitive payloads were sent to this external model provider. Review findings below for exposed credentials.
              </div>

              <div
                style={{
                  fontSize: 12,
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  marginBottom: 10,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                Findings
                <span
                  style={{
                    background: 'var(--surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 20,
                    padding: '1px 8px',
                    fontSize: 11,
                    fontWeight: 600,
                    color: 'var(--text-secondary)',
                  }}
                >
                  {aiNode!.findings.length}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {aiNode!.findings.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      background: 'var(--surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 7,
                      padding: '9px 12px',
                      display: 'flex',
                      alignItems: 'flex-start',
                      justifyContent: 'space-between',
                      gap: 8,
                    }}
                  >
                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: 12,
                          fontWeight: 600,
                          color: 'var(--text-primary)',
                          marginBottom: 3,
                        }}
                      >
                        {f.detectedType}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{f.validation}</div>
                    </div>
                    <PriorityChip priority={f.priority} />
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
