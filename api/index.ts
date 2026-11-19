import express from 'express';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import multer from 'multer';
import type {
  ApplicationRecord,
  ApplicationStatus,
  CandidateProfile,
  EvaluatedJob,
  JobEvaluation,
  JobListing,
  JobSource,
  NotificationRecord,
  ResumeInfo,
  SyncMeta,
  WorkMode,
} from '../src/types';

const DEFAULT_ENABLED_SOURCES: JobSource[] = [
  'LinkedIn Feed',
  'Bdjobs Live',
  'Nextjobz BD',
  'RemoteOK Live',
  'Jobicy Live',
  'Remotive Live',
  'Himalayas Live',
  'Arbeitnow Live',
  'WeWorkRemotely Live',
];

const IS_SERVERLESS = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);
const DATA_DIR = IS_SERVERLESS
  ? path.join('/tmp', 'rolepulse-data')
  : path.join(process.cwd(), 'data');
const RESUMES_DIR = path.join(DATA_DIR, 'resumes');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

try {
  fs.mkdirSync(RESUMES_DIR, { recursive: true });
} catch {
  // Serverless environments fall back to in-memory storage if directory creation fails
}

let memoryStore: StoreData | null = null;
const memoryResumes = new Map<string, { buffer: Buffer; mimeType: string }>();

const STATUS_BN: Record<ApplicationStatus, string> = {
  Applied: 'আবেদন করা হয়েছে',
  Screening: 'স্ক্রিনিং',
  Interview: 'ইন্টারভিউ',
  Offer: 'অফার',
  Rejected: 'প্রত্যাখ্যাত',
  Withdrawn: 'প্রত্যাহারকৃত',
};

const WORK_MODE_BN: Record<WorkMode, string> = {
  Any: 'যেকোনো',
  Remote: 'রিমোট',
  Hybrid: 'হাইব্রিড',
  'On-site': 'অফিসে',
};

const KNOWN_SKILLS = [
  'HTML',
  'CSS',
  'TypeScript',
  'JavaScript',
  'React',
  'Next.js',
  'Node.js',
  'Express',
  'Python',
  'Django',
  'FastAPI',
  'Go',
  'Rust',
  'Java',
  'Spring Boot',
  'C#',
  '.NET',
  'ASP.NET',
  'C++',
  'Ruby',
  'Rails',
  'PHP',
  'Laravel',
  'SQL',
  'SQL Server',
  'MariaDB',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Supabase',
  'Redis',
  'ETL',
  'GraphQL',
  'REST API',
  'gRPC',
  'Kafka',
  'RabbitMQ',
  'AWS',
  'GCP',
  'Azure',
  'Docker',
  'Kubernetes',
  'Terraform',
  'CI/CD',
  'GitHub Actions',
  'Git',
  'Tailwind CSS',
  'Vue.js',
  'Angular',
  'Svelte',
  'React Native',
  'Swift',
  'Kotlin',
  'Flutter',
  'PyTorch',
  'TensorFlow',
  'Machine Learning',
  'LLM',
  'Elasticsearch',
  'Snowflake',
  'Spark',
  'Playwright',
  'Jest',
  'Vitest',
  'Linux',
  'Windows Server',
  'Active Directory',
  'TCP/IP',
  'DNS',
  'IT Operations',
  'Application Support',
  'Incident Troubleshooting',
  'Access Management',
  'SIEM',
  'Log Analysis',
  'Incident Triage',
  'Threat Intelligence',
  'Vulnerability Management',
  'Microservices',
];

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function extractSkillsFromText(text: string): string[] {
  if (!text) return [];
  const found: string[] = [];
  for (const skill of KNOWN_SKILLS) {
    const escaped = escapeRegex(skill);
    const pattern = new RegExp(`(^|[^a-zA-Z0-9+#.])${escaped}([^a-zA-Z0-9+#.]|$)`, 'i');
    if (pattern.test(text)) {
      found.push(skill);
    }
  }
  return Array.from(new Set(found));
}

function extractReadablePdfText(buffer: Buffer): string {
  const rawLatin = buffer.toString('latin1');
  const chunks: string[] = [];

  const streamRegex = /stream[\r\n]+([\s\S]*?)[\r\n]+endstream/g;
  let match: RegExpExecArray | null;
  while ((match = streamRegex.exec(rawLatin)) !== null) {
    const streamSlice = Buffer.from(match[1], 'latin1');
    try {
      const inflated = zlib.inflateSync(streamSlice).toString('utf8');
      chunks.push(inflated);
    } catch {
      chunks.push(match[1]);
    }
  }

  const combined = chunks.length > 0 ? chunks.join('\n') : rawLatin;

  const textFragments: string[] = [];
  const literalRegex = /\(([^()\\]{2,200})\)/g;
  let litMatch: RegExpExecArray | null;
  while ((litMatch = literalRegex.exec(combined)) !== null) {
    const cleaned = litMatch[1].replace(/[^\x20-\x7E\n\r\t]/g, ' ').trim();
    if (cleaned.length >= 2 && /[a-zA-Z]/.test(cleaned)) {
      textFragments.push(cleaned);
    }
  }

  if (textFragments.length > 8) {
    return textFragments.join(' ').replace(/\s+/g, ' ').trim();
  }

  const asciiRuns = buffer
    .toString('utf8')
    .replace(/[^\x20-\x7E\n\r\t]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return asciiRuns.slice(0, 12000);
}

function extractResumeText(buffer: Buffer, filename: string, mimeType: string): string {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.pdf') || mimeType === 'application/pdf') {
    return extractReadablePdfText(buffer);
  }
  if (lower.endsWith('.docx')) {
    const raw = buffer.toString('utf8');
    const stripped = raw.replace(/<[^>]+>/g, ' ').replace(/[^\x20-\x7E\n\r\t]/g, ' ');
    return stripped.replace(/\s+/g, ' ').trim().slice(0, 15000);
  }
  return buffer.toString('utf8').slice(0, 20000);
}

function parseSalaryFromText(
  text: string
): { min: number | null; max: number | null; currency?: 'BDT' | 'USD' } {
  if (!text) return { min: null, max: null };

  const bdtRange = text.match(
    /(?:tk\.?|bdt|৳)\s*(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK]|\d{5,6})\s*[-–to]+\s*(?:tk\.?|bdt|৳)?\s*(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK]|\d{5,6})/i
  );
  if (bdtRange) {
    const normBdt = (val: string) => {
      const clean = val.replace(/[\s,]/g, '').toLowerCase();
      if (clean.endsWith('k')) return parseInt(clean.slice(0, -1), 10) * 1000;
      const num = parseInt(clean, 10);
      return num < 1000 ? num * 1000 : num;
    };
    const min = normBdt(bdtRange[1]);
    const max = normBdt(bdtRange[2]);
    if (min >= 15000 && max >= min && max <= 2000000) {
      return { min, max, currency: 'BDT' };
    }
  }

  const rangeMatch = text.match(
    /\$\s*(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK])\s*[-–to]+\s*\$?\s*(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK])/
  );
  if (rangeMatch) {
    const normalize = (val: string) => {
      const clean = val.replace(/[\s,]/g, '').toLowerCase();
      if (clean.endsWith('k')) return parseInt(clean.slice(0, -1), 10) * 1000;
      const num = parseInt(clean, 10);
      return num < 1000 ? num * 1000 : num;
    };
    const min = normalize(rangeMatch[1]);
    const max = normalize(rangeMatch[2]);
    if (min >= 30000 && max >= min && max <= 900000) {
      return { min, max, currency: 'USD' };
    }
  }

  const singleMatch = text.match(/\$\s*(\d{2,3}(?:,\d{3})+|\d{2,3}\s*[kK])/);
  if (singleMatch) {
    const clean = singleMatch[1].replace(/[\s,]/g, '').toLowerCase();
    const num = clean.endsWith('k')
      ? parseInt(clean.slice(0, -1), 10) * 1000
      : parseInt(clean, 10);
    if (num >= 40000 && num <= 700000) {
      return { min: num, max: Math.round(num * 1.15), currency: 'USD' };
    }
  }

  return { min: null, max: null };
}

function isTargetEngineeringRole(title: string, extraText = ''): boolean {
  const combined = `${title} ${extraText}`.toLowerCase();
  if (
    /\b(medical|phlebotomist|nurse|sales executive|hr & admin|vat & tax|accounts receivable|technician)\b/i.test(
      title
    )
  ) {
    return false;
  }
  return /(frontend|front-end|backend|back-end|full.?stack|software engineer|software developer|enterprise application|system engineer|systems engineer|system admin|systems admin|platform engineer|devops|site reliability|\bsre\b|cloud engineer|infrastructure|network engineer|web developer|it operations|application support|technical support|support engineer|soc analyst|security operations|cybersecurity|information security|security analyst|database|etl|erp|react|node\.?js|java|spring|\.net|asp\.net|c#|kubernetes|terraform)/i.test(
    combined
  );
}

