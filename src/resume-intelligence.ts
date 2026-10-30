const skillDictionary = [
  'JavaScript', 'TypeScript', 'React', 'Next.js', 'Node.js', 'Python', 'Java', 'C++', 'C#', 'Go', 'SQL',
  'PostgreSQL', 'MongoDB', 'AWS', 'Azure', 'Docker', 'Kubernetes', 'GraphQL', 'REST APIs', 'HTML', 'CSS',
  'Tailwind CSS', 'Figma', 'Git', 'Agile', 'Machine Learning', 'Data Analysis', 'Redux', 'Vue', 'Angular',
  'Express', 'Django', 'Spring', 'Firebase', 'Vite', 'Accessibility',
]

const aliases: Record<string, string[]> = {
  JavaScript: ['javascript', 'js', 'ecmascript'],
  TypeScript: ['typescript', 'ts'],
  'Node.js': ['node.js', 'nodejs'],
  'Next.js': ['next.js', 'nextjs'],
  'C++': ['c++', 'cpp'],
  'C#': ['c#', 'c sharp'],
  'REST APIs': ['rest api', 'rest apis', 'restful'],
  PostgreSQL: ['postgresql', 'postgres'],
  'Machine Learning': ['machine learning', 'ml'],
  Accessibility: ['accessibility', 'a11y'],
}

export function extractSkills(text: string) {
  const normalized = text.toLowerCase()
  return skillDictionary.filter((skill) => (aliases[skill] ?? [skill.toLowerCase()]).some((alias) =>
    new RegExp(`(^|[^a-z0-9])${escapeRegExp(alias)}([^a-z0-9]|$)`, 'i').test(normalized)))
}

export function extractKeywords(text: string) {
  return Array.from(new Set(text.toLowerCase().match(/\b[a-z][a-z+#.-]{2,}\b/g) ?? [])).slice(0, 100)
}

export function matchResume(resumeText: string, jobText: string) {
  const resumeSkills = extractSkills(resumeText)
  const jobSkills = extractSkills(jobText)
  const matched = jobSkills.filter((skill) => resumeSkills.includes(skill))
  const missing = jobSkills.filter((skill) => !resumeSkills.includes(skill))
  return { matched, missing, percent: jobSkills.length ? Math.round(matched.length / jobSkills.length * 100) : 0 }
}

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
