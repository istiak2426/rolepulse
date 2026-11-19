import type {
  ApplicationStatus,
  NotificationRecord,
  WorkMode,
} from '../types';

export const STATUS_LABELS_BN: Record<ApplicationStatus, string> = {
  Applied: 'আবেদন করা হয়েছে',
  Screening: 'স্ক্রিনিং',
  Interview: 'ইন্টারভিউ',
  Offer: 'অফার',
  Rejected: 'প্রত্যাখ্যাত',
  Withdrawn: 'প্রত্যাহারকৃত',
};

export const WORK_MODE_LABELS_BN: Record<WorkMode, string> = {
  Any: 'যেকোনো ধরন (রিমোট, হাইব্রিড, অফিস)',
  Remote: 'রিমোট',
  Hybrid: 'হাইব্রিড',
  'On-site': 'অফিসে',
};

export const TRIGGER_LABELS_BN: Record<NotificationRecord['trigger'], string> = {
  'Application Submitted': 'আবেদন জমা হয়েছে',
  'Status Updated': 'অবস্থা হালনাগাদ',
  'Follow-Up Sent': 'ফলো-আপ পাঠানো হয়েছে',
  'Test Alert': 'পরীক্ষামূলক বার্তা',
};

export const DELIVERY_LABELS_BN: Record<NotificationRecord['deliveryStatus'], string> = {
  'Sent via Gmail': 'Gmail-এ পাঠানো হয়েছে',
  Skipped: 'বাতিল / এড়ানো হয়েছে',
  Failed: 'ব্যর্থ হয়েছে',
  'Logged Locally': 'স্থানীয়ভাবে সংরক্ষিত',
};

export const METHOD_LABELS_BN: Record<'Auto-Applied' | 'Manual', string> = {
  'Auto-Applied': 'স্বয়ংক্রিয় আবেদন',
  Manual: 'ম্যানুয়াল আবেদন',
};

export const SOURCE_LABELS_BN: Record<string, string> = {
  'LinkedIn Feed': 'LinkedIn',
  'Bdjobs Live': 'Bdjobs',
  'Nextjobz BD': 'Nextjobz BD',
  'Remotive Live': 'Remotive',
  'RemoteOK Live': 'RemoteOK',
  'Jobicy Live': 'Jobicy',
  'Himalayas Live': 'Himalayas',
  'Arbeitnow Live': 'Arbeitnow',
  'WeWorkRemotely Live': 'WeWorkRemotely',
  'Imported URL': 'আমদানিকৃত লিংক',
};

export function formatSalaryBn(
  min: number | null,
  max: number | null,
  currency: string = 'BDT'
): string {
  if (!min && !max) return 'উল্লেখ নেই';
  if (currency === 'BDT') {
    const fmtBdt = (n: number) => `৳${n.toLocaleString('en-US')}`;
    if (min && max) return `${fmtBdt(min)}–${fmtBdt(max)}/মাস`;
    if (min) return `${fmtBdt(min)}+/মাস`;
    return `সর্বোচ্চ ${fmtBdt(max!)}/মাস`;
  }
  const fmtUsd = (n: number) => `$${Math.round(n / 1000)}k`;
  if (min && max) return `${fmtUsd(min)}–${fmtUsd(max)}`;
  if (min) return `${fmtUsd(min)}+`;
  return `সর্বোচ্চ ${fmtUsd(max!)}`;
}

export function formatDateBn(iso: string): string {
  return new Date(iso).toLocaleDateString('bn-BD', {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTimeBn(iso: string): string {
  return new Date(iso).toLocaleString('bn-BD', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
