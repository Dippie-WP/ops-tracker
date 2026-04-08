/* api.js — single module for all HTTP calls. No state lives here. */
'use strict';

const API = (() => {
  async function request(method, path, body) {
    const opts = {
      method,
      headers: { 'Content-Type': 'application/json' },
    };
    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(path, opts);
    const json = await res.json();
    if (!json.ok) throw new Error((json.errors || [json.error]).join(', '));
    return json.data;
  }

  return {
    // Ops
    listOps:   ()            => request('GET',    '/api/ops'),
    getOp:     (id)          => request('GET',    `/api/ops/${id}`),
    getStats:  ()            => request('GET',    '/api/ops/stats'),
    createOp:  (fields)      => request('POST',   '/api/ops', fields),
    updateOp:  (id, fields)  => request('PATCH',  `/api/ops/${id}`, fields),
    deleteOp:  (id)          => request('DELETE', `/api/ops/${id}`),

    // Attachments
    uploadAttachment(opId, file) {
      const fd = new FormData();
      fd.append('file', file);
      return fetch(`/api/ops/${opId}/attachments`, { method: 'POST', body: fd })
        .then(r => r.json())
        .then(j => { if (!j.ok) throw new Error(j.error); return j.data; });
    },

    deleteAttachment: (opId, id) =>
      request('DELETE', `/api/ops/${opId}/attachments/${id}`),

    downloadUrl: (opId, id) =>
      `/api/ops/${opId}/attachments/${id}/download`,
  };
})();
