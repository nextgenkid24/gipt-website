import { useEffect, useState } from 'react';
import { Download, Trash2 } from 'lucide-react';
import { updateDocumentMeta, useSite } from '../../context/SiteContext';
import { apiFetch } from '../../lib/api';
import type { Inquiry, InquiryStatus, Subscriber } from '../../types';
import { formatDate } from '../../utils/cmsUtils';
import { AdminLayout } from './AdminLayout';

export function InquiriesSubscribersManager() {
  const { settings } = useSite();
  const [tab, setTab] = useState<'inquiries' | 'subscribers'>('inquiries');
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [subscribers, setSubscribers] = useState<Subscriber[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | InquiryStatus>('all');
  const [notesDraft, setNotesDraft] = useState<Record<number, string>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    updateDocumentMeta(`Inquiries & Subscribers — ${settings?.institute_short_name || 'GIPT'} CMS`);
  }, [settings?.institute_short_name]);

  async function loadAll() {
    setLoading(true);
    try {
      const [inqData, subData] = await Promise.all([
        apiFetch<Inquiry[]>('/api/admin/inquiries'),
        apiFetch<Subscriber[]>('/api/admin/subscribers'),
      ]);
      setInquiries(inqData);
      setSubscribers(subData);
      const map: Record<number, string> = {};
      inqData.forEach((i) => {
        map[i.id] = i.admin_notes;
      });
      setNotesDraft(map);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  async function handleUpdateInquiry(id: number, status: InquiryStatus) {
    setFeedback(null);
    try {
      const updated = await apiFetch<Inquiry>(`/api/admin/inquiries/${id}`, {
        method: 'PUT',
        body: JSON.stringify({ status, admin_notes: notesDraft[id] || '' }),
      });
      setInquiries((prev) => prev.map((i) => (i.id === id ? updated : i)));
      setFeedback({ type: 'success', text: `Inquiry from ${updated.name} updated.` });
    } catch (err) {
      setFeedback({
        type: 'error',
        text: err instanceof Error ? err.message : 'Unable to update inquiry.',
      });
    }
  }

  async function handleDeleteInquiry(inq: Inquiry) {
    try {
      await apiFetch(`/api/admin/inquiries/${inq.id}`, { method: 'DELETE' });
      setInquiries((prev) => prev.filter((i) => i.id !== inq.id));
    } catch {
      setFeedback({ type: 'error', text: 'Failed to delete inquiry.' });
    }
  }

  async function handleDeleteSubscriber(sub: Subscriber) {
    try {
      await apiFetch(`/api/admin/subscribers/${sub.id}`, { method: 'DELETE' });
      setSubscribers((prev) => prev.filter((s) => s.id !== sub.id));
    } catch {
      setFeedback({ type: 'error', text: 'Failed to remove subscriber.' });
    }
  }

  function handleExportCsv() {
    const rows = [
      ['ID', 'Email', 'Subscribed Date'],
      ...subscribers.map((s) => [String(s.id), s.email, s.created_at]),
    ];
    const csv = rows.map((r) => r.map((v) => `"${v.replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gipt-newsletter-subscribers.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  const filteredInquiries = inquiries.filter((i) =>
    statusFilter === 'all' ? true : i.status === statusFilter
  );

  return (
    <AdminLayout title="Inquiries & Subscribers Inbox">
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-4">
          <div role="tablist" className="flex items-center gap-2">
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'inquiries'}
              onClick={() => setTab('inquiries')}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                tab === 'inquiries'
                  ? 'bg-[#181F29] text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              Admissions Inquiries ({inquiries.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'subscribers'}
              onClick={() => setTab('subscribers')}
              className={`px-4 py-2 text-xs font-semibold rounded transition-colors ${
                tab === 'subscribers'
                  ? 'bg-[#181F29] text-white'
                  : 'bg-white border border-slate-200 text-slate-700'
              }`}
            >
              Newsletter Subscribers ({subscribers.length})
            </button>
          </div>

          {tab === 'inquiries' ? (
            <select
              aria-label="Filter inquiries by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as 'all' | InquiryStatus)}
              className="px-3 py-2 text-xs bg-white border border-slate-300 rounded"
            >
              <option value="all">All Statuses</option>
              <option value="new">New</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
            </select>
          ) : (
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#008398] hover:bg-[#006B7D] rounded"
            >
              <Download className="w-3.5 h-3.5" />
              Export CSV
            </button>
          )}
        </div>

        {feedback && (
          <div
            role="status"
            className={`p-3 text-sm rounded border ${
              feedback.type === 'success'
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-red-50 border-red-200 text-red-800'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded">
            Loading inbox...
          </div>
        ) : tab === 'inquiries' ? (
          filteredInquiries.length === 0 ? (
            <div className="p-10 text-center text-sm text-slate-500 bg-white border border-slate-200 rounded">
              No inquiries match the current status filter.
            </div>
          ) : (
            <div className="space-y-4">
              {filteredInquiries.map((inq) => (
                <div
                  key={inq.id}
                  className="bg-white border border-slate-200 rounded p-5 sm:p-6 space-y-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="font-sans text-base font-semibold text-[#181F29]">
                        {inq.name}
                      </h2>
                      <p className="text-xs text-slate-600 mt-0.5">
                        {inq.email}
                        {inq.phone ? ` · ${inq.phone}` : ''} ·{' '}
                        <span className="font-semibold text-[#008398]">{inq.category}</span> ·{' '}
                        {formatDate(inq.created_at)}
                      </p>
                      {inq.program_of_interest && (
                        <p className="text-xs font-medium text-[#D95316] mt-1">
                          Program: {inq.program_of_interest}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <select
                        aria-label={`Status for ${inq.name}`}
                        value={inq.status}
                        onChange={(e) =>
                          handleUpdateInquiry(inq.id, e.target.value as InquiryStatus)
                        }
                        className="px-3 py-1.5 text-xs font-semibold bg-[#F8FAFC] border border-slate-300 rounded"
                      >
                        <option value="new">New</option>
                        <option value="in_progress">In Progress</option>
                        <option value="resolved">Resolved</option>
                      </select>
                      <button
                        type="button"
                        onClick={() => handleDeleteInquiry(inq)}
                        aria-label={`Delete inquiry from ${inq.name}`}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-sm text-slate-700 bg-[#F8FAFC] border border-slate-100 rounded p-4 leading-relaxed">
                    {inq.message}
                  </p>

                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-1">
                    <input
                      type="text"
                      aria-label={`Admin notes for ${inq.name}`}
                      value={notesDraft[inq.id] ?? ''}
                      onChange={(e) =>
                        setNotesDraft((prev) => ({ ...prev, [inq.id]: e.target.value }))
                      }
                      placeholder="Internal admissions follow-up note..."
                      className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded"
                    />
                    <button
                      type="button"
                      onClick={() => handleUpdateInquiry(inq.id, inq.status)}
                      className="px-4 py-2 text-xs font-semibold text-white bg-[#181F29] hover:bg-[#242E3D] rounded whitespace-nowrap"
                    >
                      Save Note
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          <div className="bg-white border border-slate-200 rounded overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-[#F8FAFC] text-xs font-semibold uppercase tracking-wider text-slate-500">
                  <th className="px-4 py-3">Subscriber Email</th>
                  <th className="px-4 py-3">Subscribed Date</th>
                  <th className="px-4 py-3 text-right">Remove</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {subscribers.map((sub) => (
                  <tr key={sub.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-medium text-[#181F29]">{sub.email}</td>
                    <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                      {formatDate(sub.created_at)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSubscriber(sub)}
                        aria-label={`Remove subscriber ${sub.email}`}
                        className="p-1.5 text-slate-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AdminLayout>
  );
}
