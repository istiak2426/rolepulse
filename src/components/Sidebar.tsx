import React from 'react';
import {
  LayoutGrid,
  Briefcase,
  SlidersHorizontal,
  Mail,
  LogOut,
  FileText,
  X,
} from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CandidateProfile } from '../types';
import { formatSalaryBn } from '../lib/bn';

export type NavTab = 'overview' | 'jobs' | 'profile' | 'notifications';

interface SidebarProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  profile: CandidateProfile;
  counts: {
    applications: number;
    followUpsDue: number;
    qualifiedJobs: number;
    notifications: number;
  };
  googleUser: User | null;
  hasGmailToken: boolean;
  isSigningIn: boolean;
  onGoogleSignIn: () => void;
  onGoogleSignOut: () => void;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  onSelectTab,
  profile,
  counts,
  googleUser,
  hasGmailToken,
  isSigningIn,
  onGoogleSignIn,
  onGoogleSignOut,
  mobileOpen,
  onCloseMobile,
}) => {
  const navItems: Array<{
    id: NavTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    {
      id: 'overview',
      label: 'আবেদন ট্র্যাকার',
      icon: LayoutGrid,
      count: counts.applications,
    },
    {
      id: 'jobs',
      label: 'চাকরি ফিড',
      icon: Briefcase,
      count: counts.qualifiedJobs,
    },
    {
      id: 'profile',
      label: 'দক্ষতা, বেতন ও রিজিউমি',
      icon: SlidersHorizontal,
    },
    {
      id: 'notifications',
      label: 'ইমেইল বিজ্ঞপ্তি',
      icon: Mail,
      count: counts.notifications,
    },
  ];

  const initials = (profile.fullName || 'প্রার্থী')
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const content = (
    <aside className="flex h-full w-64 flex-col justify-between border-r border-slate-200 bg-white">
      <div>
        <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
          <span className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0">
            RolePulse
          </span>
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="নেভিগেশন বন্ধ করুন"
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="space-y-1 px-3 py-4" aria-label="প্রধান নেভিগেশন">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  onSelectTab(item.id);
                  onCloseMobile();
                }}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2.5 text-left text-sm font-medium transition-colors whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="flex items-center gap-2.5 truncate">
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  />
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span
                    className={`ml-2 font-mono text-xs tabular-nums ${
                      isActive ? 'text-blue-700' : 'text-slate-400'
                    }`}
                  >
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="mx-3 mt-2 border-t border-slate-200 pt-4 px-2">
          <div className="flex items-center justify-between text-xs font-medium text-slate-500">
            <span>সক্রিয় রিজিউমি</span>
            {profile.activeResume?.fileUrl && (
              <a
                href={profile.activeResume.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[11px] font-medium text-blue-700 hover:underline"
              >
                PDF দেখুন
              </a>
            )}
          </div>
          <div className="mt-1.5 flex items-start gap-2 text-xs text-slate-800">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" />
            <span className="truncate font-medium">
              {profile.activeResume
                ? profile.activeResume.filename
                : 'কোনো রিজিউমি আপলোড করা হয়নি'}
            </span>
          </div>
          {profile.portfolioUrl && (
            <a
              href={profile.portfolioUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-1 block truncate text-[11px] text-blue-700 hover:underline"
            >
              {profile.portfolioUrl.replace(/^https?:\/\//, '')}
            </a>
          )}
          <div className="mt-2 flex items-center gap-1.5 text-xs text-slate-500 tabular-nums">
            <span>{profile.skills.length}টি দক্ষতা</span>
            <span aria-hidden="true">·</span>
            <span>
              {formatSalaryBn(
                profile.minSalary,
                profile.maxSalary,
                profile.salaryCurrency
              )}
            </span>
          </div>
          {counts.followUpsDue > 0 && (
            <button
              type="button"
              onClick={() => {
                onSelectTab('overview');
                onCloseMobile();
              }}
              className="mt-3 flex w-full items-center justify-between rounded-md border border-amber-200 bg-amber-50 px-2.5 py-2 text-xs font-medium text-amber-800 hover:bg-amber-100 transition-colors"
            >
              <span>ফলো-আপ বাকি আছে</span>
              <span className="font-mono tabular-nums">{counts.followUpsDue}</span>
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-slate-200 p-4">
        {googleUser && hasGmailToken ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              {googleUser.photoURL ? (
                <img
                  src={googleUser.photoURL}
                  alt={googleUser.displayName || 'Google অ্যাকাউন্ট'}
                  referrerPolicy="no-referrer"
                  className="h-8 w-8 rounded-full border border-slate-200 object-cover shrink-0"
                />
              ) : (
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-900 font-display text-xs font-semibold text-white">
                  {initials}
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-semibold text-slate-900">
                  {googleUser.displayName || profile.fullName}
                </div>
                <div className="truncate text-xs text-slate-500">
                  {googleUser.email}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-emerald-700">Gmail সংযুক্ত</span>
              <button
                type="button"
                onClick={onGoogleSignOut}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-900 transition-colors cursor-pointer"
              >
                <LogOut className="h-3 w-3" />
                <span>সাইন আউট</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <div className="text-xs text-slate-600 leading-relaxed">
              আবেদন জমা ও অবস্থা হালনাগাদের ইমেইল বিজ্ঞপ্তি পেতে Gmail সংযুক্ত করুন।
            </div>
            <button
              type="button"
              onClick={onGoogleSignIn}
              disabled={isSigningIn}
              className="gsi-material-button"
            >
              <div className="gsi-material-button-state" />
              <div className="gsi-material-button-content-wrapper">
                <div className="gsi-material-button-icon">
                  <svg
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 48 48"
                    style={{ display: 'block' }}
                  >
                    <path
                      fill="#EA4335"
                      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
                    />
                    <path
                      fill="#4285F4"
                      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
                    />
                    <path
                      fill="#34A853"
                      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
                    />
                    <path fill="none" d="M0 0h48v48H0z" />
                  </svg>
                </div>
                <span className="gsi-material-button-contents">
                  {isSigningIn ? 'সংযুক্ত হচ্ছে...' : 'Google দিয়ে সাইন ইন'}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>
    </aside>
  );

  return (
    <>
      <div className="hidden lg:block lg:shrink-0">{content}</div>
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
          <div className="relative z-50 h-full">{content}</div>
        </div>
      )}
    </>
  );
};
