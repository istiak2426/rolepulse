import React, { useMemo, useState } from 'react';
import {
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Sparkles,
  XCircle,
  CalendarClock,
  ChevronRight,
  Briefcase,
} from 'lucide-react';
import type { ApplicationRecord, ApplicationStatus, EvaluatedJob } from '../types';
import {
  METHOD_LABELS_BN,
  STATUS_LABELS_BN,
  formatDateBn,
  formatSalaryBn,
} from '../lib/bn';

interface OverviewPipelineViewProps {
  applications: ApplicationRecord[];
  jobs: EvaluatedJob[];
  isLoading: boolean;
  onSelectApplication: (app: ApplicationRecord) => void;
  onQuickStatusChange: (app: ApplicationRecord, newStatus: ApplicationStatus) => Promise<void>;
  onNavigateToJobs: () => void;
}

type FilterMode = 'All' | 'Follow-Up Due' | ApplicationStatus;

const STAGE_TABS: Array<{ id: FilterMode; label: string }> = [
  { id: 'All', label: 'সকল' },
  { id: 'Follow-Up Due', label: 'ফলো-আপ বাকি' },
  { id: 'Applied', label: STATUS_LABELS_BN.Applied },
  { id: 'Screening', label: STATUS_LABELS_BN.Screening },
  { id: 'Interview', label: STATUS_LABELS_BN.Interview },
  { id: 'Offer', label: STATUS_LABELS_BN.Offer },
  { id: 'Rejected', label: STATUS_LABELS_BN.Rejected },
];

function isFollowUpDue(app: ApplicationRecord): boolean {
  if (!app.nextFollowUpAt || app.followUpCompleted) return false;
  if (app.status === 'Rejected' || app.status === 'Withdrawn' || app.status === 'Offer') {
    return false;
  }
  return new Date(app.nextFollowUpAt).getTime() <= Date.now() + 24 * 3600 * 1000;
}

function renderStatusCell(status: ApplicationStatus) {
  const label = STATUS_LABELS_BN[status];
  switch (status) {
    case 'Applied':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-700 whitespace-nowrap">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'Screening':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-amber-700 whitespace-nowrap">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'Interview':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'Offer':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-800 whitespace-nowrap">
          <Sparkles className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
    case 'Rejected':
    case 'Withdrawn':
      return (
        <span className="inline-flex items-center gap-1.5 text-xs font-medium text-red-600 whitespace-nowrap">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          <span>{label}</span>
        </span>
      );
  }
}

