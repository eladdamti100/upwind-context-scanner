// AddRulesModal.tsx — "Add rules" flow opened from the Classifications view.
// Two tabs: (A) Upwind-recommended suggested rules (Approve/Dismiss) and
// (B) Create a custom rule (manual form OR a mocked natural-language builder).
//
// MVP/demo only: no real rule engine and no real LLM call. The natural-language
// "Generate rule draft" produces a local, deterministic mock preview, and any
// created rule is explicitly a DRAFT that requires approval before activation.

import { useState } from 'react';
import { useStore } from '../../state/StoreContext';
import { Icon } from '../common/Icon';
import { SUGGESTED_RULES } from '../../data';
import type { SuggestedRule } from '../../types';

const RULE_TYPE_LABELS: Record<SuggestedRule['ruleType'], string> = {
  'default': 'Default',
  'vertical-specific': 'Vertical',
  'customer-specific': 'Customer',
};
const RULE_TYPE_COLORS: Record<SuggestedRule['ruleType'], { bg: string; color: string }> = {
  'default': { bg: 'rgba(148,163,184,0.13)', color: 'var(--text-tertiary)' },
  'vertical-specific': { bg: 'rgba(56,172,255,0.13)', color: 'var(--uw-metal-blue-02)' },
  'customer-specific': { bg: 'rgba(119,98,248,0.13)', color: 'var(--uw-royal-purple-02)' },
};

const SECTION_LABEL: React.CSSProperties = {
  fontSize: 10.5,
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--text-tertiary)',
  marginBottom: 8,
};
const FIELD_LABEL: React.CSSProperties = {
  fontSize: 11.5,
  fontWeight: 500,
  color: 'var(--text-secondary)',
  marginBottom: 4,
  display: 'block',
};
const INPUT: React.CSSProperties = {
  width: '100%',
  background: 'var(--bg-tertiary)',
  border: '1px solid var(--border-subtle)',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 13,
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-default-family)',
  outline: 'none',
};
const PRIMARY_BTN: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  cursor: 'pointer',
  background: 'var(--action-primary)',
  color: '#fff',
};
const GHOST_BTN: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--border-primary)',
  cursor: 'pointer',
  background: 'transparent',
  color: 'var(--text-primary)',
};

interface DraftPreview {
  title: string;
  scope: string;
  condition: string;
  action: string;
  reason: string;
}

// Deterministic, local-only mock of an LLM converting free text → a rule draft.
function mockDraftFromText(text: string): DraftPreview {
  const t = text.toLowerCase();
  const action =
    /downgrade|lower|reduce/.test(t) ? 'Downgrade severity'
    : /suppress|ignore|hide/.test(t) ? 'Suppress finding'
    : /raise|increase|escalate/.test(t) ? 'Raise severity'
    : 'Flag for review';
  const scope =
    /readme|docs|documentation/.test(t) ? 'Documentation paths'
    : /test|fixture|spec/.test(t) ? 'Test paths'
    : /prod|production/.test(t) ? 'Production configs'
    : 'All findings';
  const words = text.trim().split(/\s+/).filter(Boolean);
  const title = words.length
    ? words.slice(0, 7).join(' ').replace(/^./, c => c.toUpperCase())
    : 'Custom rule draft';
  return {
    title,
    scope,
    condition: text.trim() || '—',
    action,
    reason: 'Derived from a natural-language description.',
  };
}

