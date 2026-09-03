import { useEffect, useMemo, useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { FiCheckCircle, FiInbox, FiMail, FiPhone, FiSearch, FiTrash2, FiX } from 'react-icons/fi';
import type { IconType } from 'react-icons';

import { Button, EmptyState } from '../../components/ui/PageHeader';
import { deleteEnquiry, listEnquiries, notifyEnquiriesChanged, updateEnquiryStatus } from '../../lib/enquiryService';
import type { Enquiry, EnquiryStatus } from '../../types/enquiry';

type StatusFilter = EnquiryStatus | 'all';

type StatCardProps = {
  icon: IconType;
  label: string;
  value: number;
  tone: string;
};

const statusOptions: Array<{ value: StatusFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'new', label: 'New' },
  { value: 'read', label: 'Read' },
  { value: 'resolved', label: 'Resolved' },
];

const statusLabels: Record<EnquiryStatus, string> = {
  new: 'New',
  read: 'Read',
  resolved: 'Resolved',
};

const statusClasses: Record<EnquiryStatus, string> = {
  new: 'bg-white text-brand-charcoal ring-white/70',
  read: 'bg-blue-50 text-blue-700 ring-blue-100',
  resolved: 'bg-green-50 text-brand-success ring-green-100',
};

function StatCard({ icon: Icon, label, value, tone }: StatCardProps) {
  return (
    <article className="flex items-center gap-3 border-b border-brand-border p-4 last:border-b-0 sm:odd:border-r lg:border-b-0 lg:border-r lg:last:border-r-0">
      <div className={`grid size-10 shrink-0 place-items-center rounded-lg ${tone}`}><Icon className="size-5" /></div>
      <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-wide text-brand-softText">{label}</p><p className="mt-0.5 text-2xl font-extrabold text-brand-charcoal">{value}</p></div>
    </article>
  );
}

function StatusBadge({ status }: { status: EnquiryStatus }) {
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-extrabold ring-1 ${statusClasses[status]}`}>{statusLabels[status]}</span>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value));
}

function getWhatsAppHref(phone: string | null) {
  const digits = phone?.replace(/\D/g, '') ?? '';
  return digits.length >= 8 ? `https://wa.me/${digits}` : '';
}

function searchableText(enquiry: Enquiry) {
  return [enquiry.full_name, enquiry.email, enquiry.subject, enquiry.company].join(' ').toLowerCase();
}

