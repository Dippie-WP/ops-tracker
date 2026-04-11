/**
 * api/client.js — Maps to existing + new Express endpoints.
 */

const BASE = '/api';

async function request(method, path, body, signal) {
  const opts = { method, headers: { 'Content-Type': 'application/json' } };
  if (body !== undefined) opts.body = JSON.stringify(body);
  if (signal) opts.signal = signal;
  const res = await fetch(BASE + path, opts);
  const json = await res.json();
  if (!json.ok) throw new Error((json.errors || [json.error]).join(', '));
  return json.data;
}

export const api = {
  // ── Ops ──────────────────────────────────────────────────────────────────
  listOps:   (opts) => request('GET',    '/ops', undefined, opts?.signal),
  getOp:     (opId) => request('GET',    `/ops/${opId}`),
  getOpByOpId: (opId) => request('GET', `/ops/${opId}`),
  getStats:  ()     => request('GET',    '/ops/stats'),
  createOp:  (fields) => request('POST',   '/ops', fields),
  updateOp:  (opId, fields) => request('PATCH', `/ops/${opId}`, fields),
  deleteOp:  (opId) => request('DELETE', `/ops/${opId}`),
  getNextOpId: () => request('GET',    '/ops/next-id'),

  // ── Attachments ──────────────────────────────────────────────────────────
  getAllAttachments: () => request('GET',    '/attachments'),
  uploadAttachment(opId, file) {
    const fd = new FormData();
    fd.append('file', file);
    return fetch(`${BASE}/ops/${opId}/attachments`, { method: 'POST', body: fd })
      .then(r => r.json())
      .then(j => { if (!j.ok) throw new Error(j.error); return j.data; });
  },
  deleteAttachment: (opId, attId) => request('DELETE', `/ops/${opId}/attachments/${attId}`),
  downloadUrl: (opId, attId) => `${BASE}/ops/${opId}/attachments/${attId}/download`,

  // ── Activity (new) ─────────────────────────────────────────────────────────
  getActivity: (params = {}) => {
    const qs = new URLSearchParams();
    if (params.type)      qs.set('type', params.type);
    if (params.taskId)    qs.set('taskId', params.taskId);
    if (params.division)  qs.set('division', params.division);
    if (params.page)      qs.set('page', params.page);
    if (params.limit)     qs.set('limit', params.limit);
    const query = qs.toString();
    return request('GET', `/activity${query ? '?' + query : ''}`);
  },

  // ── Auth ─────────────────────────────────────────────────────────────────
  getMe:    () => request('GET', '/auth/me'),
  listUsers: () => request('GET', '/users'),
};

export default api;
