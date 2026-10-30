import Dexie, { type Table } from 'dexie'
import type { Activity, PlacementApplication, ResumeDocument, StoredFile } from './types'

class PlacementDatabase extends Dexie {
  applications!: Table<PlacementApplication, string>
  resumes!: Table<ResumeDocument, string>
  activities!: Table<Activity, string>
  files!: Table<StoredFile, string>

  constructor() {
    super('placement-tracker-pro')
    this.version(1).stores({
      applications: 'id, status, company, appliedDate, deadline, updatedAt',
      resumes: 'id, name, uploadedAt',
      activities: 'id, applicationId, createdAt',
      files: 'id',
    })
  }
}

export const db = new PlacementDatabase()
