import { create } from 'zustand'
import { db } from './db'
import { applicationSchema, resumeSchema, type Activity, type AppPreferences, type PlacementApplication, type ResumeDocument } from './types'

interface TrackerState {
  applications: PlacementApplication[]
  resumes: ResumeDocument[]
  activities: Activity[]
  preferences: AppPreferences
  ready: boolean
  initialize: () => Promise<void>
  saveApplication: (application: PlacementApplication) => Promise<void>
  deleteApplication: (id: string) => Promise<void>
  moveApplication: (id: string, status: PlacementApplication['status']) => Promise<void>
  saveResume: (resume: ResumeDocument, blob: Blob) => Promise<void>
  deleteResume: (id: string) => Promise<void>
  setPreferences: (preferences: AppPreferences) => void
}

const initialPreferences: AppPreferences = { name: 'Alex Morgan', target: 'Product & Engineering', compact: false }
const readPreferences = (): AppPreferences => {
  try {
    const stored = localStorage.getItem('placement-preferences')
    return stored ? { ...initialPreferences, ...JSON.parse(stored) as Partial<AppPreferences> } : initialPreferences
  } catch {
    return initialPreferences
  }
}

export const useTracker = create<TrackerState>((set, get) => ({
  applications: [],
  resumes: [],
  activities: [],
  preferences: readPreferences(),
  ready: false,

  initialize: async () => {
    const [applications, resumes, activities] = await Promise.all([
      db.applications.toArray(),
      db.resumes.toArray(),
      db.activities.orderBy('createdAt').reverse().toArray(),
    ])
    set({ applications, resumes, activities, ready: true })
  },

  saveApplication: async (input) => {
    const application = applicationSchema.parse({ ...input, updatedAt: new Date().toISOString() })
    const previous = get().applications.find((item) => item.id === application.id)
    const statusChanged = previous !== undefined && previous.status !== application.status
    const activity: Activity = {
      id: crypto.randomUUID(),
      applicationId: application.id,
      description: previous
        ? !statusChanged
          ? `Updated ${application.company} application`
          : `${application.company} moved from ${previous.status} to ${application.status}`
        : `Added ${application.company} application`,
      createdAt: new Date().toISOString(),
      fromStatus: statusChanged ? previous.status : undefined,
      toStatus: statusChanged ? application.status : undefined,
    }
    await db.transaction('rw', db.applications, db.activities, async () => {
      await db.applications.put(application)
      await db.activities.add(activity)
    })
    set((state) => ({
      applications: previous
        ? state.applications.map((item) => item.id === application.id ? application : item)
        : [application, ...state.applications],
      activities: [activity, ...state.activities],
    }))
  },

  deleteApplication: async (id) => {
    await db.transaction('rw', db.applications, db.activities, async () => {
      await db.applications.delete(id)
      await db.activities.where('applicationId').equals(id).delete()
    })
    set((state) => ({
      applications: state.applications.filter((application) => application.id !== id),
      activities: state.activities.filter((activity) => activity.applicationId !== id),
    }))
  },

  moveApplication: async (id, status) => {
    const application = get().applications.find((item) => item.id === id)
    if (!application) throw new Error('Application could not be found.')
    if (application.status === status) return
    const updated = applicationSchema.parse({ ...application, status, updatedAt: new Date().toISOString() })
    const activity: Activity = {
      id: crypto.randomUUID(),
      applicationId: id,
      description: `${application.company} moved from ${application.status} to ${status}`,
      createdAt: new Date().toISOString(),
      fromStatus: application.status,
      toStatus: status,
    }
    set((state) => ({
      applications: state.applications.map((item) => item.id === id ? updated : item),
      activities: [activity, ...state.activities],
    }))
    try {
      await db.transaction('rw', db.applications, db.activities, async () => {
        await db.applications.put(updated)
        await db.activities.add(activity)
      })
    } catch (error) {
      set((state) => ({
        applications: state.applications.map((item) => item.id === id ? application : item),
        activities: state.activities.filter((item) => item.id !== activity.id),
      }))
      throw error
    }
  },

  saveResume: async (resume, blob) => {
    const validatedResume = resumeSchema.parse(resume)
    await db.transaction('rw', db.resumes, db.files, async () => {
      await db.resumes.put(validatedResume)
      await db.files.put({ id: validatedResume.id, blob })
    })
    set((state) => ({ resumes: [validatedResume, ...state.resumes.filter((item) => item.id !== validatedResume.id)] }))
  },

  deleteResume: async (id) => {
    const linkedApplications = await db.applications.where('linkedResumeId').equals(id).toArray()
    const unlinkedApplications = linkedApplications.map((app) => ({
      ...app,
      linkedResumeId: undefined,
      linkedResumeName: undefined,
      linkedResumeText: undefined,
      updatedAt: new Date().toISOString(),
    }))
    await db.transaction('rw', db.applications, db.resumes, db.files, async () => {
      await db.applications.bulkPut(unlinkedApplications)
      await db.resumes.delete(id)
      await db.files.delete(id)
    })
    set((state) => ({
      resumes: state.resumes.filter((resume) => resume.id !== id),
      applications: state.applications.map((app) => unlinkedApplications.find((unlinked) => unlinked.id === app.id) ?? app),
    }))
  },

  setPreferences: (preferences) => {
    localStorage.setItem('placement-preferences', JSON.stringify(preferences))
    set({ preferences })
  },
}))
