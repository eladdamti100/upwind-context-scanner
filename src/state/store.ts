import type { ValidationStatus, FindingStatus, SnoozeInfo } from '../types';
import type { Filter } from '../lib/query';
import type { Action } from './actions';

// ---------------------------------------------------------------------------
// Sub-state shapes
// ---------------------------------------------------------------------------

export type TabKey = 'findings' | 'classifications' | 'map';

export interface ColumnState {
  id: string;
  label: string;
  vis: boolean;
  /** Required columns are always visible and cannot be toggled off. */
  required?: boolean;
}

export interface SettingsState {
  sensitivity: 'strict' | 'balanced' | 'flexible';
  vertical: 'saas' | 'fintech' | 'retail' | 'healthcare' | 'general';
  rulePacks: { default: boolean; vertical: boolean; customer: boolean };
  validationEnabled: boolean;
}

export interface LifecycleEntry {
  status: FindingStatus;
  snooze?: SnoozeInfo;
}

// ---------------------------------------------------------------------------
// AppState
// ---------------------------------------------------------------------------

export interface AppState {
  tab: TabKey;
  search: string;
  filters: Filter[];
  sortKey: string;
  sortDir: 'asc' | 'desc';
  cols: ColumnState[];
  rpp: number;
  /** Zero-based index of the current findings-table page. */
  pageIdx: number;
  menu: string | null;
  selectedId: number | null;
  actionsId: number | null;
  riskId: number | null;
  valModalId: number | null;
  validatingId: number | null;
  validations: Record<number, ValidationStatus>;
  fbId: number | null;
  feedback: Record<number, 'up' | 'down'>;
  lifecycleId: number | null;
  lifecycle: Record<number, LifecycleEntry>;
  classId: string | null;
  classSearch: string;
  classEnabled: Record<string, boolean>;
  mapKey: string | null;
  settingsOpen: boolean;
  settings: SettingsState;
  suggestedRuleStatus: Record<string, 'suggested' | 'approved' | 'dismissed'>;
  addRulesOpen: boolean;
  toast: string | null;
  // Bumped on every SHOW_TOAST so consumers can re-trigger auto-dismiss even
  // when the same message is shown twice in a row.
  toastNonce: number;
}

// ---------------------------------------------------------------------------
// Default columns
// ---------------------------------------------------------------------------

const DEFAULT_COLS: ColumnState[] = [
  // Required columns — always visible, cannot be turned off.
  // Actions leads the row so details/actions are reachable from the start.
  { id: 'actions',        label: 'Actions',              vis: true,  required: true },
  { id: 'risk',           label: 'Confidence Level',     vis: true,  required: true },
  { id: 'priority',       label: 'Remediation priority', vis: true,  required: true },
  { id: 'secretType',     label: 'Secret type',          vis: true,  required: true },
  { id: 'classification', label: 'Classification',       vis: true,  required: true },
  { id: 'validation',     label: 'Credential Check',     vis: true,  required: true },
  { id: 'file',           label: 'File name | path',     vis: true,  required: true },
  // Optional columns — user-configurable (hidden by default to keep it clean).
  { id: 'owner',          label: 'Owner',                vis: false },
  { id: 'environment',    label: 'Environment',          vis: false },
  { id: 'exposure',       label: 'Exposure',             vis: false },
  { id: 'cloud',          label: 'Cloud',                vis: false },
  { id: 'createdAt',      label: 'Created at',           vis: false },
  { id: 'explanation',    label: 'Reason',               vis: false },
];

// Deep-copy helper so RESET_COLS can restore defaults without aliasing
function cloneCols(cols: ColumnState[]): ColumnState[] {
  return cols.map(c => ({ ...c }));
}

// ---------------------------------------------------------------------------
// initialState
// ---------------------------------------------------------------------------

