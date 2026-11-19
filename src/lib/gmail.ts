import type { ApplicationRecord, PendingEmailDraft } from '../types';
import { STATUS_LABELS_BN, WORK_MODE_LABELS_BN, formatSalaryBn } from './bn';

function encodeBase64Url(input: string): string {
  const bytes = new TextEncoder().encode(input);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export async function sendGmailMessage(params: {
  accessToken: string;
  to: string;
  subject: string;
  bodyText: string;
}): Promise<{ id: string; threadId?: string }> {
  const { accessToken, to, subject, bodyText } = params;

  const mimeLines = [
    `To: ${to}`,
    `Subject: =?UTF-8?B?${btoa(unescape(encodeURIComponent(subject)))}?=`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset="UTF-8"',
    'Content-Transfer-Encoding: 7bit',
    '',
    bodyText,
  ];

  const raw = encodeBase64Url(mimeLines.join('\r\n'));

  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/messages/send',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ raw }),
    }
  );

  if (!response.ok) {
    const errPayload = await response.json().catch(() => ({}));
    const message =
      errPayload?.error?.message || `Gmail API ত্রুটি (HTTP ${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string = 'BDT'
): string {
  return formatSalaryBn(min, max, currency);
}

export function buildSubmissionEmailDraft(
  applications: ApplicationRecord[],
  recipient: string
): PendingEmailDraft {
  const isBatch = applications.length > 1;
  const subject = isBatch
    ? `RolePulse: স্বয়ংক্রিয়ভাবে ${applications.length}টি চাকরির আবেদন জমা হয়েছে`
    : `RolePulse: আবেদন জমা হয়েছে — ${applications[0].jobTitle} (${applications[0].company})`;

  const summaryLines = applications.map(
    (app) =>
      `${app.jobTitle} · ${app.company} (${formatSalaryRange(
        app.salaryMin,
        app.salaryMax,
        app.salaryCurrency || 'BDT'
      )} · ${app.skillMatchPct}% দক্ষতা মিল)`
  );

  const detailsBlock = applications
    .map(
      (app, idx) =>
        `${idx + 1}. ${app.jobTitle} — ${app.company}\n` +
        `   অবস্থান: ${app.location} (${WORK_MODE_LABELS_BN[app.workMode]})\n` +
        `   বেতন পরিসীমা: ${formatSalaryRange(
          app.salaryMin,
          app.salaryMax,
          app.salaryCurrency || 'BDT'
        )}\n` +
        `   মিলে যাওয়া দক্ষতা: ${app.matchedSkills.join(', ') || 'সাধারণ সামঞ্জস্য'}\n` +
        `   সংযুক্ত রিজিউমি: ${app.resumeFilename}\n` +
        `   পরবর্তী ফলো-আপ: ${
          app.nextFollowUpAt ? app.nextFollowUpAt.slice(0, 10) : 'নির্ধারিত নয়'
        }\n` +
        `   চাকরির লিংক: ${app.applyUrl}`
    )
    .join('\n\n');

  const bodyText =
    `হ্যালো,\n\n` +
    `${
      isBatch
        ? `আপনার নির্ধারিত দক্ষতা ও বেতন পরিসীমার সাথে সামঞ্জস্যপূর্ণ ${applications.length}টি চাকরিতে RolePulse স্বয়ংক্রিয়ভাবে আবেদন জমা দিয়েছে:`
        : `${applications[0].company}-এ "${applications[0].jobTitle}" পদের জন্য RolePulse আপনার আবেদন জমা দিয়েছে:`
    }\n\n` +
    `${detailsBlock}\n\n` +
    `আবেদনের বর্তমান অবস্থা এবং ফলো-আপ অনুস্মারক দেখতে আপনার RolePulse ড্যাশবোর্ডে প্রবেশ করুন।\n\n` +
    `— RolePulse আবেদন ট্র্যাকার`;

  return {
    id: `draft_${Date.now()}`,
    trigger: 'Application Submitted',
    recipient,
    subject,
    bodyText,
    applicationId: applications.length === 1 ? applications[0].id : undefined,
    summaryLines,
  };
}

export function buildStatusUpdateEmailDraft(
  application: ApplicationRecord,
  previousStatus: string,
  recipient: string
): PendingEmailDraft {
  const prevLabel =
    STATUS_LABELS_BN[previousStatus as keyof typeof STATUS_LABELS_BN] || previousStatus;
  const currLabel = STATUS_LABELS_BN[application.status] || application.status;

  const subject = `RolePulse: আবেদনের অবস্থা "${currLabel}"-এ হালনাগাদ হয়েছে — ${application.jobTitle} (${application.company})`;

  const bodyText =
    `হ্যালো,\n\n` +
    `আপনার RolePulse পাইপলাইনে একটি আবেদনের অবস্থা হালনাগাদ করা হয়েছে:\n\n` +
    `পদবি: ${application.jobTitle}\n` +
    `প্রতিষ্ঠান: ${application.company}\n` +
    `পূর্ববর্তী ধাপ: ${prevLabel}\n` +
    `বর্তমান ধাপ: ${currLabel}\n` +
    `বেতন পরিসীমা: ${formatSalaryRange(
      application.salaryMin,
      application.salaryMax,
      application.salaryCurrency || 'BDT'
    )}\n` +
    `পরবর্তী ফলো-আপ: ${
      application.nextFollowUpAt ? application.nextFollowUpAt.slice(0, 10) : 'নির্ধারিত নয়'
    }\n` +
    `${application.notes ? `নোট: ${application.notes}\n` : ''}\n` +
    `চাকরির লিংক: ${application.applyUrl}\n\n` +
    `— RolePulse আবেদন ট্র্যাকার`;

  return {
    id: `draft_${Date.now()}`,
    trigger: 'Status Updated',
    recipient,
    subject,
    bodyText,
    applicationId: application.id,
    summaryLines: [
      `${application.jobTitle} (${application.company}): ${prevLabel} → ${currLabel}`,
    ],
  };
}
