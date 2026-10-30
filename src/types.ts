import { z } from 'zod'

export const applicationStatuses = [
  'Saved',
  'Applied',
  'OA Scheduled',
  'Interviewing',
  'Offer Received',
  'Rejected',
  'Withdrawn',
] as const

export type ApplicationStatus = (typeof applicationStatuses)[number]

export const roundSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  date: z.string().optional(),
  notes: z.string().default(''),
  passed: z.boolean().optional(),
  completed: z.boolean().default(false),
})

export const applicationSchema = z.object({
  id: z.string().uuid(),
  company: z.string().trim().min(1, 'Company is required'),
  role: z.string().trim().min(1, 'Role is required'),
  ctc: z.string().default(''),
  location: z.string().default(''),
  status: z.enum(applicationStatuses),
  appliedDate: z.string().optional(),
  deadline: z.string().optional(),
  jobDescription: z.string().default(''),
  linkedResumeId: z.string().optional(),
  linkedResumeName: z.string().optional(),
  linkedResumeText: z.string().optional(),
  rounds: z.array(roundSchema).default([]),
  customNotes: z.string().default(''),
  rejectionReason: z.string().optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export type PlacementApplication = z.infer<typeof applicationSchema>

export const resumeSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  fileType: z.enum(['pdf', 'docx']),
  extractedText: z.string(),
  uploadedAt: z.string(),
  fileSize: z.number(),
  skills: z.array(z.string()),
  keywords: z.array(z.string()),
})

export type ResumeDocument = z.infer<typeof resumeSchema>

export interface Activity {
  id: string
  applicationId: string
  description: string
  createdAt: string
  fromStatus?: ApplicationStatus
  toStatus?: ApplicationStatus
}

export interface StoredFile {
  id: string
  blob: Blob
}

export interface AppPreferences {
  name: string
  target: string
  compact: boolean
}

export const emptyApplication = (): PlacementApplication => {
  const now = new Date().toISOString()
  return {
    id: crypto.randomUUID(),
    company: '',
    role: '',
    ctc: '',
    location: '',
    status: 'Saved',
    appliedDate: '',
    deadline: '',
    jobDescription: '',
    rounds: [],
    customNotes: '',
    createdAt: now,
    updatedAt: now,
  }
}
