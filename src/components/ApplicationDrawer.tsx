import React, { useEffect, useState } from 'react';
import {
  X,
  ExternalLink,
  CalendarClock,
  CheckCircle2,
  Trash2,
  Mail,
  FileText,
} from 'lucide-react';
import type { ApplicationRecord, ApplicationStatus } from '../types';
import {
  METHOD_LABELS_BN,
  STATUS_LABELS_BN,
  formatDateBn,
  formatSalaryBn,
} from '../lib/bn';

interface ApplicationDrawerProps {
  application: ApplicationRecord | null;
  onClose: () => void;
  onUpdateApplication: (
    id: string,
    patch: Partial<ApplicationRecord>,
    triggerEmailOnStatusChange?: boolean
  ) => Promise<void>;
  onLogFollowUp: (id: string, note: string, nextFollowUpDays: number) => Promise<void>;
  onSendFollowUpEmail: (app: ApplicationRecord, subject: string, body: string) => void;
  onDelete: (id: string) => Promise<void>;
}

const ALL_STATUSES: ApplicationStatus[] = [
  'Applied',
  'Screening',
  'Interview',
  'Offer',
  'Rejected',
  'Withdrawn',
];

export const ApplicationDrawer: React.FC<ApplicationDrawerProps> = ({
  application,
  onClose,
  onUpdateApplication,
  onLogFollowUp,
  onSendFollowUpEmail,
  onDelete,
}) => {
  const [status, setStatus] = useState<ApplicationStatus>('Applied');
  const [recruiterName, setRecruiterName] = useState('');
  const [recruiterEmail, setRecruiterEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [followUpNote, setFollowUpNote] = useState('');
  const [nextDays, setNextDays] = useState(4);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (application) {
      setStatus(application.status);
      setRecruiterName(application.recruiterName || '');
      setRecruiterEmail(application.recruiterEmail || '');
      setNotes(application.notes || '');
      setNextFollowUpDate(
        application.nextFollowUpAt ? application.nextFollowUpAt.slice(0, 10) : ''
      );
      setFollowUpNote('');
    }
  }, [application]);

  if (!application) return null;

  const handleSaveDetails = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      const nextFollowUpIso = nextFollowUpDate
        ? new Date(`${nextFollowUpDate}T14:00:00Z`).toISOString()
        : null;
      await onUpdateApplication(
        application.id,
        {
          status,
          recruiterName: recruiterName.trim(),
          recruiterEmail: recruiterEmail.trim(),
          notes: notes.trim(),
          nextFollowUpAt: nextFollowUpIso,
          followUpCompleted: nextFollowUpIso === null,
        },
        status !== application.status
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickFollowUp = async () => {
    setIsSaving(true);
    try {
      await onLogFollowUp(
        application.id,
        followUpNote.trim() || `${application.jobTitle} পদের জন্য ফলো-আপ সম্পন্ন হয়েছে।`,
        nextDays
      );
      setFollowUpNote('');
    } finally {
      setIsSaving(false);
    }
  };

  const handleComposeRecruiterFollowUp = () => {
    const subject = `Follow-up: ${application.jobTitle} Application at ${application.company}`;
    const body =
      `Hello ${recruiterName || 'Hiring Team'},\n\n` +
      `I hope you are doing well. I am writing to follow up on my application for the "${application.jobTitle}" position at ${application.company}, submitted on ${application.appliedAt.slice(0, 10)}.\n\n` +
      `I would welcome the opportunity to discuss how my experience with ${application.matchedSkills.slice(0, 4).join(', ') || 'software and systems engineering'} can contribute to your team.\n\n` +
      `Best regards,\n`;
    onSendFollowUpEmail(application, subject, body);
  };

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-slate-900/35">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="relative z-50 flex h-full w-full max-w-xl flex-col border-l border-slate-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold text-slate-900 truncate">
              {application.jobTitle}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
              <span className="font-medium text-slate-700">{application.company}</span>
              <span aria-hidden="true">·</span>
              <span>{application.location}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {formatSalaryBn(
                  application.salaryMin,
                  application.salaryMax,
                  application.salaryCurrency || 'BDT'
                )}
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {application.skillMatchPct}% মিল
              </span>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <a
              href={application.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <span>চাকরির লিংক</span>
              <ExternalLink className="h-3 w-3" />
            </a>
            <button
              type="button"
              onClick={onClose}
              aria-label="বিস্তারিত প্যানেল বন্ধ করুন"
              className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          <form onSubmit={handleSaveDetails} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  আবেদনের ধাপ
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as ApplicationStatus)}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                >
                  {ALL_STATUSES.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABELS_BN[s]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">
                  পরবর্তী ফলো-আপের তারিখ
                </label>
                <input
                  type="date"
                  value={nextFollowUpDate}
                  onChange={(e) => setNextFollowUpDate(e.target.value)}
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 font-mono text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  রিক্রুটার / যোগাযোগকারীর নাম
                </label>
                <input
                  type="text"
                  value={recruiterName}
                  onChange={(e) => setRecruiterName(e.target.value)}
                  placeholder="যেমন: মায়া চেন"
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-600">
                  রিক্রুটারের ইমেইল
                </label>
                <input
                  type="email"
                  value={recruiterEmail}
                  onChange={(e) => setRecruiterEmail(e.target.value)}
                  placeholder="recruiter@company.com"
                  className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                আবেদন সংক্রান্ত নোট
              </label>
              <textarea
                rows={3}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="ইন্টারভিউয়ের অভিজ্ঞতা, বেতন আলোচনা বা পরবর্তী করণীয় লিখুন..."
                className="mt-1.5 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <button
                type="button"
                onClick={() => onDelete(application.id)}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 hover:text-red-700 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>আবেদন মুছে ফেলুন</span>
              </button>

              <button
                type="submit"
                disabled={isSaving}
                className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
              >
                {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'অবস্থা ও তথ্য সংরক্ষণ করুন'}
              </button>
            </div>
          </form>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-900">
                <CalendarClock className="h-4 w-4 text-slate-500" />
                <span>ফলো-আপ অ্যাকশন সেন্টার</span>
              </h3>

              {recruiterEmail && (
                <button
                  type="button"
                  onClick={handleComposeRecruiterFollowUp}
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                >
                  <Mail className="h-3.5 w-3.5" />
                  <span>Gmail-এ ফলো-আপ পাঠান</span>
                </button>
              )}
            </div>

            <div className="space-y-3 rounded-md border border-slate-200 bg-slate-50 p-3.5">
              <input
                type="text"
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="ফলো-আপের নোট লিখুন (যেমন: রিক্রুটারকে LinkedIn-এ বার্তা পাঠানো হয়েছে)..."
                className="w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 text-xs text-slate-600">
                  <span>পরবর্তী অনুস্মারক</span>
                  <select
                    value={nextDays}
                    onChange={(e) => setNextDays(Number(e.target.value))}
                    className="rounded border border-slate-200 bg-white px-2 py-1 text-xs text-slate-900"
                  >
                    <option value={2}>২ কর্মদিবস পর</option>
                    <option value={4}>৪ কর্মদিবস পর</option>
                    <option value={7}>৭ কর্মদিবস পর</option>
                    <option value={0}>আর ফলো-আপ প্রয়োজন নেই</option>
                  </select>
                </label>

                <button
                  type="button"
                  onClick={handleQuickFollowUp}
                  disabled={isSaving}
                  className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  <span>ফলো-আপ সংরক্ষণ করুন</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-2.5">
            <h3 className="flex items-center gap-2 font-display text-sm font-semibold text-slate-900">
              <FileText className="h-4 w-4 text-slate-500" />
              <span>সংযুক্ত রিজিউমি ও কভার নোট</span>
            </h3>
            <div className="text-xs text-slate-600">
              <span className="font-medium text-slate-800">{application.resumeFilename}</span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <span>{METHOD_LABELS_BN[application.submissionMethod]}</span>
              <span className="mx-1.5" aria-hidden="true">
                ·
              </span>
              <span>
                মিলে যাওয়া দক্ষতা:{' '}
                {application.matchedSkills.join(', ') || 'সাধারণ সামঞ্জস্য'}
              </span>
            </div>
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-600">
              {application.tailoredCoverNote}
            </p>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              কার্যক্রমের টাইমলাইন
            </h3>
            <div className="space-y-3">
              {application.timeline.map((evt) => (
                <div
                  key={evt.id}
                  className="flex items-start justify-between gap-4 border-b border-slate-100 pb-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <div className="text-xs font-medium text-slate-900">{evt.title}</div>
                    <div className="mt-0.5 text-xs text-slate-500">{evt.detail}</div>
                  </div>
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums shrink-0">
                    {formatDateBn(evt.timestamp)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </aside>
    </div>
  );
};
