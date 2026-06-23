import type { Sensitivity, Vertical, ValidationStatus, FindingStatus, SnoozeInfo } from '../types';
import type { Filter } from '../lib/query';

// Re-export for convenience
export type { Sensitivity, Vertical, ValidationStatus, FindingStatus, SnoozeInfo, Filter };

// ---------------------------------------------------------------------------
// Discriminated union of all AppAction types
// ---------------------------------------------------------------------------

export type Action =
  | { type: 'SET_TAB'; tab: 'findings' | 'classifications' | 'map' }
  | { type: 'SET_SEARCH'; search: string }
  | { type: 'ADD_FILTER'; filter: Filter }
  | { type: 'REMOVE_FILTER'; index: number }
  | { type: 'CLEAR_FILTERS' }
  | { type: 'SET_SORT'; key: string }
  | { type: 'TOGGLE_COL'; index: number }
  | { type: 'MOVE_COL'; index: number; dir: 'up' | 'down' }
  | { type: 'RESET_COLS' }
  | { type: 'SET_RPP'; rpp: number }
  | { type: 'SET_PAGE'; page: number }
  | { type: 'TOGGLE_MENU'; menu: string }
  | { type: 'CLOSE_MENU' }
  | { type: 'OPEN_DETAIL'; id: number }
  | { type: 'CLOSE_DETAIL' }
  | { type: 'OPEN_ACTIONS'; id: number }
  | { type: 'CLOSE_ACTIONS' }
  | { type: 'OPEN_RISK'; id: number }
  | { type: 'CLOSE_RISK' }
  | { type: 'OPEN_VAL_MODAL'; id: number }
  | { type: 'CLOSE_VAL_MODAL' }
  | { type: 'START_VALIDATION'; id: number }
  | { type: 'FINISH_VALIDATION'; id: number; status: ValidationStatus }
  | { type: 'SET_FEEDBACK'; id: number; value: 'up' | 'down' }
  | { type: 'OPEN_FB'; id: number }
  | { type: 'CLOSE_FB' }
  | { type: 'OPEN_LIFECYCLE'; id: number }
  | { type: 'CLOSE_LIFECYCLE' }
  | { type: 'SET_LIFECYCLE_STATUS'; id: number; status: FindingStatus }
  | { type: 'SNOOZE'; id: number; snooze: SnoozeInfo }
  | { type: 'OPEN_CLASS'; id: string }
  | { type: 'CLOSE_CLASS' }
  | { type: 'SET_CLASS_SEARCH'; search: string }
  | { type: 'TOGGLE_CLASS_ENABLED'; id: string }
  | { type: 'OPEN_MAP_ASSET'; key: string }
  | { type: 'CLOSE_MAP_ASSET' }
  | { type: 'OPEN_SETTINGS' }
  | { type: 'CLOSE_SETTINGS' }
  | { type: 'SET_SENSITIVITY'; sensitivity: Sensitivity }
  | { type: 'SET_VERTICAL'; vertical: Vertical }
  | { type: 'TOGGLE_RULE_PACK'; pack: 'default' | 'vertical' | 'customer' }
  | { type: 'SET_VALIDATION_ENABLED'; value: boolean }
  | { type: 'SET_SUGGESTED_RULE_STATUS'; id: string; status: 'suggested' | 'approved' | 'dismissed' }
  | { type: 'OPEN_ADD_RULES' }
  | { type: 'CLOSE_ADD_RULES' }
  | { type: 'SHOW_TOAST'; message: string }
  | { type: 'HIDE_TOAST' };
