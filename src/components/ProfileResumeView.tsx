import React, { useEffect, useState } from 'react';
import { Upload, FileText, Plus, X, Check, ExternalLink } from 'lucide-react';
import type { CandidateProfile, WorkMode } from '../types';
import { WORK_MODE_LABELS_BN } from '../lib/bn';

interface ProfileResumeViewProps {
  profile: CandidateProfile;
  onSaveProfile: (patch: Partial<CandidateProfile>) => Promise<void>;
  onUploadResume: (file: File, mergeSkills: boolean) => Promise<void>;
}

export const ProfileResumeView: React.FC<ProfileResumeViewProps> = ({
  profile,
  onSaveProfile,
  onUploadResume,
}) => {
  const [fullName, setFullName] = useState(profile.fullName);
  const [headline, setHeadline] = useState(profile.headline);
  const [phone, setPhone] = useState(profile.phone || '');
  const [portfolioUrl, setPortfolioUrl] = useState(profile.portfolioUrl || '');
  const [linkedinUrl, setLinkedinUrl] = useState(profile.linkedinUrl || '');
  const [githubUrl, setGithubUrl] = useState(profile.githubUrl || '');
  const [skills, setSkills] = useState<string[]>(profile.skills);
  const [mustHaveSkills, setMustHaveSkills] = useState<string[]>(profile.mustHaveSkills);
  const [newSkill, setNewSkill] = useState('');
  const [minSkillMatchPct, setMinSkillMatchPct] = useState(profile.minSkillMatchPct);
  const [salaryCurrency, setSalaryCurrency] = useState<'BDT' | 'USD'>(
    profile.salaryCurrency || 'BDT'
  );
  const [minSalary, setMinSalary] = useState(profile.minSalary);
  const [maxSalary, setMaxSalary] = useState<number>(profile.maxSalary ?? 220000);
  const [noMaxLimit, setNoMaxLimit] = useState<boolean>(profile.maxSalary === null);
  const [includeUndisclosedSalary, setIncludeUndisclosedSalary] = useState(
    profile.includeUndisclosedSalary
  );
  const [preferredWorkMode, setPreferredWorkMode] = useState<WorkMode>(
    profile.preferredWorkMode
  );
  const [autoApplyAfterSync, setAutoApplyAfterSync] = useState(
    profile.autoApplyAfterSync
  );
  const [maxAutoApplyPerBatch, setMaxAutoApplyPerBatch] = useState(
    profile.maxAutoApplyPerBatch
  );
  const [coverNoteTemplate, setCoverNoteTemplate] = useState(profile.coverNoteTemplate);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);
  const [mergeExtractedOnUpload, setMergeExtractedOnUpload] = useState(true);

  useEffect(() => {
    setFullName(profile.fullName);
    setHeadline(profile.headline);
    setPhone(profile.phone || '');
    setPortfolioUrl(profile.portfolioUrl || '');
    setLinkedinUrl(profile.linkedinUrl || '');
    setGithubUrl(profile.githubUrl || '');
    setSkills(profile.skills);
    setMustHaveSkills(profile.mustHaveSkills);
    setMinSkillMatchPct(profile.minSkillMatchPct);
    setSalaryCurrency(profile.salaryCurrency || 'BDT');
    setMinSalary(profile.minSalary);
    setMaxSalary(profile.maxSalary ?? 220000);
    setNoMaxLimit(profile.maxSalary === null);
    setIncludeUndisclosedSalary(profile.includeUndisclosedSalary);
    setPreferredWorkMode(profile.preferredWorkMode);
    setAutoApplyAfterSync(profile.autoApplyAfterSync);
    setMaxAutoApplyPerBatch(profile.maxAutoApplyPerBatch);
    setCoverNoteTemplate(profile.coverNoteTemplate);
  }, [profile]);

  const handleAddSkill = () => {
    const clean = newSkill.trim();
    if (!clean) return;
    if (!skills.some((s) => s.toLowerCase() === clean.toLowerCase())) {
      setSkills((prev) => [...prev, clean]);
    }
    setNewSkill('');
  };

  const handleRemoveSkill = (skill: string) => {
    setSkills((prev) => prev.filter((s) => s !== skill));
    setMustHaveSkills((prev) => prev.filter((s) => s !== skill));
  };

  const toggleMustHave = (skill: string) => {
    setMustHaveSkills((prev) =>
      prev.includes(skill) ? prev.filter((s) => s !== skill) : [...prev, skill]
    );
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      await onUploadResume(file, mergeExtractedOnUpload);
    } finally {
      setIsUploading(false);
      e.target.value = '';
    }
  };

  const handleSyncResumeSkills = () => {
    if (!profile.activeResume?.extractedSkills.length) return;
    const merged = Array.from(
      new Set([...skills, ...profile.activeResume.extractedSkills])
    );
    setSkills(merged);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSavedNotice(false);
    try {
      await onSaveProfile({
        fullName: fullName.trim() || profile.fullName,
        headline: headline.trim() || profile.headline,
        phone: phone.trim(),
        portfolioUrl: portfolioUrl.trim(),
        linkedinUrl: linkedinUrl.trim(),
        githubUrl: githubUrl.trim(),
        skills,
        mustHaveSkills,
        minSkillMatchPct,
        salaryCurrency,
        minSalary,
        maxSalary: noMaxLimit ? null : Math.max(minSalary, maxSalary),
        includeUndisclosedSalary,
        preferredWorkMode,
        autoApplyAfterSync,
        maxAutoApplyPerBatch,
        coverNoteTemplate,
      });
      setSavedNotice(true);
      setTimeout(() => setSavedNotice(false), 3000);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Resume Upload & Active Resume Section */}
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div>
            <h2 className="font-display text-sm font-semibold text-slate-900">
              আপলোডকৃত রিজিউমি
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              RolePulse প্রতিটি স্বয়ংক্রিয় আবেদনের সাথে এই রিজিউমিটি সংযুক্ত করে।
            </p>
          </div>

          <label className="flex cursor-pointer flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 px-4 py-7 text-center hover:border-blue-600 hover:bg-blue-50/40 transition-colors">
            <Upload className="h-6 w-6 text-slate-400" />
            <span className="mt-2 text-xs font-medium text-slate-800">
              {isUploading
                ? 'রিজিউমি বিশ্লেষণ ও দক্ষতা শনাক্ত হচ্ছে...'
                : 'PDF, DOCX, TXT বা MD রিজিউমি আপলোড করতে ক্লিক করুন'}
            </span>
            <span className="mt-1 text-[11px] text-slate-500">সর্বোচ্চ ফাইল সাইজ ৫ MB</span>
            <input
              type="file"
              accept=".pdf,.txt,.md,.doc,.docx"
              onChange={handleFileChange}
              disabled={isUploading}
              className="hidden"
            />
          </label>

          <label className="flex items-center gap-2 text-xs text-slate-600">
            <input
              type="checkbox"
              checked={mergeExtractedOnUpload}
              onChange={(e) => setMergeExtractedOnUpload(e.target.checked)}
              className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
            />
            <span>রিজিউমি থেকে পাওয়া দক্ষতাগুলো স্বয়ংক্রিয়ভাবে ফিল্টারে যোগ করুন</span>
          </label>

          {profile.activeResume && (
            <div className="border-t border-slate-200 pt-4 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText className="h-4 w-4 shrink-0 text-blue-700" />
                  <span className="truncate text-xs font-semibold text-slate-900">
                    {profile.activeResume.filename}
                  </span>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {profile.activeResume.fileUrl && (
                    <a
                      href={profile.activeResume.fileUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline"
                    >
                      <span>ফাইল দেখুন</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <span className="font-mono text-[11px] text-slate-400 tabular-nums">
                    {Math.max(1, Math.round(profile.activeResume.sizeBytes / 1024))} KB
                  </span>
                </div>
              </div>

              <div className="text-xs text-slate-500">
                শনাক্তকৃত {profile.activeResume.extractedSkills.length}টি প্রযুক্তিগত দক্ষতা:{' '}
                <span className="text-slate-700">
                  {profile.activeResume.extractedSkills.join(', ') || 'কোনোটি পাওয়া যায়নি'}
                </span>
              </div>

              {profile.activeResume.extractedSkills.length > 0 && (
                <button
                  type="button"
                  onClick={handleSyncResumeSkills}
                  className="text-xs font-medium text-blue-700 hover:text-blue-800 cursor-pointer"
                >
                  শনাক্তকৃত দক্ষতাগুলো প্রোফাইলে যুক্ত করুন
                </button>
              )}

              <div className="max-h-28 overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-2.5 font-mono text-[11px] leading-relaxed text-slate-600">
                {profile.activeResume.extractedText || 'কোনো টেক্সট প্রিভিউ পাওয়া যায়নি।'}
              </div>
            </div>
          )}
        </div>

        {/* Technical Skills, Salary Range & Auto-Apply Rules */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-5 space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div>
              <h2 className="font-display text-sm font-semibold text-slate-900">
                ফিল্টারিং ও অটো-আবেদনের শর্তাবলি
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                স্বয়ংক্রিয় আবেদনের জন্য চাকরিকে অবশ্যই আপনার দক্ষতা ও বেতনের শর্ত পূরণ করতে
                হবে।
              </p>
            </div>
            {savedNotice && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700">
                <Check className="h-3.5 w-3.5" />
                <span>সংরক্ষিত</span>
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-slate-600">
                প্রার্থীর পূর্ণ নাম
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                পছন্দের কাজের ধরন
              </label>
              <select
                value={preferredWorkMode}
                onChange={(e) => setPreferredWorkMode(e.target.value as WorkMode)}
                className="mt-1 w-full rounded-md border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
              >
                <option value="Any">{WORK_MODE_LABELS_BN.Any}</option>
                <option value="Remote">শুধুমাত্র রিমোট</option>
                <option value="Hybrid">{WORK_MODE_LABELS_BN.Hybrid}</option>
                <option value="On-site">{WORK_MODE_LABELS_BN['On-site']}</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                প্রফেশনাল হেডলাইন
              </label>
              <input
                type="text"
                value={headline}
                onChange={(e) => setHeadline(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                পোর্টফোলিও ওয়েবসাইট
              </label>
              <input
                type="url"
                value={portfolioUrl}
                onChange={(e) => setPortfolioUrl(e.target.value)}
                placeholder="https://shahistiakshanto.netlify.app/"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                ফোন নম্বর
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+8801748008483"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                LinkedIn প্রোফাইল
              </label>
              <input
                type="url"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                placeholder="https://www.linkedin.com/in/istiak2426"
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
            </div>
          </div>

          {/* Salary Range */}
          <div className="space-y-2.5 border-t border-slate-100 pt-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="block text-xs font-medium text-slate-700">
                প্রত্যাশিত বেতন পরিসীমা
              </label>
              <select
                value={salaryCurrency}
                onChange={(e) => {
                  const next = e.target.value as 'BDT' | 'USD';
                  setSalaryCurrency(next);
                  if (next === 'BDT' && minSalary < 20000) {
                    setMinSalary(40000);
                    setNoMaxLimit(true);
                  }
                }}
                className="rounded border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-700"
              >
                <option value="BDT">BDT (৳ / মাসিক — ঢাকা)</option>
                <option value="USD">USD ($ / বার্ষিক — গ্লোবাল)</option>
              </select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <span className="text-[11px] text-slate-500">
                  সর্বনিম্ন বেতন ({salaryCurrency === 'BDT' ? '৳/মাস' : '$/বছর'})
                </span>
                <input
                  type="number"
                  step={5000}
                  min={0}
                  value={minSalary}
                  onChange={(e) => setMinSalary(Number(e.target.value))}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                />
              </div>
              <div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[11px] text-slate-500">
                    সর্বোচ্চ লক্ষ্য ({salaryCurrency === 'BDT' ? '৳/মাস' : '$/বছর'})
                  </span>
                  <label className="inline-flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={noMaxLimit}
                      onChange={(e) => setNoMaxLimit(e.target.checked)}
                      className="h-3 w-3 rounded border-slate-300 text-blue-700"
                    />
                    <span>সীমা নেই (Max)</span>
                  </label>
                </div>
                {noMaxLimit ? (
                  <div className="mt-1 flex h-[38px] items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-xs font-medium text-slate-600">
                    সর্বোচ্চ সীমা নেই (40k+ সব বেতন অনুমোদিত)
                  </div>
                ) : (
                  <input
                    type="number"
                    step={5000}
                    min={minSalary}
                    value={maxSalary}
                    onChange={(e) => setMaxSalary(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 font-mono text-sm text-slate-900 tabular-nums focus:border-blue-600 focus:outline-none"
                  />
                )}
              </div>
            </div>

            <label className="flex items-center gap-2 text-xs text-slate-600 pt-1">
              <input
                type="checkbox"
                checked={includeUndisclosedSalary}
                onChange={(e) => setIncludeUndisclosedSalary(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              <span>বেতন উল্লেখ না থাকা চাকরিগুলোকেও অন্তর্ভুক্ত করুন</span>
            </label>
          </div>

          {/* Technical Skills */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                নির্দিষ্ট প্রযুক্তিগত দক্ষতা ({skills.length}টি)
              </label>
              <span className="text-[11px] text-slate-500">
                আবশ্যক (Must-Have) নির্ধারণ করতে দক্ষতায় ক্লিক করুন
              </span>
            </div>

            <div className="flex gap-2">
              <input
                type="text"
                value={newSkill}
                onChange={(e) => setNewSkill(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddSkill();
                  }
                }}
                placeholder="দক্ষতা যোগ করুন (যেমন: Kubernetes, GraphQL, Python)..."
                className="flex-1 rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-900 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={handleAddSkill}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>যোগ করুন</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              {skills.map((skill) => {
                const isRequired = mustHaveSkills.includes(skill);
                return (
                  <div
                    key={skill}
                    className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs ${
                      isRequired
                        ? 'border-blue-600 bg-blue-50 text-blue-800 font-medium'
                        : 'border-slate-200 bg-slate-50 text-slate-700'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => toggleMustHave(skill)}
                      title="আবশ্যক দক্ষতা হিসেবে টগল করুন"
                      className="cursor-pointer"
                    >
                      {skill}
                      {isRequired ? ' (আবশ্যক)' : ''}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveSkill(skill)}
                      aria-label={`${skill} সরান`}
                      className="text-slate-400 hover:text-slate-700 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            <div>
              <div className="flex items-center justify-between text-xs">
                <span className="text-slate-600">দক্ষতা মিলের সর্বনিম্ন হার</span>
                <span className="font-mono font-semibold text-slate-900 tabular-nums">
                  {minSkillMatchPct}%
                </span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                step={5}
                value={minSkillMatchPct}
                onChange={(e) => setMinSkillMatchPct(Number(e.target.value))}
                className="mt-1.5 w-full accent-blue-700"
              />
            </div>
          </div>

          {/* Automation Behavior */}
          <div className="space-y-3 border-t border-slate-100 pt-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <label className="flex items-center gap-2 text-xs text-slate-700">
                <input
                  type="checkbox"
                  checked={autoApplyAfterSync}
                  onChange={(e) => setAutoApplyAfterSync(e.target.checked)}
                  className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
                />
                <span>চাকরি সিঙ্ক করার পর যোগ্যগুলোতে স্বয়ংক্রিয়ভাবে আবেদন করুন</span>
              </label>

              <label className="flex items-center gap-2 text-xs text-slate-600">
                <span>প্রতি ব্যাচে সর্বোচ্চ</span>
                <input
                  type="number"
                  min={1}
                  max={25}
                  value={maxAutoApplyPerBatch}
                  onChange={(e) => setMaxAutoApplyPerBatch(Number(e.target.value))}
                  className="w-16 rounded-md border border-slate-200 px-2 py-1 font-mono text-xs text-slate-900 tabular-nums"
                />
              </label>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-600">
                স্বয়ংক্রিয় কভার নোট টেমপ্লেট
              </label>
              <textarea
                rows={3}
                value={coverNoteTemplate}
                onChange={(e) => setCoverNoteTemplate(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-xs text-slate-700 focus:border-blue-600 focus:outline-none"
              />
              <p className="mt-1 text-[11px] text-slate-400">
                ব্যবহারযোগ্য ভেরিয়েবল: {'{{jobTitle}}'}, {'{{company}}'},{' '}
                {'{{matchedSkills}}'}, {'{{fullName}}'}, {'{{portfolioUrl}}'},{' '}
                {'{{phone}}'}
              </p>
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'শর্তাবলি সংরক্ষণ করে পুনরায় যাচাই করুন'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