export function EnquiriesPage() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([]);
  const [selectedEnquiry, setSelectedEnquiry] = useState<Enquiry | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingStatus, setSavingStatus] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Enquiry | null>(null);

  async function refresh() {
    setError('');
    const data = await listEnquiries();
    setEnquiries(data);
    setSelectedEnquiry((current) => current ? data.find((item) => item.id === current.id) ?? current : null);
  }

  useEffect(() => {
    let mounted = true;

    async function load() {
      try {
        const data = await listEnquiries();
        if (mounted) setEnquiries(data);
      } catch {
        if (mounted) setError('Could not load enquiries from Supabase.');
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void load();
    return () => { mounted = false; };
  }, []);

  const stats = useMemo(() => ({
    total: enquiries.length,
    new: enquiries.filter((enquiry) => enquiry.status === 'new').length,
    resolved: enquiries.filter((enquiry) => enquiry.status === 'resolved').length,
  }), [enquiries]);

  const filteredEnquiries = useMemo(() => enquiries
    .filter((enquiry) => filter === 'all' ? true : enquiry.status === filter)
    .filter((enquiry) => searchableText(enquiry).includes(search.trim().toLowerCase())), [enquiries, filter, search]);

  async function openEnquiry(enquiry: Enquiry) {
    setSelectedEnquiry(enquiry);
    setNotice('');

    if (enquiry.status !== 'new') return;

    try {
      const updated = await updateEnquiryStatus(enquiry.id, 'read');
      setEnquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      notifyEnquiriesChanged();
      setSelectedEnquiry(updated);
    } catch {
      setError('Could not mark enquiry as read.');
    }
  }

  async function changeStatus(status: EnquiryStatus) {
    if (!selectedEnquiry || savingStatus) return;

    setSavingStatus(true);
    setError('');
    setNotice('');

    try {
      const updated = await updateEnquiryStatus(selectedEnquiry.id, status);
      setEnquiries((current) => current.map((item) => item.id === updated.id ? updated : item));
      notifyEnquiriesChanged();
      setSelectedEnquiry(updated);
      setNotice('Enquiry status updated.');
    } catch {
      setError('Could not update enquiry status.');
    } finally {
      setSavingStatus(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    try {
      await deleteEnquiry(deleteTarget.id);
      setEnquiries((current) => current.filter((item) => item.id !== deleteTarget.id));
      notifyEnquiriesChanged();
      if (selectedEnquiry?.id === deleteTarget.id) setSelectedEnquiry(null);
      setDeleteTarget(null);
      setNotice('Enquiry deleted.');
    } catch {
      setError('Could not delete enquiry.');
    }
  }

  return (
    <div className="space-y-6">
      <header className="border-b border-brand-border pb-5">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-brand-orange">Contact Inbox</p>
        <h1 className="mt-1 text-[1.75rem] font-semibold leading-tight tracking-normal text-brand-charcoal md:text-[2rem]">Enquiries</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-brand-softText">View and manage enquiries submitted through the Laybrotech website.</p>
      </header>

      {error ? <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {notice ? <p className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm font-semibold text-green-700">{notice}</p> : null}

      <section className="grid overflow-hidden rounded-lg border border-brand-border bg-white sm:grid-cols-2 lg:grid-cols-3" aria-label="Enquiry statistics">
        <StatCard icon={FiInbox} label="Total Enquiries" value={stats.total} tone="bg-[#fff4ec] text-brand-orange" />
        <StatCard icon={FiMail} label="New" value={stats.new} tone="bg-orange-50 text-brand-orange" />
        <StatCard icon={FiCheckCircle} label="Resolved" value={stats.resolved} tone="bg-green-50 text-brand-success" />
      </section>

      <section className="rounded-lg border border-brand-border bg-white">
        <div className="flex flex-col gap-3 border-b border-brand-border p-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1 lg:max-w-xl">
            <FiSearch className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-brand-softText" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search enquiries..." className="h-10 w-full rounded-lg border border-brand-border bg-white pl-11 pr-4 text-sm outline-none focus:border-brand-orange" />
          </div>
          <select value={filter} onChange={(event) => setFilter(event.target.value as StatusFilter)} className="h-10 rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange">
            {statusOptions.map((option) => <option value={option.value} key={option.value}>{option.label}</option>)}
          </select>
        </div>

        {loading ? <div className="p-8 text-sm font-bold text-brand-softText">Loading enquiries...</div> : null}
        {!loading && filteredEnquiries.length === 0 ? <div className="p-5"><EmptyState title="No enquiries yet." description="New contact form submissions will appear here." /></div> : null}

        {!loading && filteredEnquiries.length > 0 ? (
          <div>
            <div className="hidden grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_minmax(130px,0.75fr)_minmax(130px,0.75fr)_100px_145px_72px] gap-4 border-b border-brand-border px-5 py-3 text-xs font-extrabold uppercase tracking-wide text-brand-softText xl:grid">
              <span>Name</span><span>Subject</span><span>Contact</span><span>Company</span><span>Status</span><span>Date</span><span>Action</span>
            </div>
            <div className="divide-y divide-brand-border">
              {filteredEnquiries.map((enquiry) => {
                const isNew = enquiry.status === 'new';
                const primaryText = isNew ? 'text-white' : 'text-brand-charcoal';
                const secondaryText = isNew ? 'text-white' : 'text-brand-softText';

                return (
                  <article key={enquiry.id} className={`grid cursor-pointer gap-3 p-4 transition xl:grid-cols-[minmax(180px,1fr)_minmax(220px,1.4fr)_minmax(130px,0.75fr)_minmax(130px,0.75fr)_100px_145px_72px] xl:items-center xl:px-5 ${isNew ? 'bg-brand-orange hover:bg-brand-orangeDark' : 'hover:bg-brand-muted/60'}`} role="button" tabIndex={0} onClick={() => void openEnquiry(enquiry)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') void openEnquiry(enquiry); }}>
                    <div className="min-w-0"><p className={`font-extrabold ${primaryText}`}>{enquiry.full_name}</p><p className={`mt-1 break-all text-xs font-medium ${secondaryText}`}>{enquiry.email}</p></div>
                    <div className="min-w-0"><p className={`font-bold ${primaryText}`}>{enquiry.subject}</p><p className={`mt-1 line-clamp-2 text-sm ${secondaryText} xl:hidden`}>{enquiry.message}</p></div>
                    <div className={`text-sm font-semibold ${secondaryText}`}><span className="xl:hidden">Phone: </span>{enquiry.phone || '-'}</div>
                    <div className={`text-sm font-semibold ${secondaryText}`}><span className="xl:hidden">Company: </span>{enquiry.company || '-'}</div>
                    <div><StatusBadge status={enquiry.status} /></div>
                    <div className={`text-sm font-semibold ${secondaryText}`}>{formatDate(enquiry.created_at)}</div>
                    <div><button type="button" onClick={(event) => { event.stopPropagation(); void openEnquiry(enquiry); }} className={`h-9 rounded-lg border px-3 text-sm font-bold ${isNew ? 'border-white/80 text-white hover:bg-white/10' : 'border-brand-border text-brand-charcoal hover:bg-brand-muted'}`}>View</button></div>
                  </article>
                );
              })}
            </div>
          </div>
        ) : null}
      </section>

      {selectedEnquiry ? <EnquiryDrawer enquiry={selectedEnquiry} savingStatus={savingStatus} onClose={() => setSelectedEnquiry(null)} onStatusChange={(status) => void changeStatus(status)} onDelete={() => setDeleteTarget(selectedEnquiry)} /> : null}

      {deleteTarget ? <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4"><div className="w-full max-w-md rounded-xl border border-brand-border bg-white p-5 shadow-xl"><h2 className="text-lg font-extrabold text-brand-charcoal">Delete this enquiry?</h2><p className="mt-2 text-sm leading-6 text-brand-softText">This will permanently remove the enquiry from Supabase. This cannot be undone.</p><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDeleteTarget(null)} className="rounded-lg border border-brand-border px-4 py-2 text-sm font-bold">Cancel</button><button type="button" onClick={() => void confirmDelete()} className="rounded-lg bg-red-600 px-4 py-2 text-sm font-bold text-white hover:bg-red-700">Delete</button></div></div></div> : null}
    </div>
  );
}

function EnquiryDrawer({ enquiry, savingStatus, onClose, onStatusChange, onDelete }: { enquiry: Enquiry; savingStatus: boolean; onClose: () => void; onStatusChange: (status: EnquiryStatus) => void; onDelete: () => void }) {
  const whatsappHref = getWhatsAppHref(enquiry.phone);

  return (
    <div className="fixed inset-0 z-40 bg-black/35">
      <button type="button" className="absolute inset-0" aria-label="Close enquiry details" onClick={onClose} />
      <aside className="absolute bottom-0 right-0 top-0 flex w-full max-w-xl flex-col overflow-x-hidden overflow-y-auto bg-white shadow-xl sm:border-l sm:border-brand-border" aria-labelledby="enquiry-detail-heading">
        <div className="sticky top-0 z-10 flex items-start justify-between gap-4 border-b border-brand-border bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-brand-orange">Enquiry Details</p>
            <h2 id="enquiry-detail-heading" className="mt-1 text-xl font-extrabold text-brand-charcoal">{enquiry.subject}</h2>
          </div>
          <button type="button" onClick={onClose} className="grid size-9 shrink-0 place-items-center rounded-lg border border-brand-border text-brand-charcoal hover:bg-brand-muted" aria-label="Close"><FiX /></button>
        </div>

        <div className="min-w-0 space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            <a href={`mailto:${enquiry.email}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-orange px-3 text-sm font-bold !text-white hover:bg-brand-orangeDark [&_svg]:!text-white"><FiMail className="size-4" />Email</a>
            {enquiry.phone ? <a href={`tel:${enquiry.phone}`} className="inline-flex h-10 items-center gap-2 rounded-lg bg-brand-charcoal px-3 text-sm font-bold !text-white hover:bg-brand-charcoal/90 [&_svg]:!text-white"><FiPhone className="size-4" />Call</a> : null}
            {whatsappHref ? <a href={whatsappHref} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-green-600 px-3 text-sm font-bold !text-white hover:bg-green-700 [&_svg]:!text-white"><FaWhatsapp className="size-4" />WhatsApp</a> : null}
          </div>

          <div className="rounded-xl border border-brand-border bg-brand-muted/50 p-4">
            <label className="text-xs font-bold uppercase tracking-wide text-brand-softText" htmlFor="enquiry-status">Status</label>
            <select id="enquiry-status" value={enquiry.status} disabled={savingStatus} onChange={(event) => onStatusChange(event.target.value as EnquiryStatus)} className="mt-2 h-10 w-full rounded-lg border border-brand-border bg-white px-3 text-sm font-bold text-brand-charcoal outline-none focus:border-brand-orange">
              <option value="read">Read</option>
              <option value="resolved">Resolved</option>
            </select>
          </div>

          <dl className="grid gap-4 text-sm">
            <Detail label="Full Name" value={enquiry.full_name} />
            <Detail label="Email" value={enquiry.email} />
            <Detail label="Phone / WhatsApp" value={enquiry.phone || '-'} />
            <Detail label="Company / Organization" value={enquiry.company || '-'} />
            <Detail label="Subject" value={enquiry.subject} />
            <Detail label="Submitted Date" value={formatDate(enquiry.created_at)} />
          </dl>

          <section className="min-w-0 overflow-hidden rounded-xl border border-brand-border p-4">
            <h3 className="text-sm font-extrabold text-brand-charcoal">Message</h3>
            <p className="mt-3 whitespace-pre-line break-words text-sm leading-6 text-brand-softText [overflow-wrap:anywhere]">{enquiry.message}</p>
          </section>

          <button type="button" onClick={onDelete} className="inline-flex h-10 items-center gap-2 rounded-lg border border-red-200 px-3 text-sm font-bold text-red-600 hover:bg-red-50"><FiTrash2 className="size-4" />Delete Enquiry</button>
        </div>
      </aside>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs font-bold uppercase tracking-wide text-brand-softText">{label}</dt><dd className="mt-1 break-words font-semibold text-brand-charcoal [overflow-wrap:anywhere]">{value}</dd></div>;
}