function addBusinessDaysIso(fromDate: Date, days: number): string {
  const result = new Date(fromDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result.toISOString();
}

function buildLinkedInSeedJobs(nowIso: string): JobListing[] {
  const entries: Array<Omit<JobListing, 'syncedAt'>> = [
    {
      id: 'dhaka_fe_101',
      externalId: '4192837101',
      title: 'Senior Frontend Engineer (React / TypeScript)',
      company: 'Pathao Digital Labs',
      location: 'Gulshan 2, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 120000,
      salaryMax: 175000,
      salaryCurrency: 'BDT',
      requiredSkills: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS', 'REST API'],
      description:
        'Lead high-traffic consumer and merchant web platforms in Dhaka using React, TypeScript, Next.js, and Tailwind CSS.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837101/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 2 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_be_102',
      externalId: '4192837102',
      title: 'Backend Engineer (Node.js / Go / PostgreSQL)',
      company: 'Chaldal Engineering',
      location: 'Mohakhali DOHS, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 110000,
      salaryMax: 165000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'Docker', 'REST API'],
      description:
        'Design high-throughput logistics, inventory, and payment APIs for nationwide operations in Dhaka.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837102/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_devops_103',
      externalId: '4192837103',
      title: 'DevOps Engineer (AWS / Kubernetes / Terraform)',
      company: 'bKash Tech Hub',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 140000,
      salaryMax: 210000,
      salaryCurrency: 'BDT',
      requiredSkills: ['AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD', 'Linux'],
      description:
        'Automate multi-zone production clusters, observability, and zero-downtime deployment pipelines in Dhaka.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837103/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_ea_104',
      externalId: '4192837104',
      title: 'Enterprise Application Engineer (Java / Spring Boot)',
      company: 'Brain Station 23 Enterprise',
      location: 'Mohakhali, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 115000,
      salaryMax: 170000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Java', 'Spring Boot', 'PostgreSQL', 'Microservices', 'Docker', 'REST API'],
      description:
        'Architect core ERP, banking, and telco enterprise applications with Java, Spring Boot, PostgreSQL, and Docker.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837104/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 8 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_sys_105',
      externalId: '4192837105',
      title: 'System Engineer (Linux & Cloud Infrastructure)',
      company: 'Augmedix Bangladesh',
      location: 'Baridhara, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 105000,
      salaryMax: 155000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Linux', 'Docker', 'AWS', 'CI/CD', 'Kubernetes', 'Python'],
      description:
        'Manage enterprise Linux servers, identity security, high-availability networking, and automated monitoring.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837105/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 10 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_fe_106',
      externalId: '4192837106',
      title: 'Frontend Software Engineer (Next.js / GraphQL)',
      company: 'ShopUp Technology',
      location: 'Gulshan 1, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 100000,
      salaryMax: 150000,
      salaryCurrency: 'BDT',
      requiredSkills: ['TypeScript', 'React', 'Next.js', 'GraphQL', 'Tailwind CSS'],
      description:
        'Build B2B commerce dashboards and supply-chain web portals using Next.js, TypeScript, and GraphQL.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837106/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 14 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_be_107',
      externalId: '4192837107',
      title: 'Senior Backend Engineer (Distributed Systems)',
      company: 'SELISE Digital Platforms',
      location: 'Dhanmondi, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 135000,
      salaryMax: 195000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'MongoDB', 'Docker', 'AWS'],
      description:
        'Build European enterprise SaaS backends from our Dhaka engineering hub using TypeScript, Node.js, and AWS.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837107/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 18 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_ea_108',
      externalId: '4192837108',
      title: 'Enterprise Application Developer (.NET / SQL)',
      company: 'Datasoft Systems Bangladesh',
      location: 'Karwan Bazar, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 95000,
      salaryMax: 145000,
      salaryCurrency: 'BDT',
      requiredSkills: ['C#', '.NET', 'SQL', 'PostgreSQL', 'REST API', 'Docker'],
      description:
        'Develop mission-critical fintech and enterprise portal systems with .NET, SQL, REST APIs, and Docker.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837108/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 22 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_devops_109',
      externalId: '4192837109',
      title: 'Lead DevOps & SRE Engineer',
      company: 'Vivasoft Limited',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'Remote',
      salaryMin: 150000,
      salaryMax: 220000,
      salaryCurrency: 'BDT',
      requiredSkills: ['AWS', 'Kubernetes', 'Terraform', 'Docker', 'GitHub Actions', 'CI/CD'],
      description:
        'Architect GitOps CI/CD pipelines, EKS clusters, and automated infrastructure-as-code for international clients.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837109/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 28 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_sys_110',
      externalId: '4192837110',
      title: 'Senior System & Platform Engineer',
      company: 'Grameenphone Digital Core',
      location: 'Bashundhara R/A, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 130000,
      salaryMax: 185000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Linux', 'Kubernetes', 'Docker', 'Terraform', 'AWS', 'Microservices'],
      description:
        'Operate core telco platform infrastructure, container orchestration, and automated disaster recovery.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837110/',
      source: 'LinkedIn Feed',
      easyApply: false,
      postedAt: new Date(Date.now() - 32 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_be_111',
      externalId: '4192837111',
      title: 'Backend Engineer (Python / FastAPI / Kafka)',
      company: 'Shikho Technologies',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 100000,
      salaryMax: 145000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Python', 'FastAPI', 'PostgreSQL', 'Redis', 'Kafka', 'Docker'],
      description:
        'Scale real-time learning analytics and event-driven APIs in Dhaka using Python, FastAPI, and PostgreSQL.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837111/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 36 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_fe_112',
      externalId: '4192837112',
      title: 'Junior Frontend Developer',
      company: 'Uttara Web Studio',
      location: 'Uttara, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 40000,
      salaryMax: 60000,
      salaryCurrency: 'BDT',
      requiredSkills: ['JavaScript', 'React', 'Tailwind CSS', 'REST API'],
      description:
        'Build responsive landing pages and client dashboards using JavaScript, React, and Tailwind CSS.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837112/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 42 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_ea_113',
      externalId: '4192837113',
      title: 'Enterprise PHP / Laravel Application Engineer',
      company: 'Mirpur ERP Solutions',
      location: 'Mirpur DOHS, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 65000,
      salaryMax: 85000,
      salaryCurrency: 'BDT',
      requiredSkills: ['PHP', 'Laravel', 'MySQL', 'REST API'],
      description:
        'Maintain enterprise inventory and accounting modules in PHP, Laravel, and MySQL.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837113/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString(),
    },
    {
      id: 'dhaka_sys_114',
      externalId: '4192837114',
      title: 'Enterprise System & Network Engineer',
      company: 'TigerIT Bangladesh',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 110000,
      salaryMax: 160000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Linux', 'Docker', 'PostgreSQL', 'CI/CD', 'REST API'],
      description:
        'Deploy and harden high-security national identity & enterprise systems across Linux and Docker clusters.',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837114/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 54 * 3600 * 1000).toISOString(),
    },
    {
      id: 'bdjobs_dhaka_201',
      externalId: '1558401',
      title: 'Software Engineer (React / Node.js)',
      company: 'BJIT Limited',
      location: 'Baridhara, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 75000,
      salaryMax: 125000,
      salaryCurrency: 'BDT',
      requiredSkills: ['TypeScript', 'React', 'Node.js', 'PostgreSQL', 'Docker', 'REST API'],
      description:
        'Build enterprise client web applications for Japan & EU partners from our Dhaka delivery center.',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558401',
      source: 'Bdjobs Live',
      easyApply: true,
      postedAt: new Date(Date.now() - 5 * 3600 * 1000).toISOString(),
    },
    {
      id: 'bdjobs_dhaka_202',
      externalId: '1558402',
      title: 'Senior DevOps & Cloud Infrastructure Engineer',
      company: 'SSL Wireless',
      location: 'Eskaton, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 120000,
      salaryMax: 185000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Linux', 'AWS', 'Docker', 'Kubernetes', 'Terraform', 'CI/CD'],
      description:
        'Manage PCI-DSS compliant payment gateways, Kubernetes clusters, and automated disaster recovery in Dhaka.',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558402',
      source: 'Bdjobs Live',
      easyApply: true,
      postedAt: new Date(Date.now() - 7 * 3600 * 1000).toISOString(),
    },
    {
      id: 'bdjobs_dhaka_203',
      externalId: '1558403',
      title: 'Enterprise Application Engineer (Java / Microservices)',
      company: 'Reve Systems',
      location: 'Badda, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 95000,
      salaryMax: 145000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Java', 'Spring Boot', 'Microservices', 'PostgreSQL', 'Redis', 'Docker'],
      description:
        'Develop telco-grade enterprise communications and SaaS platforms for global telecom operators.',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558403',
      source: 'Bdjobs Live',
      easyApply: true,
      postedAt: new Date(Date.now() - 12 * 3600 * 1000).toISOString(),
    },
    {
      id: 'nextjobz_dhaka_301',
      externalId: 'nz_301',
      title: 'Frontend Engineer (Next.js / TypeScript)',
      company: 'ShareTrip Tech',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 85000,
      salaryMax: 135000,
      salaryCurrency: 'BDT',
      requiredSkills: ['TypeScript', 'React', 'Next.js', 'Tailwind CSS', 'REST API'],
      description:
        'Craft fast booking interfaces and B2B travel partner portals from Dhaka.',
      applyUrl: 'https://nextjobz.com.bd/jobs',
      source: 'Nextjobz BD',
      easyApply: true,
      postedAt: new Date(Date.now() - 9 * 3600 * 1000).toISOString(),
    },
    {
      id: 'nextjobz_dhaka_302',
      externalId: 'nz_302',
      title: 'Backend & System Engineer (Node.js / AWS)',
      company: '10 Minute School Engineering',
      location: 'Mohakhali, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 90000,
      salaryMax: 150000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Node.js', 'TypeScript', 'PostgreSQL', 'Redis', 'AWS', 'Docker'],
      description:
        'Scale live classroom APIs, exam engines, and cloud systems serving millions of learners across Bangladesh.',
      applyUrl: 'https://nextjobz.com.bd/jobs',
      source: 'Nextjobz BD',
      easyApply: true,
      postedAt: new Date(Date.now() - 15 * 3600 * 1000).toISOString(),
    },
    {
      id: 'nextjobz_dhaka_303',
      externalId: 'nz_303',
      title: 'Junior System & DevOps Engineer',
      company: 'Arogga Tech',
      location: 'Dhanmondi, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 48000,
      salaryMax: 75000,
      salaryCurrency: 'BDT',
      requiredSkills: ['Linux', 'Docker', 'AWS', 'CI/CD', 'GitHub Actions'],
      description:
        'Support production deployments, container monitoring, and CI/CD pipelines for e-commerce and logistics.',
      applyUrl: 'https://nextjobz.com.bd/jobs',
      source: 'Nextjobz BD',
      easyApply: true,
      postedAt: new Date(Date.now() - 20 * 3600 * 1000).toISOString(),
    },
    {
      id: 'bdjobs_dhaka_204',
      externalId: '1558404',
      title: 'Application Support & IT Operations Engineer',
      company: 'MetLife Bangladesh Tech Operations',
      location: 'Motijheel, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 60000,
      salaryMax: 95000,
      salaryCurrency: 'BDT',
      requiredSkills: [
        'Application Support',
        'IT Operations',
        'SQL Server',
        'Windows Server',
        'Active Directory',
        'Incident Troubleshooting',
      ],
      description:
        'Support enterprise insurance & ERP applications, SQL reporting workflows, user access governance, and production incident resolution.',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558404',
      source: 'Bdjobs Live',
      easyApply: true,
      postedAt: new Date(Date.now() - 4 * 3600 * 1000).toISOString(),
    },
    {
      id: 'li_dhaka_soc_115',
      externalId: '4192837115',
      title: 'Junior SOC Analyst (Security Operations / SIEM)',
      company: 'Beetles Cyber Security',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 45000,
      salaryMax: 75000,
      salaryCurrency: 'BDT',
      requiredSkills: [
        'SIEM',
        'Log Analysis',
        'Incident Triage',
        'Threat Intelligence',
        'Linux',
        'TCP/IP',
      ],
      description:
        'Monitor SIEM alerts, investigate Windows/Linux security events, perform alert triage, and escalate confirmed security incidents.',
      applyUrl: 'https://bd.linkedin.com/jobs/view/4192837115/',
      source: 'LinkedIn Feed',
      easyApply: true,
      postedAt: new Date(Date.now() - 3 * 3600 * 1000).toISOString(),
    },
    {
      id: 'nextjobz_dhaka_304',
      externalId: 'nz_304',
      title: 'IT Operations & Windows/Linux System Specialist',
      company: 'BRAC IT Services Ltd.',
      location: 'Mohakhali, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 55000,
      salaryMax: 90000,
      salaryCurrency: 'BDT',
      requiredSkills: [
        'IT Operations',
        'Windows Server',
        'Active Directory',
        'Linux',
        'TCP/IP',
        'SQL',
      ],
      description:
        'Manage Active Directory, Windows/Ubuntu servers, TCP/IP networking, access control, and enterprise application stability.',
      applyUrl: 'https://nextjobz.com.bd/jobs',
      source: 'Nextjobz BD',
      easyApply: true,
      postedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    },
    {
      id: 'bdjobs_dhaka_205',
      externalId: '1558405',
      title: 'Data, SQL Reporting & Python ETL Engineer',
      company: 'Kona Software Lab Ltd.',
      location: 'Gulshan 1, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 65000,
      salaryMax: 105000,
      salaryCurrency: 'BDT',
      requiredSkills: ['SQL', 'SQL Server', 'MariaDB', 'Python', 'ETL', 'REST API'],
      description:
        'Build automated Python ETL pipelines, optimize SQL Server/MariaDB queries, and validate operational data workflows.',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558405',
      source: 'Bdjobs Live',
      easyApply: true,
      postedAt: new Date(Date.now() - 11 * 3600 * 1000).toISOString(),
    },
  ];

  return entries.map((e) => ({ ...e, syncedAt: nowIso }));
}

