import React, { useMemo, useState } from 'react';
import {
  Search,
  ExternalLink,
  CheckCircle2,
  Filter,
  Plus,
  Send,
  X,
} from 'lucide-react';
import type { CandidateProfile, EvaluatedJob, JobSource, SyncMeta } from '../types';
import {
  SOURCE_LABELS_BN,
  STATUS_LABELS_BN,
  WORK_MODE_LABELS_BN,
  formatDateTimeBn,
  formatSalaryBn,
} from '../lib/bn';

const ALL_SYNC_SOURCES: JobSource[] = [
  'LinkedIn Feed',
  'Bdjobs Live',
  'Nextjobz BD',
  'RemoteOK Live',
  'Jobicy Live',
  'Remotive Live',
  'Himalayas Live',
  'Arbeitnow Live',
  'WeWorkRemotely Live',
];

interface JobFeedViewProps {
  jobs: EvaluatedJob[];
  profile: CandidateProfile;
  syncMeta: SyncMeta;
  isSyncing: boolean;
  isApplyingJobId: string | null;
  onSyncWithQuery: (
    query: string,
    location: string,
    sources?: JobSource[]
  ) => Promise<void>;
  onApplySingle: (jobId: string) => Promise<void>;
  onRunAutoApply: () => Promise<void>;
  onImportLinkedInJob: (payload: {
    applyUrl: string;
    title: string;
    company: string;
    location: string;
    workMode: 'Remote' | 'Hybrid' | 'On-site';
    salaryMin?: number;
    salaryMax?: number;
    skillsText: string;
    description: string;
  }) => Promise<void>;
  onToggleUndisclosedSalary: (include: boolean) => Promise<void>;
  onNavigateToProfile: () => void;
}

type JobFilterTab = 'qualified' | 'filtered_out' | 'applied' | 'all';

