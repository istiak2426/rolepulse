export type WorkMode = 'Any' | 'Remote' | 'Hybrid' | 'On-site';

export type ApplicationStatus =
  | 'Applied'
  | 'Screening'
  | 'Interview'
  | 'Offer'
  | 'Rejected'
  | 'Withdrawn';

export type JobSource =
  | 'LinkedIn Feed'
  | 'Bdjobs Live'
  | 'Nextjobz BD'
  | 'Remotive Live'
  | 'RemoteOK Live'
  | 'Jobicy Live'
  | 'Himalayas Live'
  | 'Arbeitnow Live'
  | 'WeWorkRemotely Live'
  | 'Imported URL';

export interface ResumeInfo {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  uploadedAt: string;
  extractedText: string;
  extractedSkills: string[];
  fileUrl?: string;
}

export interface CandidateProfile {
  fullName: string;
  headline: string;
  phone?: string;
  portfolioUrl?: string;
  linkedinUrl?: string;
  githubUrl?: string;
  targetQuery: string;
  targetLocation: string;
  skills: string[];
  mustHaveSkills: string[];
  minSkillMatchPct: number;
  salaryCurrency: 'BDT' | 'USD';
  minSalary: number;
  maxSalary: number | null;
  includeUndisclosedSalary: boolean;
  preferredWorkMode: WorkMode;
  autoApplyAfterSync: boolean;
  maxAutoApplyPerBatch: number;
  coverNoteTemplate: string;
  notificationEmail: string;
  notifyOnSubmit: boolean;
  notifyOnStatusUpdate: boolean;
  enabledSources?: JobSource[];
  activeResume: ResumeInfo | null;
}

export interface JobListing {
  id: string;
  externalId: string;
  title: string;
  company: string;
  location: string;
  workMode: Exclude<WorkMode, 'Any'>;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string;
  requiredSkills: string[];
  description: string;
  applyUrl: string;
  source: JobSource;
  easyApply: boolean;
  postedAt: string;
  syncedAt: string;
}

export interface JobEvaluation {
  jobId: string;
  matchedSkills: string[];
  missingSkills: string[];
  skillMatchPct: number;
  mustHaveSatisfied: boolean;
  salaryFits: boolean;
  workModeFits: boolean;
  qualifiesForAutoApply: boolean;
  reasons: string[];
}

export interface EvaluatedJob extends JobListing {
  evaluation: JobEvaluation;
  alreadyApplied: boolean;
  applicationId?: string;
  applicationStatus?: ApplicationStatus;
}

export interface TimelineEvent {
  id: string;
  timestamp: string;
  type: 'SYNCED' | 'APPLIED' | 'STATUS_CHANGED' | 'FOLLOW_UP' | 'EMAIL_SENT' | 'NOTE';
  title: string;
  detail: string;
}

export interface ApplicationRecord {
  id: string;
  jobId: string;
  jobTitle: string;
  company: string;
  location: string;
  workMode: Exclude<WorkMode, 'Any'>;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency?: string;
  applyUrl: string;
  source: string;
  status: ApplicationStatus;
  appliedAt: string;
  updatedAt: string;
  submissionMethod: 'Auto-Applied' | 'Manual';
  resumeFilename: string;
  matchedSkills: string[];
  skillMatchPct: number;
  tailoredCoverNote: string;
  nextFollowUpAt: string | null;
  followUpCompleted: boolean;
  recruiterName: string;
  recruiterEmail: string;
  notes: string;
  timeline: TimelineEvent[];
}

export interface NotificationRecord {
  id: string;
  createdAt: string;
  trigger: 'Application Submitted' | 'Status Updated' | 'Follow-Up Sent' | 'Test Alert';
  recipient: string;
  subject: string;
  bodyPreview: string;
  deliveryStatus: 'Sent via Gmail' | 'Skipped' | 'Failed' | 'Logged Locally';
  gmailMessageId?: string;
  errorMessage?: string;
  applicationId?: string;
}

export interface PendingEmailDraft {
  id: string;
  trigger: NotificationRecord['trigger'];
  recipient: string;
  subject: string;
  bodyText: string;
  applicationId?: string;
  summaryLines: string[];
}

export interface SyncMeta {
  lastSyncedAt: string | null;
  liveSourcesQueried: string[];
  liveCounts: Record<string, number>;
  totalJobs: number;
}