interface StoreData {
  profile: CandidateProfile;
  jobs: JobListing[];
  applications: ApplicationRecord[];
  notifications: NotificationRecord[];
  syncMeta: SyncMeta;
}

function createInitialStore(): StoreData {
  const now = new Date();
  const nowIso = now.toISOString();
  const jobs = buildLinkedInSeedJobs(nowIso);

  const shantoSkills = [
    'C#',
    '.NET',
    'ASP.NET',
    'JavaScript',
    'React',
    'Next.js',
    'Node.js',
    'Tailwind CSS',
    'HTML',
    'CSS',
    'Python',
    'SQL',
    'SQL Server',
    'MariaDB',
    'MongoDB',
    'Supabase',
    'REST API',
    'ETL',
    'Docker',
    'Git',
    'Linux',
    'Windows Server',
    'Active Directory',
    'TCP/IP',
    'DNS',
    'IT Operations',
    'Application Support',
    'Incident Troubleshooting',
    'Access Management',
    'SIEM',
    'Log Analysis',
    'Incident Triage',
    'Threat Intelligence',
    'Vulnerability Management',
  ];

  const defaultResume: ResumeInfo = {
    id: 'res_shanto_pdf_1',
    filename: 'Shah_Istiak_Shanto__4__07c3bc37.pdf',
    mimeType: 'application/pdf',
    sizeBytes: 535600,
    uploadedAt: nowIso,
    fileUrl: '/assets/aistudio/Shah_Istiak_Shanto__4__07c3bc37.pdf',
    extractedText:
      'SHAH ISTIAK SHANTO — IT Operations | Application Support | Software Engineer (.NET / JS) | SOC Analyst Candidate. Dhaka, Bangladesh (+8801748008483, istiak2426@gmail.com, shahistiakshanto.netlify.app). 5+ years of experience at Prothom Alo (Enterprise Application Executive), bdnews24.com (Junior Software Engineer), and Walton Digi-Tech Industries Ltd. (IT Intern — Jonoshumari 2022 400k+ tablets). Core Stack: C#, ASP.NET, JavaScript, React, Next.js, Node.js, Tailwind CSS, Python, SQL Server, MariaDB, MongoDB, Supabase, ETL, REST API, Docker, Git, Windows Server, Active Directory, Ubuntu/Linux, TCP/IP, SIEM/Log Analysis, Incident Triage.',
    extractedSkills: shantoSkills,
  };

  const profile: CandidateProfile = {
    fullName: 'Shah Istiak Shanto',
    headline:
      'IT Operations · Enterprise Application Support · Software Engineer (.NET / JS) · SOC Analyst',
    phone: '+8801748008483',
    portfolioUrl: 'https://shahistiakshanto.netlify.app/',
    linkedinUrl: 'https://www.linkedin.com/in/istiak2426',
    githubUrl: 'https://github.com/istiak2426',
    targetQuery:
      'Frontend, Backend, Enterprise Application, System, DevOps, IT Operations, Application Support, SOC Analyst',
    targetLocation: 'Dhaka, Bangladesh',
    skills: shantoSkills,
    mustHaveSkills: [],
    minSkillMatchPct: 50,
    salaryCurrency: 'BDT',
    minSalary: 40000,
    maxSalary: null,
    includeUndisclosedSalary: false,
    preferredWorkMode: 'Any',
    autoApplyAfterSync: false,
    maxAutoApplyPerBatch: 5,
    coverNoteTemplate:
      'সম্মানিত নিয়োগ টিম, আমি {{company}}-এ "{{jobTitle}}" পদের জন্য আবেদন করছি। Prothom Alo ও bdnews24.com-এ {{matchedSkills}} নিয়ে ৫+ বছরের এন্টারপ্রাইজ অ্যাপ্লিকেশন সাপোর্ট, সফটওয়্যার ডেভেলপমেন্ট ও SQL/Python অটোমেশনের অভিজ্ঞতা রয়েছে। পর্যালোচনার জন্য আমার রিজিউমি ও পোর্টফোলিও ({{portfolioUrl}}) সংযুক্ত করা হলো। ধন্যবাদ, {{fullName}} ({{phone}})।',
    notificationEmail: 'istiak2426@gmail.com',
    notifyOnSubmit: true,
    notifyOnStatusUpdate: true,
    enabledSources: DEFAULT_ENABLED_SOURCES,
    activeResume: defaultResume,
  };

  const initialApps: ApplicationRecord[] = [
    {
      id: 'app_seed_1',
      jobId: 'dhaka_ea_108',
      jobTitle: 'Enterprise Application Developer (.NET / SQL)',
      company: 'Datasoft Systems Bangladesh',
      location: 'Karwan Bazar, Dhaka, Bangladesh',
      workMode: 'On-site',
      salaryMin: 95000,
      salaryMax: 145000,
      salaryCurrency: 'BDT',
      applyUrl: 'https://www.linkedin.com/jobs/view/4192837108/',
      source: 'LinkedIn Feed',
      status: 'Interview',
      appliedAt: new Date(now.getTime() - 6 * 86400 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 1 * 86400 * 1000).toISOString(),
      submissionMethod: 'Auto-Applied',
      resumeFilename: defaultResume.filename,
      matchedSkills: ['C#', '.NET', 'SQL', 'REST API', 'Docker'],
      skillMatchPct: 83,
      tailoredCoverNote:
        'সম্মানিত নিয়োগ টিম, আমি Datasoft Systems Bangladesh-এ Enterprise Application Developer (.NET / SQL) পদের জন্য আবেদন করছি। পোর্টফোলিও: https://shahistiakshanto.netlify.app/',
      nextFollowUpAt: new Date(now.getTime() - 2 * 3600 * 1000).toISOString(),
      followUpCompleted: false,
      recruiterName: 'তাসনিম আহমেদ',
      recruiterEmail: 'tasnim.hr@datasoft-bd.example',
      notes: 'টেকনিক্যাল স্ক্রিনিং সম্পন্ন; SQL Server অপ্টিমাইজেশন ও ASP.NET আর্কিটেকচার রাউন্ড নির্ধারিত।',
      timeline: [
        {
          id: 'evt_1',
          timestamp: new Date(now.getTime() - 6 * 86400 * 1000).toISOString(),
          type: 'APPLIED',
          title: 'রিজিউমি দিয়ে স্বয়ংক্রিয় আবেদন',
          detail: `${defaultResume.filename} সংযুক্ত করা হয়েছে (৮৩% দক্ষতা মিল)।`,
        },
        {
          id: 'evt_2',
          timestamp: new Date(now.getTime() - 3 * 86400 * 1000).toISOString(),
          type: 'STATUS_CHANGED',
          title: 'ধাপ পরিবর্তন: স্ক্রিনিং',
          detail: 'রিক্রুটার LinkedIn-এর মাধ্যমে যোগাযোগ করেছেন।',
        },
        {
          id: 'evt_3',
          timestamp: new Date(now.getTime() - 1 * 86400 * 1000).toISOString(),
          type: 'STATUS_CHANGED',
          title: 'ধাপ পরিবর্তন: ইন্টারভিউ',
          detail: 'প্রাথমিক রাউন্ড উত্তীর্ণ; চূড়ান্ত প্যানেল নির্ধারিত হচ্ছে।',
        },
      ],
    },
    {
      id: 'app_seed_2',
      jobId: 'bdjobs_dhaka_204',
      jobTitle: 'Application Support & IT Operations Engineer',
      company: 'MetLife Bangladesh Tech Operations',
      location: 'Motijheel, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 60000,
      salaryMax: 95000,
      salaryCurrency: 'BDT',
      applyUrl: 'https://jobs.bdjobs.com/jobdetails.asp?id=1558404',
      source: 'Bdjobs Live',
      status: 'Screening',
      appliedAt: new Date(now.getTime() - 4 * 86400 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 2 * 86400 * 1000).toISOString(),
      submissionMethod: 'Auto-Applied',
      resumeFilename: defaultResume.filename,
      matchedSkills: [
        'Application Support',
        'IT Operations',
        'SQL Server',
        'Windows Server',
        'Active Directory',
        'Incident Troubleshooting',
      ],
      skillMatchPct: 100,
      tailoredCoverNote:
        'সম্মানিত নিয়োগ টিম, MetLife Bangladesh-এ Application Support & IT Operations Engineer পদের জন্য আবেদন জমা দেওয়া হয়েছে।',
      nextFollowUpAt: new Date(now.getTime() + 1 * 86400 * 1000).toISOString(),
      followUpCompleted: false,
      recruiterName: 'রাফিউল করিম',
      recruiterEmail: 'rafiul.talent@metlifebd.example',
      notes: 'প্রাথমিক কল সম্পন্ন; এন্টারপ্রাইজ অ্যাপ্লিকেশন সাপোর্ট ও SQL রিপোর্টিং নিয়ে ফলো-আপ করুন।',
      timeline: [
        {
          id: 'evt_4',
          timestamp: new Date(now.getTime() - 4 * 86400 * 1000).toISOString(),
          type: 'APPLIED',
          title: 'রিজিউমি দিয়ে স্বয়ংক্রিয় আবেদন',
          detail: `${defaultResume.filename} সংযুক্ত করা হয়েছে (১০০% দক্ষতা মিল)।`,
        },
        {
          id: 'evt_5',
          timestamp: new Date(now.getTime() - 2 * 86400 * 1000).toISOString(),
          type: 'STATUS_CHANGED',
          title: 'ধাপ পরিবর্তন: স্ক্রিনিং',
          detail: 'রিক্রুটারের সাথে পরিচিতি কলের সময় নির্ধারিত হয়েছে।',
        },
      ],
    },
    {
      id: 'app_seed_3',
      jobId: 'nextjobz_dhaka_301',
      jobTitle: 'Frontend Engineer (Next.js / TypeScript)',
      company: 'ShareTrip Tech',
      location: 'Banani, Dhaka, Bangladesh',
      workMode: 'Hybrid',
      salaryMin: 85000,
      salaryMax: 135000,
      salaryCurrency: 'BDT',
      applyUrl: 'https://nextjobz.com.bd/jobs',
      source: 'Nextjobz BD',
      status: 'Applied',
      appliedAt: new Date(now.getTime() - 3 * 86400 * 1000).toISOString(),
      updatedAt: new Date(now.getTime() - 3 * 86400 * 1000).toISOString(),
      submissionMethod: 'Auto-Applied',
      resumeFilename: defaultResume.filename,
      matchedSkills: ['React', 'Next.js', 'Tailwind CSS', 'REST API'],
      skillMatchPct: 80,
      tailoredCoverNote:
        'সম্মানিত নিয়োগ টিম, ShareTrip Tech-এ Frontend Engineer (Next.js / TypeScript) পদের জন্য আবেদন জমা দেওয়া হয়েছে। পোর্টফোলিও: https://shahistiakshanto.netlify.app/',
      nextFollowUpAt: new Date(now.getTime() + 2 * 86400 * 1000).toISOString(),
      followUpCompleted: false,
      recruiterName: '',
      recruiterEmail: '',
      notes: 'Nextjobz BD-এর মাধ্যমে জমা হয়েছে; ২ দিন পর ফলো-আপ নির্ধারিত।',
      timeline: [
        {
          id: 'evt_6',
          timestamp: new Date(now.getTime() - 3 * 86400 * 1000).toISOString(),
          type: 'APPLIED',
          title: 'রিজিউমি দিয়ে স্বয়ংক্রিয় আবেদন',
          detail: `${defaultResume.filename} সংযুক্ত করা হয়েছে (৮০% দক্ষতা মিল)।`,
        },
      ],
    },
  ];

  return {
    profile,
    jobs,
    applications: initialApps,
    notifications: [],
    syncMeta: {
      lastSyncedAt: nowIso,
      liveSourcesQueried: ['LinkedIn Feed', 'Bdjobs Live', 'Nextjobz BD'],
      liveCounts: {
        'LinkedIn Feed': jobs.filter((j) => j.source === 'LinkedIn Feed').length,
        'Bdjobs Live': jobs.filter((j) => j.source === 'Bdjobs Live').length,
        'Nextjobz BD': jobs.filter((j) => j.source === 'Nextjobz BD').length,
      },
      totalJobs: jobs.length,
    },
  };
}

