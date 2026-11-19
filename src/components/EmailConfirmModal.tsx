import React from 'react';
import { Mail, X } from 'lucide-react';
import type { PendingEmailDraft } from '../types';
import { TRIGGER_LABELS_BN } from '../lib/bn';

interface EmailConfirmModalProps {
  draft: PendingEmailDraft | null;
  isSending: boolean;
  hasGmailToken: boolean;
  onConfirmSend: () => void;
  onConnectAndSend: () => void;
  onCancel: () => void;
}

export const EmailConfirmModal: React.FC<EmailConfirmModalProps> = ({
  draft,
  isSending,
  hasGmailToken,
  onConfirmSend,
  onConnectAndSend,
  onCancel,
}) => {
  if (!draft) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-confirm-title"
    >
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <div className="flex items-center gap-2.5">
            <Mail className="h-4 w-4 text-blue-700" />
            <h2
              id="email-confirm-title"
              className="font-display text-base font-semibold text-slate-900"
            >
              Gmail বিজ্ঞপ্তি পাঠানোর অনুমতি নিশ্চিত করুন
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="ডায়ালগ বন্ধ করুন"
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-4 px-5 py-4 text-sm text-slate-700">
          <p className="text-slate-600">
            RolePulse আপনার সংযুক্ত Gmail অ্যাকাউন্টের মাধ্যমে একটি ইমেইল বিজ্ঞপ্তি পাঠাতে
            প্রস্তুত। পাঠানোর আগে বার্তার বিবরণ যাচাই করে নিন:
          </p>

          <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3.5 text-xs">
            <div className="flex items-start justify-between gap-4">
              <span className="font-medium text-slate-500">ঘটনা</span>
              <span className="font-medium text-slate-900">
                {TRIGGER_LABELS_BN[draft.trigger] || draft.trigger}
              </span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="font-medium text-slate-500">প্রাপক</span>
              <span className="font-mono text-slate-900">{draft.recipient}</span>
            </div>
            <div className="flex items-start justify-between gap-4">
              <span className="font-medium text-slate-500">বিষয়</span>
              <span className="text-right font-medium text-slate-900">{draft.subject}</span>
            </div>
          </div>

          {draft.summaryLines.length > 0 && (
            <div className="space-y-1.5">
              <div className="text-xs font-medium text-slate-500">অন্তর্ভুক্ত তথ্য</div>
              <ul className="space-y-1 text-xs text-slate-700">
                {draft.summaryLines.map((line, i) => (
                  <li key={i} className="truncate">
                    • {line}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="max-h-40 overflow-y-auto rounded-md border border-slate-200 bg-white p-3 font-mono text-xs text-slate-600 whitespace-pre-wrap">
            {draft.bodyText}
          </div>

          {!hasGmailToken && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
              আপনার Google সেশন বর্তমানে সংযুক্ত নয়। সরাসরি Gmail-এ বিজ্ঞপ্তি পাঠাতে
              Google দিয়ে সাইন ইন করুন, অথবা স্থানীয়ভাবে সংরক্ষণ করতে এড়িয়ে যান।
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2.5 border-t border-slate-200 px-5 py-3.5">
          <button
            type="button"
            onClick={onCancel}
            disabled={isSending}
            className="rounded-md border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            ইমেইল এড়িয়ে যান
          </button>

          {hasGmailToken ? (
            <button
              type="button"
              onClick={onConfirmSend}
              disabled={isSending}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSending ? 'Gmail-এ পাঠানো হচ্ছে...' : 'Gmail বিজ্ঞপ্তি পাঠান'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onConnectAndSend}
              disabled={isSending}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {isSigningInOrSending(isSending)}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

function isSigningInOrSending(isSending: boolean): string {
  return isSending ? 'সংযুক্ত হচ্ছে...' : 'Google দিয়ে সাইন ইন করে পাঠান';
}
