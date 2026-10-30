import { describe, expect, it } from 'vitest'
import { applicationSchema, emptyApplication } from './types'

describe('application validation', () => {
  it('accepts a complete application and trims required names', () => {
    const application = emptyApplication()
    const result = applicationSchema.parse({ ...application, company: '  Acme  ', role: '  Frontend Engineer  ' })

    expect(result.company).toBe('Acme')
    expect(result.role).toBe('Frontend Engineer')
    expect(result.status).toBe('Saved')
  })

  it('rejects records without required company or role values', () => {
    const application = emptyApplication()

    expect(() => applicationSchema.parse({ ...application, company: ' ' })).toThrow()
    expect(() => applicationSchema.parse({ ...application, role: '' })).toThrow()
  })
})
