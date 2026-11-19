import type { ApplicationRecord, PendingEmailDraft } from '../types';

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
      errPayload?.error?.message || `Gmail API error (HTTP ${response.status})`;
    throw new Error(message);
  }

  return response.json();
}

export function formatSalaryRange(
  min: number | null,
  max: number | null,
  currency: string = 'BDT'
): string {
  if (min === null && max === null) return 'Not disclosed';
  const fmt = (val: number) =>
    currency === 'BDT'
      ? `৳${val.toLocaleString('en-US')}`
      : `$${Math.round(val / 1000)}k`;

  if (min !== null && max !== null && min !== max) {
    return `${fmt(min)} – ${fmt(max)}${currency === 'BDT' ? '/mo' : ''}`;
  }
  if (min !== null && max === null) {
    return `${fmt(min)} – Max${currency === 'BDT' ? '/mo' : ''}`;
  }
  return `${fmt((min ?? max) as number)}${currency === 'BDT' ? '/mo' : ''}`;
}

export function buildSubmissionEmailDraft(
  applications: ApplicationRecord[],
  recipient: string
): PendingEmailDraft {
  const isBatch = applications.length > 1;
  const subject = isBatch
    ? `RolePulse: Auto-applied to ${applications.length} matching jobs`
    : `RolePulse: Application Submitted — ${applications[0].jobTitle} (${applications[0].company})`;

  const summaryLines = applications.map(
    (app) =>
      `${app.jobTitle} · ${app.company} (${formatSalaryRange(
        app.salaryMin,
        app.salaryMax,
        app.salaryCurrency || 'BDT'
      )} · ${app.skillMatchPct}% skill match)`
  );

  const detailsBlock = applications
    .map(
      (app, idx) =>
        `${idx + 1}. ${app.jobTitle} — ${app.company}\n` +
        `   Location: ${app.location} (${app.workMode})\n` +
        `   Salary Range: ${formatSalaryRange(
          app.salaryMin,
          app.salaryMax,
          app.salaryCurrency || 'BDT'
        )}\n` +
        `   Matched Skills: ${app.matchedSkills.join(', ') || 'General match'}\n` +
        `   Attached Resume: ${app.resumeFilename}\n` +
        `   Next Follow-Up: ${
          app.nextFollowUpAt ? app.nextFollowUpAt.slice(0, 10) : 'Not scheduled'
        }\n` +
        `   Job Link: ${app.applyUrl}`
    )
    .join('\n\n');

  const bodyText =
    `Hello,\n\n` +
    `${
      isBatch
        ? `RolePulse automatically submitted ${applications.length} job applications matching your skills and salary criteria:`
        : `RolePulse submitted your application for "${applications[0].jobTitle}" at ${applications[0].company}:`
    }\n\n` +
    `${detailsBlock}\n\n` +
    `Visit your RolePulse dashboard anytime to review application statuses and follow-up reminders.\n\n` +
    `— RolePulse Application Tracker`;

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
  const prevLabel = previousStatus;
  const currLabel = application.status;

  const subject = `RolePulse: Application Status Updated to "${currLabel}" — ${application.jobTitle} (${application.company})`;

  const bodyText =
    `Hello,\n\n` +
    `An application status in your RolePulse pipeline has been updated:\n\n` +
    `Role: ${application.jobTitle}\n` +
    `Company: ${application.company}\n` +
    `Previous Stage: ${prevLabel}\n` +
    `Current Stage: ${currLabel}\n` +
    `Salary Range: ${formatSalaryRange(
      application.salaryMin,
      application.salaryMax,
      application.salaryCurrency || 'BDT'
    )}\n` +
    `Next Follow-Up: ${
      application.nextFollowUpAt ? application.nextFollowUpAt.slice(0, 10) : 'Not scheduled'
    }\n` +
    `${application.notes ? `Notes: ${application.notes}\n` : ''}\n` +
    `Job Link: ${application.applyUrl}\n\n` +
    `— RolePulse Application Tracker`;

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