function loadStore(): StoreData {
  if (memoryStore) {
    return memoryStore;
  }
  try {
    if (fs.existsSync(STORE_PATH)) {
      const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
      if (parsed && parsed.profile && Array.isArray(parsed.jobs)) {
        memoryStore = parsed as StoreData;
        return memoryStore;
      }
    }
  } catch (err) {
    console.error('store.json পড়তে ব্যর্থ, নতুন ডেটা তৈরি হচ্ছে:', err);
  }
  const initial = createInitialStore();
  memoryStore = initial;
  try {
    fs.mkdirSync(RESUMES_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(initial, null, 2));
  } catch (err) {
    console.error('store.json সংরক্ষণ করা যায়নি, মেমোরিতে সংরক্ষিত হচ্ছে:', err);
  }
  return initial;
}

function saveStore(store: StoreData): void {
  memoryStore = store;
  try {
    fs.mkdirSync(RESUMES_DIR, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(store, null, 2));
  } catch (err) {
    console.error('store.json সংরক্ষণ করা যায়নি, মেমোরিতে সংরক্ষিত হচ্ছে:', err);
  }
}

function evaluateJob(job: JobListing, profile: CandidateProfile): JobEvaluation {
  const userSkillsLower = new Set(profile.skills.map((s) => s.toLowerCase().trim()));
  const matchedSkills: string[] = [];
  const missingSkills: string[] = [];

  for (const reqSkill of job.requiredSkills) {
    if (userSkillsLower.has(reqSkill.toLowerCase().trim())) {
      matchedSkills.push(reqSkill);
    } else {
      missingSkills.push(reqSkill);
    }
  }

  const skillMatchPct =
    job.requiredSkills.length > 0
      ? Math.round((matchedSkills.length / job.requiredSkills.length) * 100)
      : 100;

  const jobSkillsLower = new Set(job.requiredSkills.map((s) => s.toLowerCase().trim()));
  const mustHaveSatisfied =
    profile.mustHaveSkills.length === 0 ||
    profile.mustHaveSkills.some((ms) => jobSkillsLower.has(ms.toLowerCase().trim()));

  let salaryFits = false;
  const reasons: string[] = [];

  if (job.salaryMin === null && job.salaryMax === null) {
    salaryFits = profile.includeUndisclosedSalary;
    reasons.push(
      salaryFits
        ? 'বেতন উল্লেখ না থাকলেও পছন্দের তালিকায় অনুমোদিত'
        : 'বেতন উল্লেখ না থাকায় ফিল্টারে বাদ পড়েছে'
    );
  } else {
    const profileCur = profile.salaryCurrency || 'BDT';
    const jobCur = job.salaryCurrency || 'BDT';
    const rawBottom = job.salaryMin ?? job.salaryMax ?? 0;
    const rawTop = job.salaryMax ?? job.salaryMin ?? 0;

    const convertToProfile = (amount: number) => {
      if (jobCur === profileCur) return amount;
      if (jobCur === 'USD' && profileCur === 'BDT') return Math.round((amount * 120) / 12);
      if (jobCur === 'BDT' && profileCur === 'USD') return Math.round((amount * 12) / 120);
      return amount;
    };

    const jobBottom = convertToProfile(rawBottom);
    const jobTop = convertToProfile(rawTop);
    const overlapsMin = jobTop >= profile.minSalary;
    const overlapsMax = profile.maxSalary === null ? true : jobBottom <= profile.maxSalary;
    salaryFits = overlapsMin && overlapsMax;

    const fmtVal = (val: number) =>
      profileCur === 'BDT'
        ? `৳${val.toLocaleString('en-US')}`
        : `$${Math.round(val / 1000)}k`;

    if (!overlapsMin) {
      reasons.push(
        `সর্বোচ্চ বেতন ${fmtVal(jobTop)} আপনার ${fmtVal(
          profile.minSalary
        )} সর্বনিম্ন সীমার চেয়ে কম`
      );
    } else if (!overlapsMax && profile.maxSalary !== null) {
      reasons.push(
        `শুরুর বেতন ${fmtVal(jobBottom)} আপনার ${fmtVal(
          profile.maxSalary
        )} সর্বোচ্চ সীমার চেয়ে বেশি`
      );
    } else {
      reasons.push(
        `বেতন সামঞ্জস্যপূর্ণ (${fmtVal(jobBottom)}–${fmtVal(jobTop)}${
          profileCur === 'BDT' ? '/মাস' : ''
        })`
      );
    }
  }

  const workModeFits =
    profile.preferredWorkMode === 'Any' || job.workMode === profile.preferredWorkMode;
  if (!workModeFits) {
    reasons.push(
      `কাজের ধরন (${WORK_MODE_BN[job.workMode]}) আপনার পছন্দ (${WORK_MODE_BN[profile.preferredWorkMode]}) থেকে ভিন্ন`
    );
  }

  if (skillMatchPct < profile.minSkillMatchPct) {
    reasons.push(
      `দক্ষতা মিল ${skillMatchPct}% যা ন্যূনতম ${profile.minSkillMatchPct}% সীমার নিচে`
    );
  } else {
    reasons.push(
      `${job.requiredSkills.length || 1}টি প্রয়োজনীয় দক্ষতার মধ্যে ${matchedSkills.length}টি মিলেছে (${skillMatchPct}%)`
    );
  }

  if (!mustHaveSatisfied && profile.mustHaveSkills.length > 0) {
    reasons.push(`আবশ্যক দক্ষতা অনুপস্থিত (${profile.mustHaveSkills.join(' বা ')})`);
  }

  const qualifiesForAutoApply =
    skillMatchPct >= profile.minSkillMatchPct &&
    mustHaveSatisfied &&
    salaryFits &&
    workModeFits;

  return {
    jobId: job.id,
    matchedSkills,
    missingSkills,
    skillMatchPct,
    mustHaveSatisfied,
    salaryFits,
    workModeFits,
    qualifiesForAutoApply,
    reasons,
  };
}

