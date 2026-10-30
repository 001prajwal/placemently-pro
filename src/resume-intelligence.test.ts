import { describe, expect, it } from 'vitest'
import { extractSkills, matchResume } from './resume-intelligence'

describe('resume keyword matching', () => {
  it('normalizes aliases and reports matched and missing skills', () => {
    const result = matchResume('Built apps with JS, React, and Node.js.', 'React, JavaScript, TypeScript, PostgreSQL, Node.js')

    expect(result.matched).toEqual(['JavaScript', 'React', 'Node.js'])
    expect(result.missing).toEqual(['TypeScript', 'PostgreSQL'])
    expect(result.percent).toBe(60)
  })

  it('uses word boundaries rather than matching inside unrelated words', () => {
    expect(extractSkills('Reactive systems and JavaScript')).toEqual(['JavaScript'])
  })

  it('returns zero for job descriptions without recognized skills', () => {
    expect(matchResume('React and TypeScript', 'Excellent communication and curiosity')).toEqual({
      matched: [],
      missing: [],
      percent: 0,
    })
  })
})