export const OverviewPipelineView: React.FC<OverviewPipelineViewProps> = ({
  applications,
  jobs,
  isLoading,
  onSelectApplication,
  onQuickStatusChange,
  onNavigateToJobs,
}) => {
  const [filterMode, setFilterMode] = useState<FilterMode>('All');
  const [searchQuery, setSearchQuery] = useState('');

  const metrics = useMemo(() => {
    const activeInterviews = applications.filter(
      (a) => a.status === 'Interview' || a.status === 'Screening'
    ).length;
    const followUpsDue = applications.filter(isFollowUpDue).length;
    const qualifiedUnapplied = jobs.filter(
      (j) => j.evaluation.qualifiesForAutoApply && !j.alreadyApplied
    ).length;

    return {
      totalApplied: applications.length,
      activeInterviews,
      followUpsDue,
      qualifiedUnapplied,
    };
  }, [applications, jobs]);

  const filteredApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return applications.filter((app) => {
      if (filterMode === 'Follow-Up Due') {
        if (!isFollowUpDue(app)) return false;
      } else if (filterMode !== 'All' && app.status !== filterMode) {
        return false;
      }

      if (!q) return true;
      return (
        app.jobTitle.toLowerCase().includes(q) ||
        app.company.toLowerCase().includes(q) ||
        app.location.toLowerCase().includes(q) ||
        app.matchedSkills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [applications, filterMode, searchQuery]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-24 animate-pulse rounded-lg border border-slate-200 bg-white p-4"
            />
          ))}
        </div>
        <div className="h-72 animate-pulse rounded-lg border border-slate-200 bg-white" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 4-column KPI strip */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">মোট ট্র্যাককৃত আবেদন</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.totalApplied}
          </div>
          <div className="mt-1 text-xs text-slate-500">কেন্দ্রীয় আবেদন তালিকা</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">স্ক্রিনিং ও ইন্টারভিউ</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-slate-900 tabular-nums">
            {metrics.activeInterviews}
          </div>
          <div className="mt-1 text-xs text-slate-500">চলমান নিয়োগ প্রক্রিয়া</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">ফলো-আপ বাকি</div>
          <div
            className={`mt-1.5 font-mono text-2xl font-semibold tabular-nums ${
              metrics.followUpsDue > 0 ? 'text-amber-700' : 'text-slate-900'
            }`}
          >
            {metrics.followUpsDue}
          </div>
          <div className="mt-1 text-xs text-slate-500">২৪ ঘণ্টার মধ্যে করণীয়</div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-white px-5 py-4">
          <div className="text-xs font-medium text-slate-500">অটো-আবেদনের জন্য প্রস্তুত</div>
          <div className="mt-1.5 font-mono text-2xl font-semibold text-blue-700 tabular-nums">
            {metrics.qualifiedUnapplied}
          </div>
          <div className="mt-1 text-xs text-slate-500">দক্ষতা ও বেতনের সাথে মিলেছে</div>
        </div>
      </div>

      {/* Filter & Search Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {STAGE_TABS.map((stage) => {
            const active = filterMode === stage.id;
            const count =
              stage.id === 'All'
                ? applications.length
                : stage.id === 'Follow-Up Due'
                  ? metrics.followUpsDue
                  : applications.filter((a) => a.status === stage.id).length;

            return (
              <button
                key={stage.id}
                type="button"
                onClick={() => setFilterMode(stage.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <span>{stage.label}</span>
                <span className="ml-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="পদ, প্রতিষ্ঠান বা দক্ষতা দিয়ে খুঁজুন..."
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
        </div>
      </div>

      {/* Centralized Application Grid */}
      {filteredApps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-16 text-center">
          <Briefcase className="h-8 w-8 text-slate-300" />
          <h3 className="mt-3 font-display text-sm font-semibold text-slate-900">
            এই ধাপে কোনো আবেদন পাওয়া যায়নি
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            LinkedIn থেকে চাকরি সিঙ্ক করুন এবং আপনার আপলোড করা রিজিউমি দিয়ে অটো-আবেদন
            চালান।
          </p>
          <button
            type="button"
            onClick={onNavigateToJobs}
            className="mt-4 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors cursor-pointer"
          >
            যোগ্য চাকরিগুলো দেখুন
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">পদবি ও প্রতিষ্ঠান</th>
                  <th className="px-4 py-3 font-medium">বর্তমান ধাপ</th>
                  <th className="px-4 py-3 font-medium text-right">বেতন পরিসীমা</th>
                  <th className="px-4 py-3 font-medium text-right">দক্ষতা মিল</th>
                  <th className="px-4 py-3 font-medium">পরবর্তী ফলো-আপ</th>
                  <th className="px-4 py-3 font-medium text-right">পদক্ষেপ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredApps.map((app) => {
                  const due = isFollowUpDue(app);
                  return (
                    <tr
                      key={app.id}
                      onClick={() => onSelectApplication(app)}
                      className="cursor-pointer hover:bg-slate-50 transition-colors"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-medium text-slate-900">{app.jobTitle}</div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                          <span className="font-medium text-slate-700">{app.company}</span>
                          <span aria-hidden="true">·</span>
                          <span>{app.location}</span>
                          <span aria-hidden="true">·</span>
                          <span>{METHOD_LABELS_BN[app.submissionMethod]}</span>
                        </div>
                      </td>

                      <td
                        className="px-4 py-2.5"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="flex items-center gap-2">
                          {renderStatusCell(app.status)}
                          <select
                            aria-label={`${app.jobTitle}-এর অবস্থা পরিবর্তন করুন`}
                            value={app.status}
                            onChange={(e) =>
                              onQuickStatusChange(app, e.target.value as ApplicationStatus)
                            }
                            className="rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] text-slate-600 hover:border-slate-300 focus:border-blue-600 focus:outline-none"
                          >
                            <option value="Applied">{STATUS_LABELS_BN.Applied}</option>
                            <option value="Screening">{STATUS_LABELS_BN.Screening}</option>
                            <option value="Interview">{STATUS_LABELS_BN.Interview}</option>
                            <option value="Offer">{STATUS_LABELS_BN.Offer}</option>
                            <option value="Rejected">{STATUS_LABELS_BN.Rejected}</option>
                            <option value="Withdrawn">{STATUS_LABELS_BN.Withdrawn}</option>
                          </select>
                        </div>
                      </td>

                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {formatSalaryBn(
                          app.salaryMin,
                          app.salaryMax,
                          app.salaryCurrency || 'BDT'
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right font-mono text-slate-700 tabular-nums whitespace-nowrap">
                        {app.skillMatchPct}%
                      </td>

                      <td className="px-4 py-2.5 whitespace-nowrap">
                        {app.nextFollowUpAt ? (
                          <span
                            className={`inline-flex items-center gap-1.5 font-mono text-xs tabular-nums ${
                              due ? 'font-medium text-amber-700' : 'text-slate-600'
                            }`}
                          >
                            {due && <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
                            <span>
                              {formatDateBn(app.nextFollowUpAt)}
                              {due ? ' (বাকি)' : ''}
                            </span>
                          </span>
                        ) : (
                          <span className="text-slate-400">সম্পন্ন</span>
                        )}
                      </td>

                      <td className="px-4 py-2.5 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectApplication(app);
                          }}
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                        >
                          <span>ফলো-আপ</span>
                          <ChevronRight className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