export const initialState: AppState = {
  tab: 'findings',
  search: '',
  filters: [],
  sortKey: 'risk',
  sortDir: 'desc',
  cols: cloneCols(DEFAULT_COLS),
  rpp: 10,
  pageIdx: 0,
  menu: null,
  selectedId: null,
  actionsId: null,
  riskId: null,
  valModalId: null,
  validatingId: null,
  validations: {},
  fbId: null,
  feedback: {},
  lifecycleId: null,
  lifecycle: {},
  classId: null,
  classSearch: '',
  classEnabled: {},
  mapKey: null,
  settingsOpen: false,
  settings: {
    sensitivity: 'balanced',
    vertical: 'general',
    rulePacks: { default: true, vertical: true, customer: false },
    validationEnabled: true,
  },
  suggestedRuleStatus: {},
  addRulesOpen: false,
  toast: null,
  toastNonce: 0,
};

// ---------------------------------------------------------------------------
// reducer
// ---------------------------------------------------------------------------

export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    // ---- Navigation ----------------------------------------------------------
    case 'SET_TAB':
      return { ...state, tab: action.tab, menu: null, mapKey: null };

    // ---- Search / filters ----------------------------------------------------
    // Search / filter changes reset pagination back to the first page.
    case 'SET_SEARCH':
      return { ...state, search: action.search, pageIdx: 0 };

    case 'ADD_FILTER': {
      const withoutSameKey = state.filters.filter(f => f.key !== action.filter.key);
      return { ...state, filters: [...withoutSameKey, action.filter], pageIdx: 0 };
    }

    case 'REMOVE_FILTER': {
      const filters = state.filters.filter((_, i) => i !== action.index);
      return { ...state, filters, pageIdx: 0 };
    }

    case 'CLEAR_FILTERS':
      return { ...state, filters: [], pageIdx: 0 };

    // ---- Sort ----------------------------------------------------------------
    case 'SET_SORT': {
      if (state.sortKey === action.key) {
        return { ...state, sortDir: state.sortDir === 'desc' ? 'asc' : 'desc' };
      }
      return { ...state, sortKey: action.key, sortDir: 'desc' };
    }

    // ---- Columns -------------------------------------------------------------
    case 'TOGGLE_COL': {
      // Required columns are always visible and cannot be toggled off.
      if (state.cols[action.index]?.required) return state;
      const cols = state.cols.map((c, i) =>
        i === action.index ? { ...c, vis: !c.vis } : c,
      );
      return { ...state, cols };
    }

    case 'MOVE_COL': {
      const cols = cloneCols(state.cols);
      const { index, dir } = action;
      if (dir === 'up' && index > 0) {
        [cols[index - 1], cols[index]] = [cols[index], cols[index - 1]];
      } else if (dir === 'down' && index < cols.length - 1) {
        [cols[index + 1], cols[index]] = [cols[index], cols[index + 1]];
      }
      return { ...state, cols };
    }

    case 'RESET_COLS':
      return { ...state, cols: cloneCols(DEFAULT_COLS) };

    // ---- Pagination ----------------------------------------------------------
    case 'SET_RPP':
      return { ...state, rpp: action.rpp, pageIdx: 0 };

    case 'SET_PAGE':
      return { ...state, pageIdx: Math.max(0, action.page) };

    // ---- Dropdown menu -------------------------------------------------------
    case 'TOGGLE_MENU':
      return { ...state, menu: state.menu === action.menu ? null : action.menu };

    case 'CLOSE_MENU':
      return { ...state, menu: null };

    // ---- Detail drawer -------------------------------------------------------
    case 'OPEN_DETAIL':
      return { ...state, selectedId: action.id };

    case 'CLOSE_DETAIL':
      return { ...state, selectedId: null };

    // ---- Row actions modal ---------------------------------------------------
    case 'OPEN_ACTIONS':
      return { ...state, actionsId: action.id, menu: null };

    case 'CLOSE_ACTIONS':
      return { ...state, actionsId: null };

    // ---- Risk popover --------------------------------------------------------
    case 'OPEN_RISK':
      return { ...state, riskId: action.id };

    case 'CLOSE_RISK':
      return { ...state, riskId: null };

    // ---- Validation modal ----------------------------------------------------
    case 'OPEN_VAL_MODAL':
      return { ...state, valModalId: action.id };

    case 'CLOSE_VAL_MODAL':
      return { ...state, valModalId: null };

    case 'START_VALIDATION':
      return { ...state, validatingId: action.id, valModalId: null };

    case 'FINISH_VALIDATION':
      return {
        ...state,
        validations: { ...state.validations, [action.id]: action.status },
        validatingId: null,
      };

    // ---- ML feedback ---------------------------------------------------------
    case 'SET_FEEDBACK':
      return { ...state, feedback: { ...state.feedback, [action.id]: action.value } };

    case 'OPEN_FB':
      return { ...state, fbId: action.id };

    case 'CLOSE_FB':
      return { ...state, fbId: null };

    // ---- Lifecycle / triage --------------------------------------------------
    case 'OPEN_LIFECYCLE':
      return { ...state, lifecycleId: action.id };

    case 'CLOSE_LIFECYCLE':
      return { ...state, lifecycleId: null };

    case 'SET_LIFECYCLE_STATUS': {
      const existing = state.lifecycle[action.id] ?? {};
      return {
        ...state,
        lifecycle: {
          ...state.lifecycle,
          [action.id]: { ...existing, status: action.status },
        },
        lifecycleId: null,
      };
    }

    case 'SNOOZE':
      return {
        ...state,
        lifecycle: {
          ...state.lifecycle,
          [action.id]: { status: 'snoozed', snooze: action.snooze },
        },
        lifecycleId: null,
      };

    // ---- Classifications tab -------------------------------------------------
    case 'OPEN_CLASS':
      return { ...state, classId: action.id };

    case 'CLOSE_CLASS':
      return { ...state, classId: null };

    case 'SET_CLASS_SEARCH':
      return { ...state, classSearch: action.search };

    case 'TOGGLE_CLASS_ENABLED': {
      const current = state.classEnabled[action.id] ?? true;
      return { ...state, classEnabled: { ...state.classEnabled, [action.id]: !current } };
    }

    // ---- Map tab -------------------------------------------------------------
    case 'OPEN_MAP_ASSET':
      return { ...state, mapKey: action.key };

    case 'CLOSE_MAP_ASSET':
      return { ...state, mapKey: null };

    // ---- Settings panel ------------------------------------------------------
    case 'OPEN_SETTINGS':
      return { ...state, settingsOpen: true };

    case 'CLOSE_SETTINGS':
      return { ...state, settingsOpen: false };

    case 'SET_SENSITIVITY':
      return { ...state, settings: { ...state.settings, sensitivity: action.sensitivity } };

    case 'SET_VERTICAL':
      return { ...state, settings: { ...state.settings, vertical: action.vertical } };

    case 'TOGGLE_RULE_PACK': {
      const rulePacks = { ...state.settings.rulePacks, [action.pack]: !state.settings.rulePacks[action.pack] };
      return { ...state, settings: { ...state.settings, rulePacks } };
    }

    case 'SET_VALIDATION_ENABLED':
      return { ...state, settings: { ...state.settings, validationEnabled: action.value } };

    // ---- Suggested rules -----------------------------------------------------
    case 'SET_SUGGESTED_RULE_STATUS':
      return {
        ...state,
        suggestedRuleStatus: { ...state.suggestedRuleStatus, [action.id]: action.status },
      };

    // ---- Add rules modal -----------------------------------------------------
    case 'OPEN_ADD_RULES':
      return { ...state, addRulesOpen: true };

    case 'CLOSE_ADD_RULES':
      return { ...state, addRulesOpen: false };

    // ---- Toast ---------------------------------------------------------------
    case 'SHOW_TOAST':
      return { ...state, toast: action.message, toastNonce: state.toastNonce + 1 };

    case 'HIDE_TOAST':
      return { ...state, toast: null };

    default: {
      // Exhaustiveness check
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}
