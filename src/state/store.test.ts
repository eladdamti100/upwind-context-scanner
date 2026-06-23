import { test, expect, describe } from 'vitest';
import { reducer, initialState } from './store';
import type { AppState } from './store';
import type { Action } from './actions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function dispatch(state: AppState, action: Action): AppState {
  return reducer(state, action);
}

// ---------------------------------------------------------------------------
// initialState defaults
// ---------------------------------------------------------------------------

describe('initialState defaults', () => {
  test('tab is "findings"', () => {
    expect(initialState.tab).toBe('findings');
  });

  test('sensitivity is "balanced"', () => {
    expect(initialState.settings.sensitivity).toBe('balanced');
  });

  test('rpp is 10', () => {
    expect(initialState.rpp).toBe(10);
  });

  test('sortKey is "risk"', () => {
    expect(initialState.sortKey).toBe('risk');
  });

  test('sortDir is "desc"', () => {
    expect(initialState.sortDir).toBe('desc');
  });

  test('priority column label is "Remediation priority"', () => {
    const col = initialState.cols.find(c => c.id === 'priority');
    expect(col).toBeDefined();
    expect(col!.label).toBe('Remediation priority');
  });

  test('search is empty string', () => {
    expect(initialState.search).toBe('');
  });

  test('filters is empty array', () => {
    expect(initialState.filters).toEqual([]);
  });

  test('menu is null', () => {
    expect(initialState.menu).toBeNull();
  });

  test('settingsOpen is false', () => {
    expect(initialState.settingsOpen).toBe(false);
  });

  test('vertical is "general"', () => {
    expect(initialState.settings.vertical).toBe('general');
  });

  test('rulePacks default is {default:true, vertical:true, customer:false}', () => {
    expect(initialState.settings.rulePacks).toEqual({ default: true, vertical: true, customer: false });
  });

  test('validationEnabled is true', () => {
    expect(initialState.settings.validationEnabled).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SET_TAB — clears menu and mapKey
// ---------------------------------------------------------------------------

test('SET_TAB switches tab and clears menu + mapKey', () => {
  const state: AppState = {
    ...initialState,
    menu: 'some-menu-id',
    mapKey: 'asset-123',
  };

  const next = dispatch(state, { type: 'SET_TAB', tab: 'classifications' });

  expect(next.tab).toBe('classifications');
  expect(next.menu).toBeNull();
  expect(next.mapKey).toBeNull();
});

// ---------------------------------------------------------------------------
// ADD_FILTER — replaces filter with same key
// ---------------------------------------------------------------------------

test('ADD_FILTER appends a new filter', () => {
  const filter = { key: 'priority', val: 'critical', label: 'Critical' };
  const next = dispatch(initialState, { type: 'ADD_FILTER', filter });
  expect(next.filters).toHaveLength(1);
  expect(next.filters[0]).toEqual(filter);
});

test('ADD_FILTER replaces existing filter with same key', () => {
  const first = { key: 'priority', val: 'critical', label: 'Critical' };
  const second = { key: 'priority', val: 'high', label: 'High' };
  const after_first = dispatch(initialState, { type: 'ADD_FILTER', filter: first });
  // Add different key to verify only the matching key is replaced
  const with_env = dispatch(after_first, { type: 'ADD_FILTER', filter: { key: 'env', val: 'Production', label: 'Production' } });
  const next = dispatch(with_env, { type: 'ADD_FILTER', filter: second });

  expect(next.filters).toHaveLength(2);
  const priorityFilter = next.filters.find(f => f.key === 'priority');
  expect(priorityFilter!.val).toBe('high');
});

// ---------------------------------------------------------------------------
// TOGGLE_COL — flips vis
// ---------------------------------------------------------------------------

test('TOGGLE_COL flips column visibility', () => {
  const index = initialState.cols.findIndex(c => c.id === 'environment');
  expect(initialState.cols[index].vis).toBe(false); // starts hidden

  const next = dispatch(initialState, { type: 'TOGGLE_COL', index });
  expect(next.cols[index].vis).toBe(true);

  // Toggle back
  const next2 = dispatch(next, { type: 'TOGGLE_COL', index });
  expect(next2.cols[index].vis).toBe(false);
});

test('TOGGLE_COL is a no-op for required columns', () => {
  const index = initialState.cols.findIndex(c => c.id === 'risk'); // Confidence Level — required
  expect(initialState.cols[index].required).toBe(true);
  expect(initialState.cols[index].vis).toBe(true);

  const next = dispatch(initialState, { type: 'TOGGLE_COL', index });
  expect(next.cols[index].vis).toBe(true); // stays visible
});

test('the required columns are exactly the expected set, in order, leading the defaults', () => {
  const requiredIds = initialState.cols.filter(c => c.required).map(c => c.id);
  expect(requiredIds).toEqual(['actions', 'risk', 'priority', 'secretType', 'classification', 'validation', 'file']);
  // Actions leads the row, Confidence Level follows
  expect(initialState.cols[0].id).toBe('actions');
  expect(initialState.cols[1].id).toBe('risk');
  expect(initialState.cols[1].label).toBe('% Confidence');
});

// ---------------------------------------------------------------------------
// MOVE_COL — up swaps adjacent
// ---------------------------------------------------------------------------

test('MOVE_COL up swaps column with the one above', () => {
  const index = 2; // 'secretType' (0-based)
  const colAtIndex = initialState.cols[index].id;
  const colAbove = initialState.cols[index - 1].id;

  const next = dispatch(initialState, { type: 'MOVE_COL', index, dir: 'up' });

  expect(next.cols[index - 1].id).toBe(colAtIndex);
  expect(next.cols[index].id).toBe(colAbove);
});

test('MOVE_COL up is no-op at index 0', () => {
  const next = dispatch(initialState, { type: 'MOVE_COL', index: 0, dir: 'up' });
  expect(next.cols.map(c => c.id)).toEqual(initialState.cols.map(c => c.id));
});

test('MOVE_COL down is no-op at last index', () => {
  const lastIndex = initialState.cols.length - 1;
  const next = dispatch(initialState, { type: 'MOVE_COL', index: lastIndex, dir: 'down' });
  expect(next.cols.map(c => c.id)).toEqual(initialState.cols.map(c => c.id));
});

// ---------------------------------------------------------------------------
// RESET_COLS — restores default columns
// ---------------------------------------------------------------------------

test('RESET_COLS restores default column order and visibility', () => {
  // Mutate cols then reset
  const modified = dispatch(initialState, { type: 'TOGGLE_COL', index: 0 });
  const modified2 = dispatch(modified, { type: 'MOVE_COL', index: 1, dir: 'up' });
  expect(modified2.cols).not.toEqual(initialState.cols);

  const reset = dispatch(modified2, { type: 'RESET_COLS' });
  expect(reset.cols).toEqual(initialState.cols);
});

// ---------------------------------------------------------------------------
// START_VALIDATION → FINISH_VALIDATION
// ---------------------------------------------------------------------------

test('START_VALIDATION sets validatingId and clears valModalId', () => {
  const state: AppState = { ...initialState, valModalId: 42 };
  const next = dispatch(state, { type: 'START_VALIDATION', id: 42 });
  expect(next.validatingId).toBe(42);
  expect(next.valModalId).toBeNull();
});

test('FINISH_VALIDATION writes validations[id] and clears validatingId', () => {
  const state: AppState = { ...initialState, validatingId: 42 };
  const next = dispatch(state, { type: 'FINISH_VALIDATION', id: 42, status: 'validated-active' });
  expect(next.validations[42]).toBe('validated-active');
  expect(next.validatingId).toBeNull();
});

// ---------------------------------------------------------------------------
// SET_LIFECYCLE_STATUS — writes status
// ---------------------------------------------------------------------------

test('SET_LIFECYCLE_STATUS sets lifecycle[id].status', () => {
  const next = dispatch(initialState, { type: 'SET_LIFECYCLE_STATUS', id: 7, status: 'in-review' });
  expect(next.lifecycle[7].status).toBe('in-review');
  expect(next.lifecycleId).toBeNull();
});

test('SET_LIFECYCLE_STATUS preserves existing snooze if present', () => {
  const snooze = { until: '2024-12-31', reason: 'waiting', applyToSimilar: false };
  const state: AppState = {
    ...initialState,
    lifecycle: { 7: { status: 'snoozed', snooze } },
  };
  const next = dispatch(state, { type: 'SET_LIFECYCLE_STATUS', id: 7, status: 'in-review' });
  expect(next.lifecycle[7].status).toBe('in-review');
  expect(next.lifecycle[7].snooze).toEqual(snooze);
});

// ---------------------------------------------------------------------------
// SNOOZE — sets status 'snoozed' + clears lifecycleId
// ---------------------------------------------------------------------------

test('SNOOZE sets lifecycle[id] status to "snoozed" and attaches snooze info', () => {
  const snooze = { until: '2025-01-15', reason: 'low priority', applyToSimilar: true };
  const state: AppState = { ...initialState, lifecycleId: 10 };
  const next = dispatch(state, { type: 'SNOOZE', id: 10, snooze });
  expect(next.lifecycle[10].status).toBe('snoozed');
  expect(next.lifecycle[10].snooze).toEqual(snooze);
  expect(next.lifecycleId).toBeNull();
});

// ---------------------------------------------------------------------------
// SET_SENSITIVITY / SET_VERTICAL — update settings
// ---------------------------------------------------------------------------

test('SET_SENSITIVITY updates settings.sensitivity', () => {
  const next = dispatch(initialState, { type: 'SET_SENSITIVITY', sensitivity: 'strict' });
  expect(next.settings.sensitivity).toBe('strict');
});

test('SET_VERTICAL updates settings.vertical', () => {
  const next = dispatch(initialState, { type: 'SET_VERTICAL', vertical: 'fintech' });
  expect(next.settings.vertical).toBe('fintech');
});

// ---------------------------------------------------------------------------
// TOGGLE_RULE_PACK — flips
// ---------------------------------------------------------------------------

test('TOGGLE_RULE_PACK flips a rule pack boolean', () => {
  expect(initialState.settings.rulePacks.customer).toBe(false);
  const next = dispatch(initialState, { type: 'TOGGLE_RULE_PACK', pack: 'customer' });
  expect(next.settings.rulePacks.customer).toBe(true);

  // Toggle back
  const next2 = dispatch(next, { type: 'TOGGLE_RULE_PACK', pack: 'customer' });
  expect(next2.settings.rulePacks.customer).toBe(false);
});

test('TOGGLE_RULE_PACK for "default" pack', () => {
  expect(initialState.settings.rulePacks.default).toBe(true);
  const next = dispatch(initialState, { type: 'TOGGLE_RULE_PACK', pack: 'default' });
  expect(next.settings.rulePacks.default).toBe(false);
});

// ---------------------------------------------------------------------------
// SET_SUGGESTED_RULE_STATUS — writes
// ---------------------------------------------------------------------------

test('SET_SUGGESTED_RULE_STATUS writes status for given id', () => {
  const next = dispatch(initialState, {
    type: 'SET_SUGGESTED_RULE_STATUS',
    id: 'rule-abc',
    status: 'approved',
  });
  expect(next.suggestedRuleStatus['rule-abc']).toBe('approved');
});

// ---------------------------------------------------------------------------
// Immutability — no mutation of state
// ---------------------------------------------------------------------------

test('reducer does not mutate the input state', () => {
  const original = { ...initialState };
  const originalCols = initialState.cols.map(c => ({ ...c }));
  const originalFilters = [...initialState.filters];

  // Run a few actions
  dispatch(initialState, { type: 'SET_TAB', tab: 'map' });
  dispatch(initialState, { type: 'ADD_FILTER', filter: { key: 'priority', val: 'high', label: 'High' } });
  dispatch(initialState, { type: 'TOGGLE_COL', index: 0 });

  // initialState must be unchanged
  expect(initialState.tab).toBe(original.tab);
  expect(initialState.cols).toEqual(originalCols);
  expect(initialState.filters).toEqual(originalFilters);
  expect(initialState.menu).toBe(original.menu);
});
