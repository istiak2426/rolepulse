import React, { useState } from 'react';
import { Mail, CheckCircle2, AlertCircle, Send } from 'lucide-react';
import type { User } from 'firebase/auth';
import type { CandidateProfile, NotificationRecord } from '../types';
import {
  DELIVERY_LABELS_BN,
  TRIGGER_LABELS_BN,
  formatDateTimeBn,
} from '../lib/bn';

interface NotificationsViewProps {
  profile: CandidateProfile;
  notifications: NotificationRecord[];
  googleUser: User | null;
  hasGmailToken: boolean;
  isSigningIn: boolean;
  onGoogleSignIn: () => void;
  onSaveNotificationPrefs: (patch: Partial<CandidateProfile>) => Promise<void>;
  onSendTestNotification: (recipient: string) => void;
}

export const NotificationsView: React.FC<NotificationsViewProps> = ({
  profile,
  notifications,
  googleUser,
  hasGmailToken,
  isSigningIn,
  onGoogleSignIn,
  onSaveNotificationPrefs,
  onSendTestNotification,
}) => {
  const [recipientEmail, setRecipientEmail] = useState(
    profile.notificationEmail || googleUser?.email || ''
  );
  const [notifyOnSubmit, setNotifyOnSubmit] = useState(profile.notifyOnSubmit);
  const [notifyOnStatusUpdate, setNotifyOnStatusUpdate] = useState(
    profile.notifyOnStatusUpdate
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await onSaveNotificationPrefs({
        notificationEmail: recipientEmail.trim(),
        notifyOnSubmit,
        notifyOnStatusUpdate,
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Gmail Connection & Preferences */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-lg border border-slate-200 bg-white p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-blue-700" />
            <h2 className="font-display text-sm font-semibold text-slate-900">
              Gmail সংযোগের অবস্থা
            </h2>
          </div>

          {googleUser && hasGmailToken ? (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-emerald-700">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>সংযুক্ত অ্যাকাউন্ট: {googleUser.email}</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                প্রতিবার আবেদন জমা হলে বা আবেদনের ধাপ পরিবর্তন হলে আপনার অনুমোদনের পর
                Gmail-এর মাধ্যমে সরাসরি ইমেইল বিজ্ঞপ্তি পাঠানো হবে।
              </p>
              <button
                type="button"
                onClick={() =>
                  onSendTestNotification(recipientEmail || googleUser.email || '')
                }
                className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-800 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>পরীক্ষামূলক বিজ্ঞপ্তি পাঠান</span>
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-xs font-medium text-amber-700">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>Gmail সংযুক্ত নয়</span>
              </div>
              <p className="text-xs leading-relaxed text-slate-600">
                আবেদন জমা বা হালনাগাদের সাথে সাথে ইমেইল বিজ্ঞপ্তি পেতে আপনার Google
                অ্যাকাউন্ট দিয়ে সাইন ইন করুন।
              </p>
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

        <form
          onSubmit={handleSave}
          className="lg:col-span-7 rounded-lg border border-slate-200 bg-white p-5 space-y-4"
        >
          <h2 className="font-display text-sm font-semibold text-slate-900">
            বিজ্ঞপ্তির শর্ত ও প্রাপক
          </h2>

          <div>
            <label className="block text-xs font-medium text-slate-600">
              বিজ্ঞপ্তি পাওয়ার ইমেইল ঠিকানা
            </label>
            <input
              type="email"
              required
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="you@gmail.com"
              className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
            />
          </div>

          <div className="space-y-2.5 pt-1">
            <label className="flex items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={notifyOnSubmit}
                onChange={(e) => setNotifyOnSubmit(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              <span>
                আবেদন জমা হলে (ম্যানুয়াল বা স্বয়ংক্রিয়) Gmail বিজ্ঞপ্তি প্রস্তুত করুন
              </span>
            </label>

            <label className="flex items-center gap-2.5 text-xs text-slate-700">
              <input
                type="checkbox"
                checked={notifyOnStatusUpdate}
                onChange={(e) => setNotifyOnStatusUpdate(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-slate-300 text-blue-700"
              />
              <span>আবেদনের ধাপ হালনাগাদ হলে Gmail বিজ্ঞপ্তি প্রস্তুত করুন</span>
            </label>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={isSaving}
              className="rounded-md bg-blue-700 px-4 py-2 text-xs font-medium text-white hover:bg-blue-800 disabled:opacity-60 transition-colors cursor-pointer"
            >
              {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'বিজ্ঞপ্তির সেটিংস সংরক্ষণ করুন'}
            </button>
          </div>
        </form>
      </div>

      {/* Sent Notification Audit Log */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-3.5">
          <h3 className="font-display text-sm font-semibold text-slate-900">
            পাঠানো ইমেইল বিজ্ঞপ্তির ইতিহাস
          </h3>
        </div>

        {notifications.length === 0 ? (
          <div className="px-6 py-12 text-center text-xs text-slate-500">
            এখনও কোনো ইমেইল বিজ্ঞপ্তি পাঠানো হয়নি। নতুন আবেদন জমা দিন অথবা কোনো
            আবেদনের অবস্থা পরিবর্তন করে প্রথম Gmail বিজ্ঞপ্তি পাঠান।
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-slate-500">
                  <th className="px-4 py-3 font-medium">সময়</th>
                  <th className="px-4 py-3 font-medium">কারণ</th>
                  <th className="px-4 py-3 font-medium">প্রাপক</th>
                  <th className="px-4 py-3 font-medium">বিষয়</th>
                  <th className="px-4 py-3 font-medium">ডেলিভারি অবস্থা</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {notifications.map((n) => (
                  <tr key={n.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-mono text-slate-500 tabular-nums whitespace-nowrap">
                      {formatDateTimeBn(n.createdAt)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800 whitespace-nowrap">
                      {TRIGGER_LABELS_BN[n.trigger] || n.trigger}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-slate-600 whitespace-nowrap">
                      {n.recipient}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 max-w-md truncate">
                      {n.subject}
                    </td>
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {n.deliveryStatus === 'Sent via Gmail' ? (
                        <span className="font-medium text-emerald-700">
                          {DELIVERY_LABELS_BN[n.deliveryStatus]}
                        </span>
                      ) : n.deliveryStatus === 'Failed' ? (
                        <span className="font-medium text-red-600" title={n.errorMessage}>
                          {DELIVERY_LABELS_BN[n.deliveryStatus]}
                        </span>
                      ) : (
                        <span className="text-slate-500">
                          {DELIVERY_LABELS_BN[n.deliveryStatus] || n.deliveryStatus}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