function buildEvaluatedJobs(store: StoreData): EvaluatedJob[] {
  const appByJobId = new Map<string, ApplicationRecord>();
  for (const app of store.applications) {
    appByJobId.set(app.jobId, app);
  }

  return store.jobs.map((job) => {
    const evaluation = evaluateJob(job, store.profile);
    const existingApp = appByJobId.get(job.id);
    return {
      ...job,
      evaluation,
      alreadyApplied: Boolean(existingApp),
      applicationId: existingApp?.id,
      applicationStatus: existingApp?.status,
    };
  });
}

function renderCoverNote(
  template: string,
  job: JobListing,
  matchedSkills: string[],
  profile: CandidateProfile
): string {
  return template
    .replace(/\{\{jobTitle\}\}/g, job.title)
    .replace(/\{\{company\}\}/g, job.company)
    .replace(
      /\{\{matchedSkills\}\}/g,
      matchedSkills.length > 0 ? matchedSkills.join(', ') : profile.skills.slice(0, 4).join(', ')
    )
    .replace(/\{\{fullName\}\}/g, profile.fullName)
    .replace(
      /\{\{portfolioUrl\}\}/g,
      profile.portfolioUrl || 'https://shahistiakshanto.netlify.app/'
    )
    .replace(/\{\{linkedinUrl\}\}/g, profile.linkedinUrl || '')
    .replace(/\{\{phone\}\}/g, profile.phone || '');
}

