import React from 'react';
import { RefreshCw, Send, Menu } from 'lucide-react';
import type { NavTab } from './Sidebar';

interface TopBarProps {
  activeTab: NavTab;
  isSyncing: boolean;
  isAutoApplying: boolean;
  qualifiedUnappliedCount: number;
  onSyncJobs: () => void;
  onRunAutoApply: () => void;
  onOpenMobileMenu: () => void;
}

const TAB_TITLES: Record<NavTab, string> = {
  overview: 'আবেদন ট্র্যাকার',
  jobs: 'চাকরি ফিড (সকল সাইট)',
  profile: 'দক্ষতা, বেতন ও রিজিউমি',
  notifications: 'ইমেইল বিজ্ঞপ্তি',
};

export const TopBar: React.FC<TopBarProps> = ({
  activeTab,
  isSyncing,
  isAutoApplying,
  qualifiedUnappliedCount,
  onSyncJobs,
  onRunAutoApply,
  onOpenMobileMenu,
}) => {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-8 border-b border-slate-200 bg-white px-4 sm:px-6">
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onOpenMobileMenu}
          aria-label="নেভিগেশন খুলুন"
          className="rounded-md p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 lg:hidden"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2 text-sm truncate">
          <span className="text-slate-400 whitespace-nowrap">ওয়ার্কস্পেস</span>
          <span className="text-slate-300" aria-hidden="true">
            /
          </span>
          <h1 className="font-display font-semibold text-slate-900 truncate">
            {TAB_TITLES[activeTab]}
          </h1>
        </div>
      </div>

      <div className="flex items-center gap-2.5 shrink-0">
        <button
          type="button"
          onClick={onSyncJobs}
          disabled={isSyncing}
          className="inline-flex items-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'সব সাইট সিঙ্ক হচ্ছে...' : 'সব সাইট সিঙ্ক করুন'}</span>
        </button>

        <button
          type="button"
          onClick={onRunAutoApply}
          disabled={isAutoApplying || qualifiedUnappliedCount === 0}
          className="inline-flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-500 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Send className="h-3.5 w-3.5" />
          <span>
            {isAutoApplying
              ? 'আবেদন জমা হচ্ছে...'
              : `অটো-আবেদন (${qualifiedUnappliedCount})`}
          </span>
        </button>
      </div>
    </header>
  );
};
