import { useCallback, useEffect, useMemo, useState } from 'react';
import type { User } from 'firebase/auth';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';
import {
  getAccessToken,
  googleSignIn,
  initAuth,
  logoutGoogle,
} from './lib/firebase';
import {
  buildStatusUpdateEmailDraft,
  buildSubmissionEmailDraft,
  sendGmailMessage,
} from './lib/gmail';
import type {
  ApplicationRecord,
  ApplicationStatus,
  CandidateProfile,
  EvaluatedJob,
  JobSource,
  NotificationRecord,
  PendingEmailDraft,
  SyncMeta,
} from './types';
import { Sidebar, type NavTab } from './components/Sidebar';
import { TopBar } from './components/TopBar';
import { OverviewPipelineView } from './components/OverviewPipelineView';
import { JobFeedView } from './components/JobFeedView';
import { ProfileResumeView } from './components/ProfileResumeView';
import { NotificationsView } from './components/NotificationsView';
import { ApplicationDrawer } from './components/ApplicationDrawer';
import { EmailConfirmModal } from './components/EmailConfirmModal';

interface ToastMessage {
  id: string;
  tone: 'success' | 'error';
  text: string;
}

export default function App() {
  const [activeTab, setActiveTab] = useState<NavTab>('overview');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isAutoApplying, setIsAutoApplying] = useState(false);
  const [isApplyingJobId, setIsApplyingJobId] = useState<string | null>(null);

  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [jobs, setJobs] = useState<EvaluatedJob[]>([]);
  const [applications, setApplications] = useState<ApplicationRecord[]>([]);
  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [syncMeta, setSyncMeta] = useState<SyncMeta>({
    lastSyncedAt: null,
    liveSourcesQueried: [],
    liveCounts: {},
    totalJobs: 0,
  });

  const [selectedApplicationId, setSelectedApplicationId] = useState<string | null>(null);

  const [googleUser, setGoogleUser] = useState<User | null>(null);
  const [hasGmailToken, setHasGmailToken] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);

  const [pendingEmail, setPendingEmail] = useState<PendingEmailDraft | null>(null);
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((tone: 'success' | 'error', text: string) => {
    const id = `toast_${Date.now()}`;
    setToast({ id, tone, text });
    setTimeout(() => {
      setToast((curr) => (curr?.id === id ? null : curr));
    }, 4500);
  }, []);

  const loadBootstrap = useCallback(async () => {
    try {
      const res = await fetch('/api/bootstrap');
      if (!res.ok) throw new Error('ওয়ার্কস্পেসের তথ্য লোড করা যায়নি।');
      const data = await res.json();
      setProfile(data.profile);
      setJobs(data.jobs);
      setApplications(data.applications);
      setNotifications(data.notifications);
      setSyncMeta(data.syncMeta);
    } catch (err: any) {
      showToast('error', err?.message || 'ওয়ার্কস্পেস লোড করতে সমস্যা হয়েছে।');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    loadBootstrap();
  }, [loadBootstrap]);

  useEffect(() => {
    const unsubscribe = initAuth(
      (user) => {
        setGoogleUser(user);
        setHasGmailToken(Boolean(getAccessToken()));
      },
      (user) => {
        setGoogleUser(user);
        setHasGmailToken(false);
      }
    );
    return () => unsubscribe();
  }, []);

  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setHasGmailToken(Boolean(result.accessToken));
      showToast('success', `${result.user.email} অ্যাকাউন্টের সাথে Gmail সংযুক্ত হয়েছে।`);
    } catch (err: any) {
      showToast('error', err?.message || 'Google সাইন ইন বাতিল হয়েছে বা ব্যর্থ হয়েছে।');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleGoogleSignOut = async () => {
    await logoutGoogle();
    setGoogleUser(null);
    setHasGmailToken(false);
    showToast('success', 'Google অ্যাকাউন্ট থেকে সাইন আউট করা হয়েছে।');
  };

  const logNotificationRecord = async (
    payload: Omit<NotificationRecord, 'id' | 'createdAt'>
  ) => {
    const res = await fetch('/api/notifications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const data = await res.json();
      setNotifications(data.notifications);
      if (data.applications) setApplications(data.applications);
    }
  };

  const dispatchDraftWithToken = async (draft: PendingEmailDraft, token: string) => {
    setIsSendingEmail(true);
    try {
      const result = await sendGmailMessage({
        accessToken: token,
        to: draft.recipient,
        subject: draft.subject,
        bodyText: draft.bodyText,
      });

      await logNotificationRecord({
        trigger: draft.trigger,
        recipient: draft.recipient,
        subject: draft.subject,
        bodyPreview: draft.bodyText.slice(0, 180),
        deliveryStatus: 'Sent via Gmail',
        gmailMessageId: result.id,
        applicationId: draft.applicationId,
      });

      setPendingEmail(null);
      showToast('success', `${draft.recipient} ঠিকানায় ইমেইল বিজ্ঞপ্তি পাঠানো হয়েছে।`);
    } catch (err: any) {
      await logNotificationRecord({
        trigger: draft.trigger,
        recipient: draft.recipient,
        subject: draft.subject,
        bodyPreview: draft.bodyText.slice(0, 180),
        deliveryStatus: 'Failed',
        errorMessage: err?.message || 'Gmail পাঠানো ব্যর্থ হয়েছে',
        applicationId: draft.applicationId,
      });
      showToast('error', err?.message || 'Gmail বিজ্ঞপ্তি পাঠানো যায়নি।');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleConfirmSendEmail = async () => {
    if (!pendingEmail) return;
    const token = getAccessToken();
    if (!token) {
      showToast('error', 'Gmail বিজ্ঞপ্তি পাঠাতে অনুগ্রহ করে Google দিয়ে সাইন ইন করুন।');
      return;
    }
    await dispatchDraftWithToken(pendingEmail, token);
  };

  const handleConnectAndSendEmail = async () => {
    if (!pendingEmail) return;
    setIsSigningIn(true);
    try {
      const result = await googleSignIn();
      setGoogleUser(result.user);
      setHasGmailToken(true);
      await dispatchDraftWithToken(pendingEmail, result.accessToken);
    } catch (err: any) {
      showToast('error', err?.message || 'Google সাইন ইন ব্যর্থ হয়েছে।');
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleCancelEmail = async () => {
    if (pendingEmail) {
      await logNotificationRecord({
        trigger: pendingEmail.trigger,
        recipient: pendingEmail.recipient,
        subject: pendingEmail.subject,
        bodyPreview: pendingEmail.bodyText.slice(0, 180),
        deliveryStatus: 'Skipped',
        applicationId: pendingEmail.applicationId,
      });
    }
    setPendingEmail(null);
  };

  const getNotificationRecipient = useCallback(() => {
    return (
      profile?.notificationEmail ||
      googleUser?.email ||
      'istiak2426@gmail.com'
    );
  }, [profile, googleUser]);

  const handleRunAutoApply = async () => {
    if (!profile?.activeResume) {
      showToast('error', 'প্রথমে "দক্ষতা, বেতন ও রিজিউমি" পাতায় একটি রিজিউমি আপলোড করুন।');
      setActiveTab('profile');
      return;
    }

    setIsAutoApplying(true);
    try {
      const res = await fetch('/api/applications/auto-apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'অটো-আবেদন ব্যর্থ হয়েছে।');
      }

      setApplications(data.applications);
      setJobs(data.jobs);

      const created: ApplicationRecord[] = data.created || [];
      if (created.length === 0) {
        showToast(
          'error',
          'আপনার বর্তমান দক্ষতা ও বেতনের শর্ত অনুযায়ী নতুন কোনো যোগ্য চাকরি পাওয়া যায়নি।'
        );
        return;
      }

      showToast(
        'success',
        `${profile.activeResume.filename} ব্যবহার করে ${created.length}টি যোগ্য চাকরিতে স্বয়ংক্রিয় আবেদন সম্পন্ন হয়েছে।`
      );

      if (profile.notifyOnSubmit) {
        setPendingEmail(buildSubmissionEmailDraft(created, getNotificationRecipient()));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'অটো-আবেদন সম্পন্ন করা যায়নি।');
    } finally {
      setIsAutoApplying(false);
    }
  };

  const handleSyncJobs = async (
    query?: string,
    location?: string,
    sources?: JobSource[]
  ) => {
    setIsSyncing(true);
    try {
      const res = await fetch('/api/jobs/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: query ?? profile?.targetQuery,
          location: location ?? profile?.targetLocation,
          sources: sources ?? profile?.enabledSources,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'চাকরি সিঙ্ক ব্যর্থ হয়েছে।');

      setJobs(data.jobs);
      setSyncMeta(data.syncMeta);
      if (data.profile) setProfile(data.profile);

      if (query !== undefined || location !== undefined) {
        await fetch('/api/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            targetQuery: query ?? profile?.targetQuery,
            targetLocation: location ?? profile?.targetLocation,
          }),
        });
      }

      const qualifiedNow = (data.jobs as EvaluatedJob[]).filter(
        (j) => j.evaluation.qualifiesForAutoApply && !j.alreadyApplied
      ).length;

      showToast(
        'success',
        `${data.jobs.length}টি চাকরি সিঙ্ক হয়েছে (${qualifiedNow}টি আপনার দক্ষতা ও বেতনের সাথে মিলেছে)।`
      );

      if (profile?.autoApplyAfterSync && qualifiedNow > 0) {
        await handleRunAutoApply();
      }
    } catch (err: any) {
      showToast('error', err?.message || 'চাকরি সিঙ্ক করা যায়নি।');
    } finally {
      setIsSyncing(false);
    }
  };

  const handleApplySingle = async (jobId: string) => {
    if (!profile?.activeResume) {
      showToast('error', 'আবেদন করার আগে একটি রিজিউমি আপলোড করুন।');
      setActiveTab('profile');
      return;
    }

    setIsApplyingJobId(jobId);
    try {
      const res = await fetch('/api/applications/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, method: 'Manual' }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'আবেদন জমা দেওয়া যায়নি।');

      setApplications(data.applications);
      setJobs(data.jobs);
      const created: ApplicationRecord[] = data.created || [];
      showToast('success', `"${created[0]?.jobTitle}" পদের আবেদন জমা হয়েছে।`);

      if (profile.notifyOnSubmit && created.length > 0) {
        setPendingEmail(buildSubmissionEmailDraft(created, getNotificationRecipient()));
      }
    } catch (err: any) {
      showToast('error', err?.message || 'আবেদন জমা দিতে ব্যর্থ হয়েছে।');
    } finally {
      setIsApplyingJobId(null);
    }
  };

  const handleImportLinkedInJob = async (payload: {
    applyUrl: string;
    title: string;
    company: string;
    location: string;
    workMode: 'Remote' | 'Hybrid' | 'On-site';
    salaryMin?: number;
    salaryMax?: number;
    skillsText: string;
    description: string;
  }) => {
    const res = await fetch('/api/jobs/import', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'চাকরি যোগ করা যায়নি।');
      return;
    }
    setJobs(data.jobs);
    setSyncMeta(data.syncMeta);
    showToast('success', `"${payload.title}" যোগ ও মূল্যায়ন করা হয়েছে।`);
  };

  const handleUpdateApplication = async (
    id: string,
    patch: Partial<ApplicationRecord>,
    triggerEmailOnStatusChange = false
  ) => {
    const res = await fetch(`/api/applications/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'হালনাগাদ ব্যর্থ হয়েছে।');
      return;
    }
    setApplications(data.applications);
    setJobs(data.jobs);
    showToast('success', 'আবেদনের তথ্য হালনাগাদ হয়েছে।');

    if (
      triggerEmailOnStatusChange &&
      profile?.notifyOnStatusUpdate &&
      data.application
    ) {
      setPendingEmail(
        buildStatusUpdateEmailDraft(
          data.application,
          data.previousStatus,
          getNotificationRecipient()
        )
      );
    }
  };

  const handleQuickStatusChange = async (
    app: ApplicationRecord,
    newStatus: ApplicationStatus
  ) => {
    if (app.status === newStatus) return;
    await handleUpdateApplication(app.id, { status: newStatus }, true);
  };

  const handleLogFollowUp = async (
    id: string,
    note: string,
    nextFollowUpDays: number
  ) => {
    const res = await fetch(`/api/applications/${id}/followup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note, nextFollowUpDays }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'ফলো-আপ সংরক্ষণ করা যায়নি।');
      return;
    }
    setApplications(data.applications);
    showToast('success', 'ফলো-আপ টাইমলাইনে সংরক্ষিত হয়েছে।');
  };

  const handleDeleteApplication = async (id: string) => {
    const res = await fetch(`/api/applications/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (res.ok) {
      setApplications(data.applications);
      setJobs(data.jobs);
      setSelectedApplicationId(null);
      showToast('success', 'আবেদনটি ট্র্যাকার থেকে সরানো হয়েছে।');
    }
  };

  const handleSaveProfile = async (patch: Partial<CandidateProfile>) => {
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'সেটিংস সংরক্ষণ করা যায়নি।');
      return;
    }
    setProfile(data.profile);
    setJobs(data.jobs);
    showToast('success', 'ফিল্টারিং শর্তাবলি ও পছন্দসমূহ সংরক্ষিত হয়েছে।');
  };

  const handleUploadResume = async (file: File, mergeSkills: boolean) => {
    const formData = new FormData();
    formData.append('resume', file);
    formData.append('mergeSkills', String(mergeSkills));

    const res = await fetch('/api/resume/upload', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json();
    if (!res.ok) {
      showToast('error', data.error || 'রিজিউমি আপলোড ব্যর্থ হয়েছে।');
      return;
    }
    setProfile(data.profile);
    setJobs(data.jobs);
    showToast(
      'success',
      `${data.resume.filename} আপলোড হয়েছে (${data.resume.extractedSkills.length}টি দক্ষতা শনাক্ত)।`
    );
  };

  const handleSendTestNotification = (recipient: string) => {
    setPendingEmail({
      id: `test_${Date.now()}`,
      trigger: 'Test Alert',
      recipient: recipient || getNotificationRecipient(),
      subject: 'RolePulse: Test Gmail Notification',
      bodyText:
        'Hello,\n\nThis is a test email from RolePulse confirming that your Gmail notifications for application submissions and status updates are active.\n\n— RolePulse Application Tracker',
      summaryLines: ['RolePulse test email notification'],
    });
  };

  const handleSendFollowUpEmail = (
    app: ApplicationRecord,
    subject: string,
    bodyText: string
  ) => {
    setPendingEmail({
      id: `followup_${Date.now()}`,
      trigger: 'Follow-Up Sent',
      recipient: app.recruiterEmail,
      subject,
      bodyText,
      applicationId: app.id,
      summaryLines: [
        `${app.recruiterName || app.company}-এর কাছে ফলো-আপ (${app.jobTitle})`,
      ],
    });
  };

  const counts = useMemo(() => {
    const followUpsDue = applications.filter((app) => {
      if (!app.nextFollowUpAt || app.followUpCompleted) return false;
      if (app.status === 'Rejected' || app.status === 'Withdrawn' || app.status === 'Offer') {
        return false;
      }
      return new Date(app.nextFollowUpAt).getTime() <= Date.now() + 24 * 3600 * 1000;
    }).length;

    const qualifiedJobs = jobs.filter(
      (j) => j.evaluation.qualifiesForAutoApply && !j.alreadyApplied
    ).length;

    return {
      applications: applications.length,
      followUpsDue,
      qualifiedJobs,
      notifications: notifications.length,
    };
  }, [applications, jobs, notifications]);

  const selectedApplication = useMemo(
    () => applications.find((a) => a.id === selectedApplicationId) ?? null,
    [applications, selectedApplicationId]
  );

  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-600">
        ওয়ার্কস্পেস লোড হচ্ছে...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <Sidebar
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        profile={profile}
        counts={counts}
        googleUser={googleUser}
        hasGmailToken={hasGmailToken}
        isSigningIn={isSigningIn}
        onGoogleSignIn={handleGoogleSignIn}
        onGoogleSignOut={handleGoogleSignOut}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <TopBar
          activeTab={activeTab}
          isSyncing={isSyncing}
          isAutoApplying={isAutoApplying}
          qualifiedUnappliedCount={counts.qualifiedJobs}
          onSyncJobs={() => handleSyncJobs()}
          onRunAutoApply={handleRunAutoApply}
          onOpenMobileMenu={() => setMobileMenuOpen(true)}
        />

        <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
          <div className="mx-auto max-w-6xl">
            {activeTab === 'overview' && (
              <OverviewPipelineView
                applications={applications}
                jobs={jobs}
                isLoading={isLoading}
                onSelectApplication={(app) => setSelectedApplicationId(app.id)}
                onQuickStatusChange={handleQuickStatusChange}
                onNavigateToJobs={() => setActiveTab('jobs')}
              />
            )}

            {activeTab === 'jobs' && (
              <JobFeedView
                jobs={jobs}
                profile={profile}
                syncMeta={syncMeta}
                isSyncing={isSyncing}
                isApplyingJobId={isApplyingJobId}
                onSyncWithQuery={handleSyncJobs}
                onApplySingle={handleApplySingle}
                onRunAutoApply={handleRunAutoApply}
                onImportLinkedInJob={handleImportLinkedInJob}
                onToggleUndisclosedSalary={(include) =>
                  handleSaveProfile({ includeUndisclosedSalary: include })
                }
                onNavigateToProfile={() => setActiveTab('profile')}
              />
            )}

            {activeTab === 'profile' && (
              <ProfileResumeView
                profile={profile}
                onSaveProfile={handleSaveProfile}
                onUploadResume={handleUploadResume}
              />
            )}

            {activeTab === 'notifications' && (
              <NotificationsView
                profile={profile}
                notifications={notifications}
                googleUser={googleUser}
                hasGmailToken={hasGmailToken}
                isSigningIn={isSigningIn}
                onGoogleSignIn={handleGoogleSignIn}
                onSaveNotificationPrefs={handleSaveProfile}
                onSendTestNotification={handleSendTestNotification}
              />
            )}
          </div>
        </main>
      </div>

      <ApplicationDrawer
        application={selectedApplication}
        onClose={() => setSelectedApplicationId(null)}
        onUpdateApplication={handleUpdateApplication}
        onLogFollowUp={handleLogFollowUp}
        onSendFollowUpEmail={handleSendFollowUpEmail}
        onDelete={handleDeleteApplication}
      />

      <EmailConfirmModal
        draft={pendingEmail}
        isSending={isSendingEmail || isSigningIn}
        hasGmailToken={hasGmailToken}
        onConfirmSend={handleConfirmSendEmail}
        onConnectAndSend={handleConnectAndSendEmail}
        onCancel={handleCancelEmail}
      />

      {toast && (
        <div
          role="status"
          className={`fixed bottom-5 right-5 z-50 flex max-w-sm items-center gap-2.5 rounded-lg border px-4 py-3 text-xs font-medium shadow-md ${
            toast.tone === 'success'
              ? 'border-emerald-200 bg-white text-emerald-800'
              : 'border-red-200 bg-white text-red-700'
          }`}
        >
          {toast.tone === 'success' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
          )}
          <span className="flex-1">{toast.text}</span>
          <button
            type="button"
            onClick={() => setToast(null)}
            aria-label="বিজ্ঞপ্তি বন্ধ করুন"
            className="text-slate-400 hover:text-slate-700"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