async function fetchLinkedInGuestJobs(
  keywords: string,
  location: string,
  nowIso: string
): Promise<JobListing[]> {
  try {
    const firstQuery = keywords.split(',')[0]?.trim() || 'Software Engineer';
    const url = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(
      firstQuery
    )}&location=${encodeURIComponent(location || 'Dhaka, Bangladesh')}&start=0`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 4500);
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
        Accept: 'text/html',
      },
    });
    clearTimeout(timer);

    if (!res.ok) return [];
    const html = await res.text();
    const cards = html.split('<li').slice(1, 12);
    const parsed: JobListing[] = [];

    for (const card of cards) {
      const titleMatch = card.match(/base-search-card__title[^>]*>([\s\S]*?)<\/h3>/);
      const companyMatch = card.match(
        /base-search-card__subtitle[^>]*>[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/
      );
      const locMatch = card.match(/job-search-card__location[^>]*>([\s\S]*?)<\/span>/);
      const linkMatch = card.match(/href="(https:\/\/[a-z0-9-]+\.linkedin\.com\/jobs\/view\/[^"?]+)/);
      const salaryMatch = card.match(/job-search-card__salary-info[^>]*>([\s\S]*?)<\/span>/);

      if (titleMatch && companyMatch && linkMatch) {
        const title = titleMatch[1].replace(/<[^>]+>/g, '').trim();
        const company = companyMatch[1].replace(/<[^>]+>/g, '').trim();
        const loc = locMatch
          ? locMatch[1].replace(/<[^>]+>/g, '').trim()
          : location || 'United States';
        const applyUrl = linkMatch[1].trim();
        const idNumMatch = applyUrl.match(/(\d+)(?:\/)?$/);
        const externalId = idNumMatch ? idNumMatch[1] : `${Date.now()}_${parsed.length}`;
        const sal = salaryMatch
          ? parseSalaryFromText(salaryMatch[1])
          : { min: null, max: null, currency: undefined };
        const roleFallbackSkills = /devops|system|sre/i.test(`${title} ${keywords}`)
          ? ['Linux', 'Docker', 'AWS', 'CI/CD', 'Kubernetes']
          : /backend|enterprise/i.test(`${title} ${keywords}`)
            ? ['Node.js', 'Java', 'PostgreSQL', 'REST API', 'Docker']
            : ['TypeScript', 'React', 'Next.js', 'Tailwind CSS'];
        const skills = extractSkillsFromText(`${title} ${keywords}`);
        const workMode: Exclude<WorkMode, 'Any'> = /remote/i.test(loc)
          ? 'Remote'
          : /hybrid/i.test(title + loc)
            ? 'Hybrid'
            : 'On-site';

        parsed.push({
          id: `li_live_${externalId}`,
          externalId,
          title,
          company,
          location: loc,
          workMode,
          salaryMin: sal.min,
          salaryMax: sal.max,
          salaryCurrency:
            sal.currency || (/dhaka|bangladesh/i.test(loc) ? 'BDT' : 'USD'),
          requiredSkills: skills.length > 0 ? skills : roleFallbackSkills,
          description: `${company}-এ ${title} (${loc}) পদের লাইভ LinkedIn বিজ্ঞপ্তি।`,
          applyUrl,
          source: 'LinkedIn Feed',
          easyApply: true,
          postedAt: nowIso,
          syncedAt: nowIso,
        });
      }
    }

    return parsed;
  } catch {
    return [];
  }
}

async function fetchRemotiveLiveJobs(keywords: string, nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const url = `https://remotive.com/api/remote-jobs?category=software-dev&limit=24&search=${encodeURIComponent(
      keywords.split(',')[0]?.trim().split(' ')[0] || ''
    )}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<Record<string, any>> };
    const list = (Array.isArray(data.jobs) ? data.jobs : []).filter((item) =>
      isTargetEngineeringRole(String(item.title || ''), (item.tags || []).join(' '))
    );

    return list.slice(0, 12).map((item) => {
      const plainDesc = String(item.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sal = parseSalaryFromText(`${item.salary || ''} ${plainDesc}`);
      const skills = extractSkillsFromText(
        `${item.title} ${plainDesc} ${(item.tags || []).join(' ')}`
      );

      return {
        id: `remotive_${item.id}`,
        externalId: String(item.id),
        title: String(item.title || 'Software Engineer'),
        company: String(item.company_name || 'Technology Partner'),
        location: String(item.candidate_required_location || 'Remote'),
        workMode: 'Remote',
        salaryMin: sal.min,
        salaryMax: sal.max,
        salaryCurrency: sal.currency || 'USD',
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'React'],
        description: plainDesc.slice(0, 420),
        applyUrl: String(item.url || 'https://remotive.com'),
        source: 'Remotive Live',
        easyApply: false,
        postedAt: item.publication_date
          ? new Date(item.publication_date).toISOString()
          : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchBdjobsLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      'https://api.bdjobs.com/Jobs/api/JobSearch/GetJobSearch?fcat=8&LId=1&pg=1',
      {
        signal: controller.signal,
        headers: {
          Referer: 'https://jobs.bdjobs.com/',
          Origin: 'https://jobs.bdjobs.com',
          'User-Agent': 'Mozilla/5.0',
        },
      }
    );
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      data?: Array<Record<string, any>>;
      premiumData?: Array<Record<string, any>>;
    };
    const combined = [...(data.data || []), ...(data.premiumData || [])];
    const techItems = combined.filter((item) =>
      isTargetEngineeringRole(String(item.jobTitle || ''), String(item.jobDescription || ''))
    );

    return techItems.slice(0, 12).map((item) => {
      const desc = String(item.jobDescription || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sal = parseSalaryFromText(`${item.Salary || ''} ${desc}`);
      const skills = extractSkillsFromText(`${item.jobTitle} ${desc}`);
      const wp = String(item.WorkPlace || '').toLowerCase();
      const workMode: Exclude<WorkMode, 'Any'> = wp.includes('remote')
        ? 'Remote'
        : wp.includes('hybrid')
          ? 'Hybrid'
          : 'On-site';

      return {
        id: `bdjobs_live_${item.Jobid}`,
        externalId: String(item.Jobid),
        title: String(item.jobTitle || 'IT / Software Engineer'),
        company: String(item.companyName || 'Bangladesh Tech Company'),
        location: String(item.location || 'Dhaka, Bangladesh'),
        workMode,
        salaryMin: sal.min,
        salaryMax: sal.max,
        salaryCurrency: sal.currency || 'BDT',
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['Linux', 'REST API', 'SQL'],
        description: desc.slice(0, 400),
        applyUrl: `https://jobs.bdjobs.com/jobdetails.asp?id=${item.Jobid}`,
        source: 'Bdjobs Live',
        easyApply: Boolean(item.OnlineJob),
        postedAt: item.publishDate ? new Date(item.publishDate).toISOString() : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchRemoteOkLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://remoteok.com/api', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as Array<Record<string, any>>;
    const items = (Array.isArray(data) ? data.slice(1) : []).filter((item) =>
      isTargetEngineeringRole(
        String(item.position || ''),
        Array.isArray(item.tags) ? item.tags.join(' ') : ''
      )
    );

    return items.slice(0, 12).map((item) => {
      const plainDesc = String(item.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const rawMin = typeof item.salary_min === 'number' && item.salary_min > 0 ? item.salary_min : null;
      const rawMax = typeof item.salary_max === 'number' && item.salary_max > 0 ? item.salary_max : rawMin;
      const parsedSal = rawMin ? { min: rawMin, max: rawMax } : parseSalaryFromText(plainDesc);
      const tags = Array.isArray(item.tags) ? item.tags.join(' ') : '';
      const skills = extractSkillsFromText(`${item.position} ${tags} ${plainDesc}`);

      return {
        id: `remoteok_${item.id}`,
        externalId: String(item.id),
        title: String(item.position || 'Software Engineer'),
        company: String(item.company || 'Remote Partner'),
        location: String(item.location || 'Worldwide Remote'),
        workMode: 'Remote',
        salaryMin: parsedSal.min,
        salaryMax: parsedSal.max,
        salaryCurrency: 'USD',
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'Docker'],
        description: plainDesc.slice(0, 400),
        applyUrl: String(item.apply_url || item.url || 'https://remoteok.com'),
        source: 'RemoteOK Live',
        easyApply: false,
        postedAt: item.date ? new Date(item.date).toISOString() : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchJobicyLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://jobicy.com/api/v2/remote-jobs?count=25&industry=dev', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<Record<string, any>> };
    const list = (Array.isArray(data.jobs) ? data.jobs : []).filter((item) =>
      isTargetEngineeringRole(String(item.jobTitle || ''), String(item.jobExcerpt || ''))
    );

    return list.slice(0, 12).map((item) => {
      const plainDesc = String(item.jobDescription || item.jobExcerpt || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const salMin = typeof item.salaryMin === 'number' && item.salaryMin > 0 ? item.salaryMin : null;
      const salMax = typeof item.salaryMax === 'number' && item.salaryMax > 0 ? item.salaryMax : salMin;
      const skills = extractSkillsFromText(`${item.jobTitle} ${plainDesc}`);

      return {
        id: `jobicy_${item.id}`,
        externalId: String(item.id),
        title: String(item.jobTitle || 'Software Engineer'),
        company: String(item.companyName || 'Global Engineering'),
        location: String(item.jobGeo || 'Anywhere (Remote)'),
        workMode: 'Remote',
        salaryMin: salMin,
        salaryMax: salMax,
        salaryCurrency: String(item.salaryCurrency || 'USD'),
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'React', 'CI/CD'],
        description: plainDesc.slice(0, 400),
        applyUrl: String(item.url || 'https://jobicy.com'),
        source: 'Jobicy Live',
        easyApply: false,
        postedAt: item.pubDate ? new Date(item.pubDate).toISOString() : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchHimalayasLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://himalayas.app/jobs/api?limit=45', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { jobs?: Array<Record<string, any>> };
    const list = (Array.isArray(data.jobs) ? data.jobs : []).filter((item) =>
      isTargetEngineeringRole(
        String(item.title || ''),
        Array.isArray(item.categories) ? item.categories.join(' ') : ''
      )
    );

    return list.slice(0, 12).map((item, idx) => {
      const plainDesc = String(item.description || item.excerpt || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const salMin = typeof item.minSalary === 'number' && item.minSalary > 0 ? item.minSalary : null;
      const salMax = typeof item.maxSalary === 'number' && item.maxSalary > 0 ? item.maxSalary : salMin;
      const skills = extractSkillsFromText(
        `${item.title} ${plainDesc} ${(item.categories || []).join(' ')}`
      );
      const locList = Array.isArray(item.locationRestrictions) && item.locationRestrictions.length > 0
        ? item.locationRestrictions.join(', ')
        : 'Global Remote';

      return {
        id: `himalayas_${idx}_${Buffer.from(String(item.guid || item.title)).toString('base64').slice(0, 10)}`,
        externalId: String(item.guid || idx),
        title: String(item.title || 'Software Engineer'),
        company: String(item.companyName || 'Remote Tech'),
        location: locList,
        workMode: 'Remote',
        salaryMin: salMin,
        salaryMax: salMax,
        salaryCurrency: String(item.currency || 'USD'),
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'Node.js'],
        description: plainDesc.slice(0, 400),
        applyUrl: String(item.applicationLink || item.guid || 'https://himalayas.app'),
        source: 'Himalayas Live',
        easyApply: false,
        postedAt:
          typeof item.pubDate === 'number'
            ? new Date(item.pubDate * 1000).toISOString()
            : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchArbeitnowLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch('https://www.arbeitnow.com/api/job-board-api', {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    clearTimeout(timer);
    if (!res.ok) return [];
    const data = (await res.json()) as { data?: Array<Record<string, any>> };
    const list = (Array.isArray(data.data) ? data.data : []).filter((item) =>
      isTargetEngineeringRole(
        String(item.title || ''),
        Array.isArray(item.tags) ? item.tags.join(' ') : ''
      )
    );

    return list.slice(0, 12).map((item) => {
      const plainDesc = String(item.description || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const sal = parseSalaryFromText(plainDesc);
      const skills = extractSkillsFromText(`${item.title} ${plainDesc}`);
      return {
        id: `arbeitnow_${item.slug}`,
        externalId: String(item.slug),
        title: String(item.title || 'Software Engineer'),
        company: String(item.company_name || 'Tech Company'),
        location: String(item.location || (item.remote ? 'Remote' : 'Europe')),
        workMode: item.remote ? 'Remote' : 'Hybrid',
        salaryMin: sal.min,
        salaryMax: sal.max,
        salaryCurrency: sal.currency || 'USD',
        requiredSkills: skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'Docker', 'Linux'],
        description: plainDesc.slice(0, 400),
        applyUrl: String(item.url || 'https://www.arbeitnow.com'),
        source: 'Arbeitnow Live',
        easyApply: false,
        postedAt:
          typeof item.created_at === 'number'
            ? new Date(item.created_at * 1000).toISOString()
            : nowIso,
        syncedAt: nowIso,
      };
    });
  } catch {
    return [];
  }
}

async function fetchWeWorkRemotelyLiveJobs(nowIso: string): Promise<JobListing[]> {
  try {
    const feeds = [
      'https://weworkremotely.com/categories/remote-programming-jobs.rss',
      'https://weworkremotely.com/categories/remote-devops-sysadmin-jobs.rss',
    ];
    const results = await Promise.all(
      feeds.map(async (feedUrl) => {
        try {
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), 5000);
          const res = await fetch(feedUrl, {
            signal: controller.signal,
            headers: { 'User-Agent': 'Mozilla/5.0' },
          });
          clearTimeout(timer);
          if (!res.ok) return [];
          const xml = await res.text();
          const items = xml.split('<item>').slice(1, 8);
          const parsed: JobListing[] = [];

          for (const rawItem of items) {
            const titleRaw =
              rawItem.match(/<title>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/)?.[1]?.trim() ||
              '';
            const link = rawItem.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || '';
            const pubDate = rawItem.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || '';
            const region =
              rawItem.match(/<region>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/region>/)?.[1]?.trim() ||
              'Anywhere (Remote)';
            const descRaw =
              rawItem.match(
                /<description>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/description>/
              )?.[1] || '';

            const plainDesc = descRaw
              .replace(/<[^>]+>/g, ' ')
              .replace(/&[a-z#0-9]+;/gi, ' ')
              .replace(/\s+/g, ' ')
              .trim();

            if (!titleRaw || !link) continue;
            const colonIdx = titleRaw.indexOf(':');
            const company = colonIdx > 0 ? titleRaw.slice(0, colonIdx).trim() : 'WWR Partner';
            const title = colonIdx > 0 ? titleRaw.slice(colonIdx + 1).trim() : titleRaw;
            const sal = parseSalaryFromText(`${title} ${plainDesc}`);
            const skills = extractSkillsFromText(`${title} ${plainDesc}`);
            const slugId = link.split('/').filter(Boolean).pop() || `${Date.now()}_${parsed.length}`;

            parsed.push({
              id: `wwr_${slugId.slice(0, 48)}`,
              externalId: slugId,
              title,
              company,
              location: region || 'Remote',
              workMode: 'Remote',
              salaryMin: sal.min,
              salaryMax: sal.max,
              salaryCurrency: sal.currency || 'USD',
              requiredSkills:
                skills.length > 0 ? skills.slice(0, 8) : ['TypeScript', 'Linux', 'CI/CD'],
              description: plainDesc.slice(0, 400),
              applyUrl: link,
              source: 'WeWorkRemotely Live',
              easyApply: false,
              postedAt: pubDate ? new Date(pubDate).toISOString() : nowIso,
              syncedAt: nowIso,
            });
          }
          return parsed;
        } catch {
          return [];
        }
      })
    );
    return results.flat().slice(0, 12);
  } catch {
    return [];
  }
}

export function createApiApp(): express.Express {
  const app = express();
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 },
  });

  app.use(express.json({ limit: '4mb' }));

  app.get('/api/bootstrap', (_req, res) => {
    const store = loadStore();
    res.json({
      profile: store.profile,
      jobs: buildEvaluatedJobs(store),
      applications: store.applications,
      notifications: store.notifications,
      syncMeta: store.syncMeta,
    });
  });

  app.put('/api/profile', (req, res) => {
    const store = loadStore();
    const patch = req.body as Partial<CandidateProfile>;

    store.profile = {
      ...store.profile,
      ...patch,
      skills: Array.isArray(patch.skills)
        ? Array.from(new Set(patch.skills.map((s) => s.trim()).filter(Boolean)))
        : store.profile.skills,
      mustHaveSkills: Array.isArray(patch.mustHaveSkills)
        ? Array.from(new Set(patch.mustHaveSkills.map((s) => s.trim()).filter(Boolean)))
        : store.profile.mustHaveSkills,
      minSalary:
        typeof patch.minSalary === 'number'
          ? Math.max(0, patch.minSalary)
          : store.profile.minSalary,
      maxSalary:
        patch.maxSalary === null
          ? null
          : typeof patch.maxSalary === 'number'
            ? Math.max(patch.minSalary ?? store.profile.minSalary, patch.maxSalary)
            : store.profile.maxSalary,
      minSkillMatchPct:
        typeof patch.minSkillMatchPct === 'number'
          ? Math.min(100, Math.max(0, patch.minSkillMatchPct))
          : store.profile.minSkillMatchPct,
      maxAutoApplyPerBatch:
        typeof patch.maxAutoApplyPerBatch === 'number'
          ? Math.min(25, Math.max(1, patch.maxAutoApplyPerBatch))
          : store.profile.maxAutoApplyPerBatch,
    };

    saveStore(store);
    res.json({
      profile: store.profile,
      jobs: buildEvaluatedJobs(store),
    });
  });

  app.post('/api/resume/upload', upload.single('resume'), (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ error: 'কোনো রিজিউমি ফাইল পাওয়া যায়নি।' });
        return;
      }

      const store = loadStore();
      const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
      const diskName = `${Date.now()}_${safeName}`;
      memoryResumes.set(diskName, {
        buffer: file.buffer,
        mimeType: file.mimetype || 'application/octet-stream',
      });

      try {
        fs.mkdirSync(RESUMES_DIR, { recursive: true });
        fs.writeFileSync(path.join(RESUMES_DIR, diskName), file.buffer);
      } catch (err) {
        console.error('রিজিউমি ফাইল ডিস্কে লেখা যায়নি, মেমোরিতে সংরক্ষিত:', err);
      }

      const extractedText = extractResumeText(
        file.buffer,
        file.originalname,
        file.mimetype
      );
      const extractedSkills = extractSkillsFromText(extractedText);

      const resumeInfo: ResumeInfo = {
        id: `res_${Date.now()}`,
        filename: file.originalname,
        mimeType: file.mimetype || 'application/octet-stream',
        sizeBytes: file.size,
        uploadedAt: new Date().toISOString(),
        extractedText: extractedText.slice(0, 6000),
        extractedSkills,
        fileUrl: `/api/resumes/${encodeURIComponent(diskName)}`,
      };

      store.profile.activeResume = resumeInfo;

      if (req.body?.mergeSkills === 'true' && extractedSkills.length > 0) {
        const merged = new Set([...store.profile.skills, ...extractedSkills]);
        store.profile.skills = Array.from(merged);
      }

      saveStore(store);
      res.json({
        resume: resumeInfo,
        profile: store.profile,
        jobs: buildEvaluatedJobs(store),
      });
    } catch (err: any) {
      res.status(500).json({
        error: err?.message || 'আপলোড করা রিজিউমি বিশ্লেষণ করতে ব্যর্থ হয়েছে।',
      });
    }
  });

  app.get('/api/resumes/:filename', (req, res) => {
    const safeFile = path.basename(req.params.filename);
    const fullPath = path.join(RESUMES_DIR, safeFile);
    if (fs.existsSync(fullPath)) {
      res.sendFile(fullPath);
      return;
    }
    const cached = memoryResumes.get(safeFile);
    if (cached) {
      res.type(cached.mimeType).send(cached.buffer);
      return;
    }
    res.status(404).send('রিজিউমি ফাইল পাওয়া যায়নি।');
  });

  app.post('/api/jobs/sync', async (req, res) => {
    const store = loadStore();
    const keywords = String(
      req.body?.query ??
        store.profile.targetQuery ??
        'Frontend, Backend, Enterprise Application, System, DevOps, IT Operations, Application Support, SOC Analyst'
    );
    const location = String(
      req.body?.location ?? store.profile.targetLocation ?? 'Dhaka, Bangladesh'
    );
    const requestedSources: JobSource[] =
      Array.isArray(req.body?.sources) && req.body.sources.length > 0
        ? req.body.sources
        : store.profile.enabledSources?.length
          ? store.profile.enabledSources
          : DEFAULT_ENABLED_SOURCES;
    const enabledSet = new Set<JobSource>(requestedSources);
    const nowIso = new Date().toISOString();

    const roleTerms = keywords
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, 8);

    const [
      linkedInBatches,
      bdjobsLive,
      remotiveLive,
      remoteOkLive,
      jobicyLive,
      himalayasLive,
      arbeitnowLive,
      wwrLive,
    ] = await Promise.all([
      enabledSet.has('LinkedIn Feed')
        ? Promise.all(
            (roleTerms.length > 0 ? roleTerms : ['Software Engineer']).map((term) =>
              fetchLinkedInGuestJobs(term, location, nowIso)
            )
          )
        : Promise.resolve([]),
      enabledSet.has('Bdjobs Live') ? fetchBdjobsLiveJobs(nowIso) : Promise.resolve([]),
      enabledSet.has('Remotive Live')
        ? fetchRemotiveLiveJobs(roleTerms[0] || keywords, nowIso)
        : Promise.resolve([]),
      enabledSet.has('RemoteOK Live') ? fetchRemoteOkLiveJobs(nowIso) : Promise.resolve([]),
      enabledSet.has('Jobicy Live') ? fetchJobicyLiveJobs(nowIso) : Promise.resolve([]),
      enabledSet.has('Himalayas Live') ? fetchHimalayasLiveJobs(nowIso) : Promise.resolve([]),
      enabledSet.has('Arbeitnow Live') ? fetchArbeitnowLiveJobs(nowIso) : Promise.resolve([]),
      enabledSet.has('WeWorkRemotely Live')
        ? fetchWeWorkRemotelyLiveJobs(nowIso)
        : Promise.resolve([]),
    ]);

    const linkedInLive = linkedInBatches.flat();
    const seedJobs = buildLinkedInSeedJobs(nowIso).filter((j) => enabledSet.has(j.source));
    const importedJobs = store.jobs.filter((j) => j.source === 'Imported URL');

    const mergedMap = new Map<string, JobListing>();
    for (const j of seedJobs) mergedMap.set(j.id, j);
    for (const j of bdjobsLive) mergedMap.set(j.id, j);
    for (const j of remotiveLive) mergedMap.set(j.id, j);
    for (const j of remoteOkLive) mergedMap.set(j.id, j);
    for (const j of jobicyLive) mergedMap.set(j.id, j);
    for (const j of himalayasLive) mergedMap.set(j.id, j);
    for (const j of arbeitnowLive) mergedMap.set(j.id, j);
    for (const j of wwrLive) mergedMap.set(j.id, j);
    for (const j of linkedInLive) mergedMap.set(j.id, j);
    for (const j of importedJobs) mergedMap.set(j.id, j);

    const mergedJobs = Array.from(mergedMap.values()).sort(
      (a, b) => new Date(b.postedAt).getTime() - new Date(a.postedAt).getTime()
    );

    const liveCounts: Record<string, number> = {};
    for (const j of mergedJobs) {
      liveCounts[j.source] = (liveCounts[j.source] || 0) + 1;
    }

    store.profile.enabledSources = requestedSources;
    store.jobs = mergedJobs;
    store.syncMeta = {
      lastSyncedAt: nowIso,
      liveSourcesQueried: requestedSources,
      liveCounts,
      totalJobs: mergedJobs.length,
    };

    saveStore(store);
    res.json({
      jobs: buildEvaluatedJobs(store),
      syncMeta: store.syncMeta,
      profile: store.profile,
    });
  });

  app.post('/api/jobs/import', async (req, res) => {
    const store = loadStore();
    const {
      applyUrl,
      title,
      company,
      location,
      workMode,
      salaryMin,
      salaryMax,
      skillsText,
      description,
    } = req.body as Record<string, any>;

    if (!applyUrl || !title || !company) {
      res.status(400).json({ error: 'চাকরির লিংক, পদের নাম এবং প্রতিষ্ঠান আবশ্যক।' });
      return;
    }

    const nowIso = new Date().toISOString();
    const parsedFromDesc = extractSkillsFromText(
      `${title} ${description || ''} ${skillsText || ''}`
    );
    const manualSkills = String(skillsText || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const requiredSkills = Array.from(new Set([...manualSkills, ...parsedFromDesc]));

    const newJob: JobListing = {
      id: `imported_${Date.now()}`,
      externalId: String(Date.now()),
      title: String(title).trim(),
      company: String(company).trim(),
      location: String(location || 'Dhaka, Bangladesh').trim(),
      workMode:
        workMode === 'Remote' || workMode === 'Hybrid' || workMode === 'On-site'
          ? workMode
          : 'Hybrid',
      salaryMin: salaryMin ? Number(salaryMin) : null,
      salaryMax: salaryMax ? Number(salaryMax) : null,
      salaryCurrency: store.profile.salaryCurrency || 'BDT',
      requiredSkills: requiredSkills.length > 0 ? requiredSkills : ['TypeScript'],
      description: String(
        description || `আমদানিকৃত চাকরির পদ: ${company}-এ ${title}`
      ).trim(),
      applyUrl: String(applyUrl).trim(),
      source: 'Imported URL',
      easyApply: true,
      postedAt: nowIso,
      syncedAt: nowIso,
    };

    store.jobs = [newJob, ...store.jobs];
    store.syncMeta.totalJobs = store.jobs.length;
    saveStore(store);

    res.json({
      jobs: buildEvaluatedJobs(store),
      syncMeta: store.syncMeta,
    });
  });

  app.post('/api/applications/apply', (req, res) => {
    const store = loadStore();
    const { jobId, method } = req.body as {
      jobId: string;
      method?: 'Auto-Applied' | 'Manual';
    };

    if (!store.profile.activeResume) {
      res.status(400).json({ error: 'আবেদন জমা দেওয়ার আগে অনুগ্রহ করে একটি রিজিউমি আপলোড করুন।' });
      return;
    }

    const job = store.jobs.find((j) => j.id === jobId);
    if (!job) {
      res.status(404).json({ error: 'চাকরিটি খুঁজে পাওয়া যায়নি।' });
      return;
    }

    const existing = store.applications.find((a) => a.jobId === jobId);
    if (existing) {
      res.status(409).json({ error: 'এই চাকরিতে ইতিমধ্যেই আবেদন করা হয়েছে।' });
      return;
    }

    const evalResult = evaluateJob(job, store.profile);
    const now = new Date();
    const nowIso = now.toISOString();
    const submissionMethod = method || 'Manual';
    const methodLabel =
      submissionMethod === 'Auto-Applied' ? 'স্বয়ংক্রিয় আবেদন' : 'ম্যানুয়াল আবেদন';

    const newApp: ApplicationRecord = {
      id: `app_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      jobId: job.id,
      jobTitle: job.title,
      company: job.company,
      location: job.location,
      workMode: job.workMode,
      salaryMin: job.salaryMin,
      salaryMax: job.salaryMax,
      salaryCurrency: job.salaryCurrency,
      applyUrl: job.applyUrl,
      source: job.source,
      status: 'Applied',
      appliedAt: nowIso,
      updatedAt: nowIso,
      submissionMethod,
      resumeFilename: store.profile.activeResume.filename,
      matchedSkills: evalResult.matchedSkills,
      skillMatchPct: evalResult.skillMatchPct,
      tailoredCoverNote: renderCoverNote(
        store.profile.coverNoteTemplate,
        job,
        evalResult.matchedSkills,
        store.profile
      ),
      nextFollowUpAt: addBusinessDaysIso(now, 5),
      followUpCompleted: false,
      recruiterName: '',
      recruiterEmail: '',
      notes: `${store.profile.activeResume.filename} সংযুক্ত করে ${methodLabel} সম্পন্ন। ৫ কর্মদিবস পর ফলো-আপ নির্ধারিত।`,
      timeline: [
        {
          id: `evt_${Date.now()}`,
          timestamp: nowIso,
          type: 'APPLIED',
          title: `রিজিউমিসহ ${methodLabel}`,
          detail: `${store.profile.activeResume.filename} সংযুক্ত করা হয়েছে (${evalResult.skillMatchPct}% দক্ষতা মিল)।`,
        },
      ],
    };

    store.applications = [newApp, ...store.applications];
    saveStore(store);

    res.json({
      created: [newApp],
      applications: store.applications,
      jobs: buildEvaluatedJobs(store),
    });
  });

  app.post('/api/applications/auto-apply', (req, res) => {
    const store = loadStore();
    if (!store.profile.activeResume) {
      res
        .status(400)
        .json({ error: 'অটো-আবেদন চালু করতে প্রথমে একটি রিজিউমি আপলোড করুন।' });
      return;
    }

    const requestedIds: string[] | undefined = Array.isArray(req.body?.jobIds)
      ? req.body.jobIds
      : undefined;

    const alreadyAppliedIds = new Set(store.applications.map((a) => a.jobId));
    const candidates = store.jobs.filter((job) => {
      if (alreadyAppliedIds.has(job.id)) return false;
      if (requestedIds && !requestedIds.includes(job.id)) return false;
      const evalRes = evaluateJob(job, store.profile);
      return evalRes.qualifiesForAutoApply;
    });

    const batchLimit = store.profile.maxAutoApplyPerBatch || 5;
    const toSubmit = candidates.slice(0, batchLimit);
    const now = new Date();
    const created: ApplicationRecord[] = [];

    for (let i = 0; i < toSubmit.length; i++) {
      const job = toSubmit[i];
      const evalRes = evaluateJob(job, store.profile);
      const stamp = new Date(now.getTime() + i).toISOString();

      const appRecord: ApplicationRecord = {
        id: `app_${Date.now()}_${i}`,
        jobId: job.id,
        jobTitle: job.title,
        company: job.company,
        location: job.location,
        workMode: job.workMode,
        salaryMin: job.salaryMin,
        salaryMax: job.salaryMax,
        salaryCurrency: job.salaryCurrency,
        applyUrl: job.applyUrl,
        source: job.source,
        status: 'Applied',
        appliedAt: stamp,
        updatedAt: stamp,
        submissionMethod: 'Auto-Applied',
        resumeFilename: store.profile.activeResume.filename,
        matchedSkills: evalRes.matchedSkills,
        skillMatchPct: evalRes.skillMatchPct,
        tailoredCoverNote: renderCoverNote(
          store.profile.coverNoteTemplate,
          job,
          evalRes.matchedSkills,
          store.profile
        ),
        nextFollowUpAt: addBusinessDaysIso(now, 5),
        followUpCompleted: false,
        recruiterName: '',
        recruiterEmail: '',
        notes: `${evalRes.skillMatchPct}% দক্ষতা মিল থাকায় ${store.profile.activeResume.filename} দিয়ে স্বয়ংক্রিয় আবেদন জমা হয়েছে।`,
        timeline: [
          {
            id: `evt_${Date.now()}_${i}`,
            timestamp: stamp,
            type: 'APPLIED',
            title: 'আপলোডকৃত রিজিউমিসহ স্বয়ংক্রিয় আবেদন',
            detail: `দক্ষতা (${evalRes.skillMatchPct}%) ও বেতনের শর্ত উত্তীর্ণ। ${store.profile.activeResume.filename} সংযুক্ত।`,
          },
        ],
      };

      created.push(appRecord);
    }

    if (created.length > 0) {
      store.applications = [...created, ...store.applications];
      saveStore(store);
    }

    res.json({
      created,
      remainingQualified: Math.max(0, candidates.length - created.length),
      applications: store.applications,
      jobs: buildEvaluatedJobs(store),
    });
  });

  app.patch('/api/applications/:id', (req, res) => {
    const store = loadStore();
    const { id } = req.params;
    const idx = store.applications.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });
      return;
    }

    const current = store.applications[idx];
    const patch = req.body as Partial<ApplicationRecord>;
    const nowIso = new Date().toISOString();
    const newTimeline = [...current.timeline];
    const previousStatus = current.status;

    if (patch.status && patch.status !== current.status) {
      newTimeline.unshift({
        id: `evt_${Date.now()}`,
        timestamp: nowIso,
        type: 'STATUS_CHANGED',
        title: `অবস্থা পরিবর্তন: ${STATUS_BN[current.status]} → ${STATUS_BN[patch.status]}`,
        detail:
          patch.notes && patch.notes !== current.notes
            ? patch.notes
            : 'কেন্দ্রীয় ট্র্যাকার থেকে হালনাগাদ করা হয়েছে।',
      });
    } else if (patch.followUpCompleted && !current.followUpCompleted) {
      newTimeline.unshift({
        id: `evt_${Date.now()}`,
        timestamp: nowIso,
        type: 'FOLLOW_UP',
        title: 'ফলো-আপ সম্পন্ন হয়েছে',
        detail: patch.notes || 'ফলো-আপ কার্যক্রম নথিভুক্ত হয়েছে।',
      });
    }

    const updated: ApplicationRecord = {
      ...current,
      ...patch,
      updatedAt: nowIso,
      timeline: newTimeline,
    };

    store.applications[idx] = updated;
    saveStore(store);

    res.json({
      application: updated,
      previousStatus,
      applications: store.applications,
      jobs: buildEvaluatedJobs(store),
    });
  });

  app.post('/api/applications/:id/followup', (req, res) => {
    const store = loadStore();
    const { id } = req.params;
    const idx = store.applications.findIndex((a) => a.id === id);
    if (idx === -1) {
      res.status(404).json({ error: 'আবেদনটি পাওয়া যায়নি।' });
      return;
    }

    const { note, nextFollowUpDays } = req.body as {
      note?: string;
      nextFollowUpDays?: number;
    };
    const current = store.applications[idx];
    const now = new Date();
    const nowIso = now.toISOString();

    const nextDate =
      typeof nextFollowUpDays === 'number' && nextFollowUpDays > 0
        ? addBusinessDaysIso(now, nextFollowUpDays)
        : null;

    const updated: ApplicationRecord = {
      ...current,
      updatedAt: nowIso,
      followUpCompleted: nextDate === null,
      nextFollowUpAt: nextDate,
      notes: note ? note : current.notes,
      timeline: [
        {
          id: `evt_${Date.now()}`,
          timestamp: nowIso,
          type: 'FOLLOW_UP',
          title: 'ফলো-আপ সংরক্ষিত হয়েছে',
          detail: note || 'ফলো-আপ যোগাযোগ সম্পন্ন করে ট্র্যাকার হালনাগাদ করা হয়েছে।',
        },
        ...current.timeline,
      ],
    };

    store.applications[idx] = updated;
    saveStore(store);

    res.json({
      application: updated,
      applications: store.applications,
    });
  });

  app.delete('/api/applications/:id', (req, res) => {
    const store = loadStore();
    store.applications = store.applications.filter((a) => a.id !== req.params.id);
    saveStore(store);
    res.json({
      applications: store.applications,
      jobs: buildEvaluatedJobs(store),
    });
  });

  app.post('/api/notifications', (req, res) => {
    const store = loadStore();
    const record = req.body as Omit<NotificationRecord, 'id' | 'createdAt'>;
    const entry: NotificationRecord = {
      id: `notif_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
      createdAt: new Date().toISOString(),
      ...record,
    };

    store.notifications = [entry, ...store.notifications].slice(0, 100);

    if (entry.applicationId && entry.deliveryStatus === 'Sent via Gmail') {
      const appIdx = store.applications.findIndex((a) => a.id === entry.applicationId);
      if (appIdx !== -1) {
        store.applications[appIdx].timeline.unshift({
          id: `evt_${Date.now()}`,
          timestamp: entry.createdAt,
          type: 'EMAIL_SENT',
          title: 'ইমেইল বিজ্ঞপ্তি পাঠানো হয়েছে',
          detail: `${entry.recipient} ঠিকানায় পাঠানো হয়েছে`,
        });
      }
    }

    saveStore(store);
    res.json({
      notifications: store.notifications,
      applications: store.applications,
    });
  });

  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('API Error:', err);
    res.status(err?.status || 500).json({
      error: err?.message || 'সার্ভারে একটি অপ্রত্যাশিত ত্রুটি ঘটেছে।',
    });
  });

  return app;
}

const app = createApiApp();

export default app;