export function AddRulesModal() {
  const { state, dispatch } = useStore();
  const [tab, setTab] = useState<'recommended' | 'custom'>('recommended');
  const [customMode, setCustomMode] = useState<'manual' | 'natural'>('manual');

  // manual form state
  const [form, setForm] = useState({ title: '', type: 'customer-specific', scope: '', condition: '', action: '', reason: '' });
  // natural-language state
  const [nlText, setNlText] = useState('');
  const [draft, setDraft] = useState<DraftPreview | null>(null);

  if (!state.addRulesOpen) return null;

  function close() {
    dispatch({ type: 'CLOSE_ADD_RULES' });
  }

  const tabBtn = (key: 'recommended' | 'custom'): React.CSSProperties => ({
    flex: 1,
    height: 34,
    borderRadius: 7,
    border: 'none',
    cursor: 'pointer',
    fontSize: 13,
    fontWeight: tab === key ? 600 : 500,
    background: tab === key ? 'var(--surface)' : 'transparent',
    color: tab === key ? 'var(--text-primary)' : 'var(--text-secondary)',
    boxShadow: tab === key ? 'var(--shadow-sm)' : 'none',
  });
  const modeBtn = (key: 'manual' | 'natural'): React.CSSProperties => ({
    height: 28,
    padding: '0 12px',
    borderRadius: 6,
    border: '1px solid ' + (customMode === key ? 'var(--action-primary)' : 'var(--border-subtle)'),
    cursor: 'pointer',
    fontSize: 12,
    background: customMode === key ? 'var(--uw-primary-06)' : 'transparent',
    color: customMode === key ? 'var(--uw-primary-01)' : 'var(--text-secondary)',
  });

  return (
    <>
      {/* backdrop */}
      <div
        aria-hidden="true"
        onClick={close}
        style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 55 }}
      />
      {/* modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Add rules"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'fixed',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          zIndex: 56,
          width: 820,
          maxWidth: '94vw',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          boxShadow: 'var(--shadow-lg, 0 10px 30px rgba(0,0,0,0.5))',
          padding: 28,
        }}
      >
        {/* header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Add rules</div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginTop: 3 }}>
              Review Upwind recommendations or define a customer-specific rule.
            </div>
          </div>
          <button
            aria-label="Close"
            onClick={close}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 30, height: 30, borderRadius: 6, border: '1px solid var(--border-subtle)',
              background: 'transparent', color: 'var(--text-secondary)', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <Icon name="x" size={14} />
          </button>
        </div>

        {/* tabs */}
        <div
          style={{
            display: 'flex', gap: 4, marginTop: 16, marginBottom: 18,
            background: 'var(--bg-tertiary)', borderRadius: 8, padding: 3,
          }}
        >
          <button style={tabBtn('recommended')} onClick={() => setTab('recommended')}>Recommended by Upwind</button>
          <button style={tabBtn('custom')} onClick={() => setTab('custom')}>Create custom rule</button>
        </div>

        {/* ── Tab A: Recommended by Upwind ───────────────────────────────── */}
        {tab === 'recommended' && (
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 14, lineHeight: 1.5 }}>
              Generated from recurring findings and customer-specific patterns. Review and approve suggested
              rules before applying.
            </div>
            {SUGGESTED_RULES.map(r => {
              const status = state.suggestedRuleStatus[r.id] ?? r.status;
              const chip = RULE_TYPE_COLORS[r.ruleType];
              return (
                <div
                  key={r.id}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 10,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--text-primary)', flex: 1 }}>{r.title}</span>
                    <span style={{ fontSize: 10.5, fontWeight: 500, padding: '2px 8px', borderRadius: 99, background: chip.bg, color: chip.color, whiteSpace: 'nowrap' }}>
                      {RULE_TYPE_LABELS[r.ruleType]}
                    </span>
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 5 }}>{r.description}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-tertiary)', marginBottom: status === 'suggested' ? 10 : 0 }}>
                    {r.scope}{' · '}{r.affectedFindingsCount.toLocaleString()} findings affected
                  </div>
                  {status === 'suggested' ? (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        style={{ ...PRIMARY_BTN, padding: '6px 12px', fontSize: 12.5 }}
                        onClick={() => {
                          dispatch({ type: 'SET_SUGGESTED_RULE_STATUS', id: r.id, status: 'approved' });
                          dispatch({ type: 'SHOW_TOAST', message: 'Rule approved' });
                        }}
                      >
                        Approve
                      </button>
                      <button
                        style={{ ...GHOST_BTN, padding: '6px 12px', fontSize: 12.5 }}
                        onClick={() => {
                          dispatch({ type: 'SET_SUGGESTED_RULE_STATUS', id: r.id, status: 'dismissed' });
                          dispatch({ type: 'SHOW_TOAST', message: 'Suggestion dismissed' });
                        }}
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : (
                    <span
                      style={{
                        display: 'inline-block', fontSize: 11, fontWeight: 500, padding: '2px 10px', borderRadius: 99,
                        background: status === 'approved' ? 'var(--severity-safe-bg)' : 'rgba(148,163,184,0.13)',
                        color: status === 'approved' ? 'var(--severity-safe)' : 'var(--text-tertiary)',
                      }}
                    >
                      {status === 'approved' ? 'Approved' : 'Dismissed'}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── Tab B: Create custom rule ──────────────────────────────────── */}
        {tab === 'custom' && (
          <div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <button style={modeBtn('manual')} onClick={() => setCustomMode('manual')}>Manual form</button>
              <button style={modeBtn('natural')} onClick={() => setCustomMode('natural')}>Natural language</button>
            </div>

            {customMode === 'manual' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <label style={FIELD_LABEL}>Rule title</label>
                  <input style={INPUT} value={form.title} placeholder="e.g. Downgrade example keys in docs"
                    onChange={e => setForm({ ...form, title: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={FIELD_LABEL}>Rule type</label>
                    <select style={INPUT} value={form.type} onChange={e => setForm({ ...form, type: e.target.value })}>
                      <option value="default">Default</option>
                      <option value="vertical-specific">Vertical-specific</option>
                      <option value="customer-specific">Customer-specific</option>
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={FIELD_LABEL}>Scope</label>
                    <input style={INPUT} value={form.scope} placeholder="e.g. Documentation paths"
                      onChange={e => setForm({ ...form, scope: e.target.value })} />
                  </div>
                </div>
                <div>
                  <label style={FIELD_LABEL}>Condition / pattern</label>
                  <input style={{ ...INPUT, fontFamily: 'var(--font-mono-family)' }} value={form.condition}
                    placeholder="e.g. detectedType = api-key AND path contains /docs/"
                    onChange={e => setForm({ ...form, condition: e.target.value })} />
                </div>
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ flex: 1 }}>
                    <label style={FIELD_LABEL}>Action</label>
                    <input style={INPUT} value={form.action} placeholder="e.g. Downgrade to Low"
                      onChange={e => setForm({ ...form, action: e.target.value })} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label style={FIELD_LABEL}>Reason</label>
                    <input style={INPUT} value={form.reason} placeholder="e.g. Reduce documentation noise"
                      onChange={e => setForm({ ...form, reason: e.target.value })} />
                  </div>
                </div>
                <DraftNote />
                <div>
                  <button
                    style={{ ...PRIMARY_BTN, opacity: form.title.trim() ? 1 : 0.5 }}
                    disabled={!form.title.trim()}
                    onClick={() => {
                      dispatch({ type: 'SHOW_TOAST', message: 'Draft rule created — pending approval' });
                      dispatch({ type: 'CLOSE_ADD_RULES' });
                    }}
                  >
                    Create rule
                  </button>
                </div>
              </div>
            )}

            {customMode === 'natural' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                  Describe the rule in plain language and SignalLens will convert it into a structured
                  customer rule.
                </div>
                <div>
                  <label style={FIELD_LABEL}>Rule description</label>
                  <textarea
                    style={{ ...INPUT, minHeight: 140, resize: 'vertical', lineHeight: 1.55 }}
                    value={nlText}
                    placeholder="e.g. Downgrade API-key-looking values in README files when the surrounding text says example or placeholder."
                    onChange={e => setNlText(e.target.value)}
                  />
                </div>
                <div>
                  <button
                    style={{ ...PRIMARY_BTN, opacity: nlText.trim() ? 1 : 0.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    disabled={!nlText.trim()}
                    onClick={() => setDraft(mockDraftFromText(nlText))}
                  >
                    <Icon name="shield" size={13} stroke="#fff" /> Generate rule
                  </button>
                </div>

                {draft && (
                  <div style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-subtle)', borderRadius: 8, padding: 16 }}>
                    <div style={SECTION_LABEL}>Rule preview</div>
                    {([
                      ['Title', draft.title],
                      ['Scope', draft.scope],
                      ['Condition', draft.condition],
                      ['Action', draft.action],
                      ['Reason', draft.reason],
                    ] as const).map(([k, val]) => (
                      <div key={k} style={{ display: 'flex', gap: 10, marginBottom: 6 }}>
                        <span style={{ width: 78, flexShrink: 0, fontSize: 11.5, color: 'var(--text-tertiary)' }}>{k}</span>
                        <span style={{ fontSize: 12.5, color: 'var(--text-primary)' }}>{val}</span>
                      </div>
                    ))}
                  </div>
                )}

                <DraftNote />
                {draft && (
                  <div>
                    <button
                      style={PRIMARY_BTN}
                      onClick={() => {
                        dispatch({ type: 'SHOW_TOAST', message: 'Rule created — pending review' });
                        dispatch({ type: 'CLOSE_ADD_RULES' });
                      }}
                    >
                      Save rule
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

function DraftNote() {
  return (
    <div
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 6,
        fontSize: 11, color: 'var(--text-tertiary)',
        background: 'var(--uw-amber-06, rgba(255,135,16,0.08))',
        border: '1px solid var(--border-subtle)', borderRadius: 6, padding: '8px 10px',
      }}
    >
      <span style={{ flexShrink: 0, marginTop: 1, color: 'var(--severity-safe)' }}>
        <Icon name="info" size={12} />
      </span>
      <span>Generated rules can be reviewed before activation.</span>
    </div>
  );
}
