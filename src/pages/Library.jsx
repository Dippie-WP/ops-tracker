/**
 * Library.jsx — All attachments across all ops.
 * Lists filename, OP ID (links to task), upload date, file size.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtBytes(n) {
  if (!n) return '—';
  if (n < 1024)        return `${n} B`;
  if (n < 1024*1024)   return `${(n/1024).toFixed(1)} KB`;
  return `${(n/1024/1024).toFixed(1)} MB`;
}

export default function Library() {
  const [attachments, setAttachments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);

  useEffect(() => {
    api.getAllAttachments()
      .then(data => {
        const rows = data.data || [];
        setAttachments(rows);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  return (
    <div className="library-page">
      <div className="page-title-row">
        <h2 className="page-title">Library</h2>
        <span className="page-subtitle">{attachments.length} file{attachments.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <div className="page-loading">Loading files...</div>}
      {error   && <div className="page-error">Error: {error}</div>}

      {!loading && !error && attachments.length === 0 && (
        <div className="empty-state">No attachments yet. Upload files from task detail pages.</div>
      )}

      {!loading && attachments.length > 0 && (
        <div className="library-table">
          <div className="table-header lib-header">
            <span>File Name</span>
            <span>OP ID</span>
            <span>Uploaded</span>
            <span>Size</span>
          </div>
          {attachments.map(a => (
            <div key={a.id} className="table-row lib-row">
              <span className="lib-filename" title={a.original_name}>
                📄 {a.filename}
              </span>
              <Link to={`/tasks/${a.op_id}`} className="lib-opid">
                {a.op_id}
              </Link>
              <span className="lib-date">{fmtDate(a.uploaded_at)}</span>
              <span className="lib-size">{fmtBytes(a.file_size)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