export const JobFeedView: React.FC<JobFeedViewProps> = ({
  jobs,
  profile,
  syncMeta,
  isSyncing,
  isApplyingJobId,
  onSyncWithQuery,
  onApplySingle,
  onRunAutoApply,
  onImportLinkedInJob,
  onToggleUndisclosedSalary,
  onNavigateToProfile,
}) => {
  const [tab, setTab] = useState<JobFilterTab>('qualified');
  const [sourceFilter, setSourceFilter] = useState<'ALL' | JobSource>('ALL');
  const [searchText, setSearchText] = useState('');
  const [queryInput, setQueryInput] = useState(profile.targetQuery);
  const [locationInput, setLocationInput] = useState(profile.targetLocation);
  const [selectedSources, setSelectedSources] = useState<JobSource[]>(
    profile.enabledSources?.length ? profile.enabledSources : ALL_SYNC_SOURCES
  );
  const [showImport, setShowImport] = useState(false);

  const [importUrl, setImportUrl] = useState('');
  const [importTitle, setImportTitle] = useState('');
  const [importCompany, setImportCompany] = useState('');
  const [importLocation, setImportLocation] = useState('Gulshan, Dhaka, Bangladesh');
  const [importWorkMode, setImportWorkMode] = useState<'Remote' | 'Hybrid' | 'On-site'>('Hybrid');
  const [importSalaryMin, setImportSalaryMin] = useState('45000');
  const [importSalaryMax, setImportSalaryMax] = useState('120000');
  const [importSkills, setImportSkills] = useState('TypeScript, React, Node.js, PostgreSQL');
  const [importDescription, setImportDescription] = useState('');
  const [isImporting, setIsImporting] = useState(false);

  const sourceCounts = useMemo(() => {
    const map: Partial<Record<JobSource, number>> = {};
    for (const j of jobs) {
      map[j.source] = (map[j.source] || 0) + 1;
    }
    return map;
  }, [jobs]);

  const jobsBySource = useMemo(() => {
    if (sourceFilter === 'ALL') return jobs;
    return jobs.filter((j) => j.source === sourceFilter);
  }, [jobs, sourceFilter]);

  const counts = useMemo(() => {
    const qualified = jobsBySource.filter(
      (j) => j.evaluation.qualifiesForAutoApply && !j.alreadyApplied
    ).length;
    const filteredOut = jobsBySource.filter(
      (j) => !j.evaluation.qualifiesForAutoApply && !j.alreadyApplied
    ).length;
    const applied = jobsBySource.filter((j) => j.alreadyApplied).length;
    return { qualified, filteredOut, applied, all: jobsBySource.length };
  }, [jobsBySource]);

  const filteredJobs = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return jobsBySource.filter((job) => {
      if (tab === 'qualified' && (!job.evaluation.qualifiesForAutoApply || job.alreadyApplied)) {
        return false;
      }
      if (tab === 'filtered_out' && (job.evaluation.qualifiesForAutoApply || job.alreadyApplied)) {
        return false;
      }
      if (tab === 'applied' && !job.alreadyApplied) {
        return false;
      }

      if (!q) return true;
      return (
        job.title.toLowerCase().includes(q) ||
        job.company.toLowerCase().includes(q) ||
        job.location.toLowerCase().includes(q) ||
        job.source.toLowerCase().includes(q) ||
        job.requiredSkills.some((s) => s.toLowerCase().includes(q))
      );
    });
  }, [jobsBySource, tab, searchText]);

  const toggleSyncSource = (source: JobSource) => {
    setSelectedSources((prev) => {
      if (prev.includes(source)) {
        return prev.length > 1 ? prev.filter((s) => s !== source) : prev;
      }
      return [...prev, source];
    });
  };

  const handleSearchSync = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSyncWithQuery(queryInput, locationInput, selectedSources);
  };

  const handleImportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importUrl.trim() || !importTitle.trim() || !importCompany.trim()) return;
    setIsImporting(true);
    try {
      await onImportLinkedInJob({
        applyUrl: importUrl.trim(),
        title: importTitle.trim(),
        company: importCompany.trim(),
        location: importLocation.trim(),
        workMode: importWorkMode,
        salaryMin: importSalaryMin ? Number(importSalaryMin) : undefined,
        salaryMax: importSalaryMax ? Number(importSalaryMax) : undefined,
        skillsText: importSkills,
        description: importDescription,
      });
      setImportUrl('');
      setImportTitle('');
      setImportCompany('');
      setImportDescription('');
      setShowImport(false);
    } finally {
      setIsImporting(false);
    }
  };

  const availableSourceTabs: JobSource[] = [
    ...ALL_SYNC_SOURCES,
    ...(sourceCounts['Imported URL'] ? (['Imported URL'] as JobSource[]) : []),
  ];

  return (
    <div className="space-y-6">
      {/* Search & Multi-Site Sync Bar */}
      <div className="rounded-lg border border-slate-200 bg-white p-4 space-y-3">
        <form
          onSubmit={handleSearchSync}
          className="flex flex-col gap-3 lg:flex-row lg:items-end"
        >
          <div className="flex-1">
            <label className="block text-xs font-medium text-slate-600">
              চাকরির পদবি / কীওয়ার্ড
            </label>
            <input
              type="text"
              value={queryInput}
              onChange={(e) => setQueryInput(e.target.value)}
              placeholder="যেমন: Frontend, Backend, Enterprise Application, System, DevOps"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="w-full lg:w-56">
            <label className="block text-xs font-medium text-slate-600">অবস্থান</label>
            <input
              type="text"
              value={locationInput}
              onChange={(e) => setLocationInput(e.target.value)}
              placeholder="Dhaka, Bangladesh"
              className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="submit"
              disabled={isSyncing}
              className="rounded-md bg-slate-900 px-4 py-2.5 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSyncing ? 'চাকরি আনা হচ্ছে...' : 'সব সাইট থেকে চাকরি আনুন'}
            </button>
            <button
              type="button"
              onClick={() => setShowImport((prev) => !prev)}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-2.5 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>যেকোনো সাইটের লিংক যোগ করুন</span>
            </button>
          </div>
        </form>

        {/* Sync Site Checkboxes */}
        <div className="border-t border-slate-100 pt-3">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="text-xs font-medium text-slate-600">সিঙ্ক করার জব সাইট:</span>
            {ALL_SYNC_SOURCES.map((source) => {
              const checked = selectedSources.includes(source);
              return (
                <label
                  key={source}
                  className="inline-flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer select-none"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSyncSource(source)}
                    className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                  />
                  <span>{SOURCE_LABELS_BN[source] || source}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3 text-xs text-slate-500">
          <div className="flex flex-wrap items-center gap-2">
            <span>
              সক্রিয় ফিল্টার: {profile.skills.length}টি দক্ষতার মধ্যে ন্যূনতম{' '}
              {profile.minSkillMatchPct}% মিল
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {formatSalaryBn(profile.minSalary, profile.maxSalary, profile.salaryCurrency)}
            </span>
            <span aria-hidden="true">·</span>
            <span>কাজের ধরন: {WORK_MODE_LABELS_BN[profile.preferredWorkMode]}</span>
            <span aria-hidden="true">·</span>
            <label className="inline-flex items-center gap-1.5 text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={profile.includeUndisclosedSalary}
                onChange={(e) => onToggleUndisclosedSalary(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              <span>বেতন অনির্দিষ্ট চাকরিও দেখুন</span>
            </label>
          </div>
          <button
            type="button"
            onClick={onNavigateToProfile}
            className="font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
          >
            শর্তাবলি ও রিজিউমি পরিবর্তন করুন
          </button>
        </div>
      </div>

      {/* Optional Import Any Job Site Posting Form */}
      {showImport && (
        <form
          onSubmit={handleImportSubmit}
          className="rounded-lg border border-slate-200 bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between">
            <h3 className="font-display text-sm font-semibold text-slate-900">
              LinkedIn, Bdjobs বা যেকোনো জব সাইটের বিজ্ঞপ্তি যোগ করুন
            </h3>
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                চাকরির লিংক (URL)
              </label>
              <input
                type="url"
                required
                value={importUrl}
                onChange={(e) => setImportUrl(e.target.value)}
                placeholder="https://jobs.bdjobs.com/... বা linkedin.com/jobs/..."
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">পদের নাম</label>
              <input
                type="text"
                required
                value={importTitle}
                onChange={(e) => setImportTitle(e.target.value)}
                placeholder="Senior Backend Engineer"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">প্রতিষ্ঠান</label>
              <input
                type="text"
                required
                value={importCompany}
                onChange={(e) => setImportCompany(e.target.value)}
                placeholder="Acme Systems"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">অবস্থান</label>
              <input
                type="text"
                value={importLocation}
                onChange={(e) => setImportLocation(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">কাজের ধরন</label>
              <select
                value={importWorkMode}
                onChange={(e) =>
                  setImportWorkMode(e.target.value as 'Remote' | 'Hybrid' | 'On-site')
                }
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="Remote">{WORK_MODE_LABELS_BN.Remote}</option>
                <option value="Hybrid">{WORK_MODE_LABELS_BN.Hybrid}</option>
                <option value="On-site">{WORK_MODE_LABELS_BN['On-site']}</option>
              </select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  সর্বনিম্ন বেতন
                </label>
                <input
                  type="number"
                  value={importSalaryMin}
                  onChange={(e) => setImportSalaryMin(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600">
                  সর্বোচ্চ বেতন
                </label>
                <input
                  type="number"
                  value={importSalaryMax}
                  onChange={(e) => setImportSalaryMax(e.target.value)}
                  className="mt-1 w-full rounded-md border border-slate-200 px-2.5 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                প্রয়োজনীয় প্রযুক্তিগত দক্ষতা (কমা দিয়ে আলাদা করুন)
              </label>
              <input
                type="text"
                value={importSkills}
                onChange={(e) => setImportSkills(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-600">
                সংক্ষিপ্ত বিবরণ (ঐচ্ছিক)
              </label>
              <input
                type="text"
                value={importDescription}
                onChange={(e) => setImportDescription(e.target.value)}
                placeholder="মূল দায়িত্ব বা টেক স্ট্যাক নোট..."
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowImport(false)}
              className="rounded-md border border-slate-200 px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              বাতিল
            </button>
            <button
              type="submit"
              disabled={isImporting}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 cursor-pointer"
            >
              {isImporting ? 'যোগ হচ্ছে...' : 'যোগ করে মূল্যায়ন করুন'}
            </button>
          </div>
        </form>
      )}

      {/* Source Breakdown Filter Strip */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          onClick={() => setSourceFilter('ALL')}
          className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
            sourceFilter === 'ALL'
              ? 'border-slate-900 bg-slate-900 text-white'
              : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
          }`}
        >
          <span>সকল সাইট</span>
          <span className="ml-1.5 font-mono text-[11px] opacity-75 tabular-nums">
            {jobs.length}
          </span>
        </button>

        {availableSourceTabs.map((source) => {
          const count = sourceCounts[source] || 0;
          if (count === 0) return null;
          const active = sourceFilter === source;
          return (
            <button
              key={source}
              type="button"
              onClick={() => setSourceFilter(source)}
              className={`rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                active
                  ? 'border-blue-700 bg-blue-50 text-blue-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              <span>{SOURCE_LABELS_BN[source] || source}</span>
              <span className="ml-1.5 font-mono text-[11px] opacity-75 tabular-nums">
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Filter Tabs + Inline Search */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
          {(
            [
              { id: 'qualified', label: 'যোগ্য চাকরি', count: counts.qualified },
              { id: 'filtered_out', label: 'বাদ পড়েছে', count: counts.filteredOut },
              { id: 'applied', label: 'আবেদনকৃত', count: counts.applied },
              { id: 'all', label: 'সকল চাকরি', count: counts.all },
            ] as const
          ).map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                tab === item.id
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>{item.label}</span>
              <span className="ml-1.5 font-mono text-[11px] text-slate-400 tabular-nums">
                {item.count}
              </span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2.5">
          {tab === 'qualified' && counts.qualified > 0 && (
            <button
              type="button"
              onClick={onRunAutoApply}
              className="inline-flex items-center gap-1.5 rounded-md bg-blue-700 px-3.5 py-2 text-xs font-medium text-white hover:bg-blue-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Send className="h-3.5 w-3.5" />
              <span>সব যোগ্য চাকরিতে অটো-আবেদন ({counts.qualified})</span>
            </button>
          )}
          <div className="relative w-full sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="সংগৃহীত চাকরিতে খুঁজুন..."
              className="w-full rounded-md border border-slate-200 bg-white py-2 pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Job Feed List */}
      {filteredJobs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-6 py-14 text-center">
          <Filter className="h-7 w-7 text-slate-300" />
          <h3 className="mt-3 font-display text-sm font-semibold text-slate-900">
            এই ফিল্টারে কোনো চাকরি পাওয়া যায়নি
          </h3>
          <p className="mt-1 max-w-md text-xs text-slate-500">
            উপরের "সব সাইট থেকে চাকরি আনুন" বাটনে ক্লিক করে LinkedIn, Bdjobs, RemoteOK ও
            অন্যান্য জব সাইট থেকে নতুন চাকরি সংগ্রহ করুন অথবা ফিল্টার পরিবর্তন করুন।
          </p>
        </div>
      ) : (
        <div className="divide-y divide-slate-200 overflow-hidden rounded-lg border border-slate-200 bg-white">
          {filteredJobs.map((job) => {
            const evalRes = job.evaluation;
            return (
              <div
                key={job.id}
                className="flex flex-col justify-between gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors lg:flex-row lg:items-center"
              >
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-display text-sm font-semibold text-slate-900">
                      {job.title}
                    </h3>
                    <span className="text-slate-300" aria-hidden="true">
                      ·
                    </span>
                    <span className="text-xs font-medium text-slate-700">{job.company}</span>
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`${job.title} লিংক খুলুন`}
                      className="inline-flex items-center gap-1 text-xs text-slate-400 hover:text-blue-700"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <span>{job.location}</span>
                    <span aria-hidden="true">·</span>
                    <span>{WORK_MODE_LABELS_BN[job.workMode]}</span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono font-medium text-slate-700 tabular-nums">
                      {formatSalaryBn(job.salaryMin, job.salaryMax, job.salaryCurrency)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-medium text-slate-700">
                      {SOURCE_LABELS_BN[job.source] || job.source}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      {evalRes.skillMatchPct}% দক্ষতা মিল
                    </span>
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    {evalRes.matchedSkills.length > 0 && (
                      <span className="text-emerald-700">
                        মিলেছে: {evalRes.matchedSkills.join(', ')}
                      </span>
                    )}
                    {evalRes.missingSkills.length > 0 && (
                      <span className="text-slate-400">
                        ঘাটতি: {evalRes.missingSkills.join(', ')}
                      </span>
                    )}
                  </div>

                  <div className="text-xs text-slate-500">
                    {evalRes.reasons.join(' · ')}
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  {job.alreadyApplied ? (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-emerald-700 whitespace-nowrap">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      <span>
                        আবেদনকৃত (
                        {job.applicationStatus
                          ? STATUS_LABELS_BN[job.applicationStatus]
                          : ''}
                        )
                      </span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      disabled={isApplyingJobId === job.id || !profile.activeResume}
                      onClick={() => onApplySingle(job.id)}
                      className={`rounded-md px-3.5 py-2 text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        evalRes.qualifiesForAutoApply
                          ? 'bg-blue-700 text-white hover:bg-blue-800'
                          : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      } disabled:opacity-50`}
                    >
                      {isApplyingJobId === job.id
                        ? 'আবেদন হচ্ছে...'
                        : 'রিজিউমি দিয়ে আবেদন করুন'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {syncMeta.lastSyncedAt && (
        <div className="text-right text-xs text-slate-400">
          সর্বশেষ সিঙ্ক: {formatDateTimeBn(syncMeta.lastSyncedAt)} · মোট{' '}
          {syncMeta.totalJobs}টি চাকরি
        </div>
      )}
    </div>
  );
};

