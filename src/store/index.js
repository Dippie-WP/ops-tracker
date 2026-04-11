/**
 * store/index.js — Zustand store — single source of truth for AppState.
 *
 * Spec reference: §4 Frontend State Architecture
 *
 * Backend: extended with activity_log + users tables.
 * Activity fetched from GET /api/activity on load and filter change.
 * Optimistic updates: inject synthetic ActivityEntry on mutations.
 */

import { create } from 'zustand';
import api from '../api/client';

const DEFAULT_SORT = { field: 'created_at', order: 'DESC' };

// ── Optimistic helpers ───────────────────────────────────────────────────────

export function makeSyntheticEntry(type, userId, userName, taskId, opNumber, display) {
  return {
    id:          `synthetic-${Date.now()}`,
    task_id:     taskId,
    op_number:   opNumber,
    user_id:     userId || 'default',
    user_name:   userName || 'Zun',
    user_initials: userName ? userName.split(' ').map(n => n[0]).join('').toUpperCase() : 'ZU',
    type,
    display,
    timestamp:    new Date().toISOString(),
  };
}

function formatStatus(s) {
  if (!s) return '';
  return s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// ── URL ↔ State sync helpers ──────────────────────────────────────────────────

export function filtersToURL(filters) {
  const params = new URLSearchParams();
  if (filters.status)        params.set('status',      filters.status);
  if (filters.division)      params.set('division',    filters.division);
  if (filters.priority)      params.set('priority',    filters.priority);
  if (filters.search)         params.set('search',     filters.search);
  if (filters.activityType)   params.set('atype',      filters.activityType);
  if (filters.planned_date)   params.set('planned',    filters.planned_date);
  const str = params.toString();
  return str ? '?' + str : '';
}

export function urlToFilters() {
  const params = new URLSearchParams(window.location.search);
  return {
    status:        params.get('status')    || null,
    division:      params.get('division')  || null,
    priority:      params.get('priority')  || null,
    search:        params.get('search')    || '',
    activityType:  params.get('atype')     || null,
    planned_date:  params.get('planned')   || null,
  };
}

export function pushURL(filters) {
  const url = filtersToURL(filters);
  const newURL = url ? `${window.location.pathname}${url}` : window.location.pathname;
  window.history.pushState({}, '', newURL);
}

// ── Store ───────────────────────────────────────────────────────────────────

export const useStore = create((set, get) => ({
  // ── Initial state ────────────────────────────────────────────────────────
  currentUser: { id: 'default', name: 'Zun', initials: 'ZU', division: 'lab' },

  filters: urlToFilters(),   // initialised from URL on load

  tasks:    [],
  activity: [],
  stats:    null,

  selectedTaskIds: [],
  isLoading:     false,
  isLoadingActivity: false,
  error:         null,

  page:  1,
  limit: 25,
  sort:  DEFAULT_SORT,

  activityPage:  1,
  activityLimit: 20,

  // Search AbortController
  searchController: null,

  // ── Auth bootstrap ──────────────────────────────────────────────────────
  bootstrap: async () => {
    try {
      const user = await api.getMe();
      set({ currentUser: user });
    } catch {
      set({ currentUser: { id: 'guest', name: 'Guest', initials: 'GU', division: null } });
    }
  },

  // ── Filter actions ──────────────────────────────────────────────────────
  setFilter: (patch, { push = true } = {}) => {
    set(state => ({
      filters: { ...state.filters, ...patch },
      page: 1,
    }));
    if (push) pushURL(get().filters);
    const { filters } = get();
    get().fetchTasks(filters);
    get().fetchActivity(filters);
  },

  setActivityTypeFilter: (type) => {
    set(state => ({ filters: { ...state.filters, activityType: type }, activityPage: 1 }));
    pushURL(get().filters);
    get().fetchActivity(get().filters);
  },

  // ── Search with AbortController ─────────────────────────────────────────
  setSearch: (search) => {
    // Cancel any in-flight search request
    const ctrl = get().searchController;
    if (ctrl) ctrl.abort();

    const newCtrl = new AbortController();
    set(state => ({
      filters: { ...state.filters, search },
      searchController: newCtrl,
      page: 1,
    }));
    pushURL(get().filters);

    // Debounce 300ms then fetch
    clearTimeout(get()._searchDebounce);
    const t = setTimeout(() => {
      get().fetchTasks(get().filters, newCtrl.signal);
      get().fetchActivity(get().filters);
    }, 300);
    set(state => ({ ...state, _searchDebounce: t }));
  },

  // ── Pagination + Sort ───────────────────────────────────────────────────
  setPage: (page) => {
    set({ page });
    get().fetchTasks(get().filters);
  },

  setSort: (field, order) => {
    set({ sort: { field, order }, page: 1 });
    pushURL(get().filters);
    get().fetchTasks(get().filters);
  },

  selectTask: (id) => set({ selectedTaskId: id }),

  toggleTask: (id) => set(state => {
    const ids = state.selectedTaskIds;
    return {
      selectedTaskIds: ids.includes(id) ? ids.filter(x => x !== id) : [...ids, id],
    };
  }),

  selectAllTasks: (ids) => set({ selectedTaskIds: ids }),

  clearSelection: () => set({ selectedTaskIds: [] }),

  // ── Fetch actions ────────────────────────────────────────────────────────

  fetchAll: async () => {
    set({ isLoading: true, error: null });
    const { filters } = get();
    try {
      const [tasks, stats, activityData] = await Promise.all([
        api.listOps(),
        api.getStats(),
        api.getActivity({ limit: get().activityLimit }),
      ]);
      set({ tasks, stats, activity: activityData.activity || [], isLoading: false });
    } catch (err) {
      set({ error: err.message, isLoading: false });
    }
  },

  fetchTasks: async (filters, signal) => {
    try {
      const tasks = await api.listOps({ signal });
      set({ tasks });
    } catch (err) {
      if (err.name === 'AbortError') return;
      set({ error: err.message });
    }
  },

  fetchActivity: async (filters) => {
    set({ isLoadingActivity: true });
    try {
      const params = {};
      if (filters?.division)      params.division = filters.division;
      if (filters?.status)        params.status   = filters.status;
      if (filters?.activityType)  params.type     = filters.activityType;
      params.limit = get().activityLimit;
      params.page  = get().activityPage;

      const data = await api.getActivity(params);
      set({ activity: data.activity || [], isLoadingActivity: false });
    } catch (err) {
      if (err.name === 'AbortError') return;
      set({ error: err.message, isLoadingActivity: false });
    }
  },

  // ── Task mutations (optimistic) ──────────────────────────────────────────

  createTask: async (fields) => {
    const { currentUser } = get();
    let created;
    try {
      created = await api.createOp(fields);
    } catch (err) {
      set({ error: err.message });
      throw err;
    }

    const syntheticEntry = makeSyntheticEntry(
      'CREATED',
      currentUser.id,
      currentUser.name,
      String(created.id),
      created.op_id,
      `${currentUser.name} created this task`
    );

    set(state => ({
      tasks:    [created, ...state.tasks],
      activity: [syntheticEntry, ...state.activity],
    }));
  },

  updateTask: async (opId, fields) => {
    const { currentUser, tasks } = get();
    const existing = tasks.find(t => t.op_id === opId);
    if (!existing) return;

    const optimistic = { ...existing, ...fields };
    const display = fields.status
      ? `${currentUser.name} changed status to ${formatStatus(fields.status)}`
      : fields.priority
        ? `${currentUser.name} changed priority to ${fields.priority}`
        : `${currentUser.name} updated task`;

    const syntheticEntry = makeSyntheticEntry(
      'STATUS_CHANGE',
      currentUser.id,
      currentUser.name,
      String(existing.id),
      opId,
      display
    );

    set(state => ({
      tasks:    state.tasks.map(t => t.op_id === opId ? optimistic : t),
      activity: [syntheticEntry, ...state.activity],
    }));

    try {
      const confirmed = await api.updateOp(opId, fields);
      set(state => ({
        tasks: state.tasks.map(t => t.op_id === opId ? confirmed : t),
      }));
    } catch (err) {
      set(state => ({
        tasks:    state.tasks.map(t => t.op_id === opId ? existing : t),
        activity: state.activity.filter(a => !a.id.startsWith('synthetic-')),
        error:    err.message,
      }));
      throw err;
    }
  },

  deleteTask: async (opId) => {
    const { tasks } = get();
    const existing = tasks.find(t => t.op_id === opId);
    set(state => ({ tasks: state.tasks.filter(t => t.op_id !== opId) }));
    try {
      await api.deleteOp(opId);
    } catch (err) {
      set(state => ({ tasks, error: err.message }));
      throw err;
    }
  },

  // ── Attachments ─────────────────────────────────────────────────────────
  uploadAttachment: async (opId, file) => {
    const att = await api.uploadAttachment(opId, file);
    const updated = await api.getOp(opId);
    set(state => ({
      tasks: state.tasks.map(t => t.op_id === opId ? updated : t),
    }));
    return att;
  },

  deleteAttachment: async (opId, attId) => {
    await api.deleteAttachment(opId, attId);
    const updated = await api.getOp(opId);
    set(state => ({
      tasks: state.tasks.map(t => t.op_id === opId ? updated : t),
    }));
  },

  // ── UI helpers ───────────────────────────────────────────────────────────
  clearError: () => set({ error: null }),

  // ── Derived selectors ─────────────────────────────────────────────────────
  getFilteredTasks: () => {
    const { tasks, filters } = get();
    let result = [...tasks];

    if (filters.status)        result = result.filter(t => t.status === filters.status);
    if (filters.division)      result = result.filter(t => t.division === filters.division);
    if (filters.priority)      result = result.filter(t => t.priority === filters.priority);
    if (filters.planned_date)  result = result.filter(t => t.planned_date?.slice(0, 10) === filters.planned_date);
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(t =>
        t.title?.toLowerCase().includes(q) ||
        t.op_id?.toLowerCase().includes(q) ||
        (t.description || '').toLowerCase().includes(q)
      );
    }

    const { sort } = get();
    result.sort((a, b) => {
      let va = a[sort.field] ?? '';
      let vb = b[sort.field] ?? '';
      if (sort.field === 'planned_date') {
        va = va ? new Date(va) : new Date('9999');
        vb = vb ? new Date(vb) : new Date('9999');
        return sort.order === 'asc' ? va - vb : vb - va;
      }
      va = String(va).toLowerCase();
      vb = String(vb).toLowerCase();
      if (va < vb) return sort.order === 'asc' ? -1 : 1;
      if (va > vb) return sort.order === 'asc' ? 1 : -1;
      return 0;
    });

    return result;
  },

  getStats: () => {
    const filtered = get().getFilteredTasks();
    const today = new Date(); today.setHours(0, 0, 0, 0);
    return {
      total:      filtered.length,
      inProgress: filtered.filter(t => t.status === 'in_progress').length,
      completed:  filtered.filter(t => t.status === 'completed').length,
      overdue:   filtered.filter(t =>
        t.status !== 'completed' && t.status !== 'cancelled' &&
        t.planned_date && new Date(t.planned_date) < today
      ).length,
    };
  },
}));

export default useStore;
