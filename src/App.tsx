import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react'
import { BrowserRouter, Link, NavLink, Outlet, Route, Routes, useLocation, useNavigate, useOutletContext, useSearchParams } from 'react-router-dom'
import { DndContext, KeyboardSensor, PointerSensor, useDroppable, useSensor, useSensors, type DragEndEvent } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { z } from 'zod'
import { endOfWeek, format, isBefore, parseISO, startOfDay, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity, ArrowDownUp, ArrowRight, ArrowUpRight, Bell, BriefcaseBusiness, CalendarDays, Check,
  CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Download, FileText,
  Filter, FolderOpen, Gauge, GripVertical, LayoutDashboard, ListChecks, MapPin, Menu, MoreHorizontal, Plus,
  Search, Settings, Sparkles, Target, Trash2, TrendingUp, Upload, Users, X, Zap,
} from 'lucide-react'
import { toast, Toaster } from 'sonner'
import { db } from './db'
import { extractKeywords, extractSkills, matchResume } from './resume-intelligence'
import { useTracker } from './store'
import { applicationStatuses, emptyApplication, type ApplicationStatus, type PlacementApplication, type ResumeDocument } from './types'
import './App.css'

const APP_NOW = new Date()
const themePreference = (() => {
  try {
    return { darkMode: localStorage.getItem('placement-theme') !== 'light', error: '' }
  } catch (error) {
    return { darkMode: true, error: error instanceof Error ? error.message : 'storage unavailable' }
  }
})()
const ActivityAreaChart = lazy(() => import('./Charts').then((module) => ({ default: module.ActivityAreaChart })))
const MonthlyBarChart = lazy(() => import('./Charts').then((module) => ({ default: module.MonthlyBarChart })))
const PackageBarChart = lazy(() => import('./Charts').then((module) => ({ default: module.PackageBarChart })))
const StatusDonut = lazy(() => import('./Charts').then((module) => ({ default: module.StatusDonut })))
const statusClass: Record<ApplicationStatus, string> = {
  Saved: 'saved',
  Applied: 'applied',
  'OA Scheduled': 'assessment',
  Interviewing: 'interviewing',
  'Offer Received': 'offer',
  Rejected: 'rejected',
  Withdrawn: 'withdrawn',
}
const statusColors: Record<ApplicationStatus, string> = {
  Saved: '#64748b',
  Applied: '#8b8cf8',
  'OA Scheduled': '#38bdf8',
  Interviewing: '#f5ae48',
  'Offer Received': '#43c99a',
  Rejected: '#fb7185',
  Withdrawn: '#94a3b8',
}
const navItems = [
  { to: '/', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/applications', label: 'Applications', icon: BriefcaseBusiness },
  { to: '/pipeline', label: 'Kanban board', icon: ListChecks },
  { to: '/calendar', label: 'Calendar', icon: CalendarDays },
  { to: '/analytics', label: 'Analytics', icon: Gauge },
  { to: '/resumes', label: 'Resume library', icon: FolderOpen },
]

type AppContext = {
  search: string
  setSearch: (value: string) => void
  openForm: (application?: PlacementApplication, status?: ApplicationStatus) => void
  openDetails: (application: PlacementApplication) => void
  applications: PlacementApplication[]
}

function useAppContext() {
  return useOutletContext<AppContext>()
}

function App() {
  const initialize = useTracker((state) => state.initialize)
  const ready = useTracker((state) => state.ready)
  const [search, setSearch] = useState('')
  const [formApplication, setFormApplication] = useState<PlacementApplication | null | undefined>(undefined)
  const [detailApplication, setDetailApplication] = useState<PlacementApplication | null>(null)
  const [mobileMenu, setMobileMenu] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [darkMode, setDarkMode] = useState(themePreference.darkMode)
  const [loadError, setLoadError] = useState('')
  const applications = useTracker((state) => state.applications)
  const saveApplication = useTracker((state) => state.saveApplication)
  const deleteApplication = useTracker((state) => state.deleteApplication)
  const preferences = useTracker((state) => state.preferences)

  useEffect(() => {
    initialize().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'unknown error'
      setLoadError(message)
      toast.error(`Could not load local data: ${message}`)
    })
  }, [initialize])

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light'
    try {
      localStorage.setItem('placement-theme', darkMode ? 'dark' : 'light')
    } catch (error) {
      toast.error(`Could not save theme preference: ${error instanceof Error ? error.message : 'storage unavailable'}`)
    }
  }, [darkMode])

  useEffect(() => {
    if (themePreference.error) toast.error(`Could not read theme preference: ${themePreference.error}`)
  }, [])

  const context: AppContext = {
    search,
    setSearch,
    openForm: (application, status) => setFormApplication(application ?? { ...emptyApplication(), status: status ?? 'Saved' }),
    openDetails: setDetailApplication,
    applications,
  }

  const submitApplication = async (application: PlacementApplication) => {
    try {
      await saveApplication(application)
      setFormApplication(undefined)
      toast.success('Application saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save application')
    }
  }

  const removeApplication = async (id: string) => {
    if (!window.confirm('Delete this application? This cannot be undone.')) return
    try {
      await deleteApplication(id)
      setDetailApplication(null)
      toast.success('Application deleted')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not delete application')
    }
  }

  return (
    <BrowserRouter>
      <Toaster theme={darkMode ? 'dark' : 'light'} position="top-right" richColors />
      <div className={`app-shell ${collapsed ? 'sidebar-collapsed' : ''}`}>
        <aside className={`sidebar ${mobileMenu ? 'mobile-open' : ''}`}>
          <Link className="brand" to="/" aria-label="Placemently home">
            <span className="brand-mark"><Sparkles size={17} strokeWidth={2.2} /></span>
            <span className="brand-name">placement<span>ly</span></span>
            <span className="brand-pro">PRO</span>
          </Link>
          <button className="workspace-switch" type="button" onClick={() => toast.info('You’re viewing your personal workspace')}>
            <span className="workspace-avatar">{preferences.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</span>
            <span className="workspace-copy"><strong>{preferences.name}</strong><small>Personal workspace</small></span>
            <ChevronDown size={15} />
          </button>
          <div className="side-label">WORKSPACE</div>
          <nav className="side-nav" aria-label="Main navigation">
            {navItems.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} onClick={() => setMobileMenu(false)} title={collapsed ? label : undefined}>
                <Icon size={17} strokeWidth={1.8} /><span>{label}</span>
                {label === 'Applications' && <span className="nav-count">{applications.length}</span>}
              </NavLink>
            ))}
          </nav>
          <div className="sidebar-bottom">
            <div className="side-label">YOUR GOAL</div>
            <div className="goal-card">
              <div className="goal-icon"><Target size={16} /></div>
              <div><strong>Landing the right role</strong><span>Keep your momentum going.</span></div>
              <ArrowUpRight size={14} className="goal-arrow" />
            </div>
            <NavLink className="settings-link" to="/settings"><Settings size={17} /><span>Settings</span></NavLink>
            <div className="side-profile">
              <div className="profile-avatar">{preferences.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join('').toUpperCase()}</div>
              <div className="profile-copy"><strong>{preferences.name}</strong><small>Candidate</small></div>
              <MoreHorizontal size={17} />
            </div>
          </div>
          <button className="collapse-button" onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
            <ChevronLeft size={16} />
          </button>
        </aside>
        {mobileMenu && <button className="mobile-backdrop" onClick={() => setMobileMenu(false)} aria-label="Close menu" />}
        <main className="main-shell">
          <header className="topbar">
            <button className="mobile-menu-button icon-button" onClick={() => setMobileMenu(true)} aria-label="Open menu"><Menu size={19} /></button>
            <div className="breadcrumbs"><span>Workspace</span><ChevronRight size={14} /><strong><PageTitle /></strong></div>
            <div className="topbar-actions">
              <label className="global-search"><Search size={16} /><input aria-label="Search applications" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search anything..." /><kbd>⌘ K</kbd></label>
              <button className="icon-button notification-button" aria-label="Notifications" onClick={() => toast.info('You’re all caught up')}>
                <Bell size={17} /><span className="notification-dot" />
              </button>
              <button className="icon-button theme-button" aria-label="Toggle theme" onClick={() => setDarkMode((value) => !value)}>{darkMode ? <Sparkles size={17} /> : <Activity size={17} />}</button>
              <button className="button button-primary top-add" onClick={() => context.openForm()}><Plus size={16} /> Add application</button>
            </div>
          </header>
          <div className="page-scroll">
            {!ready ? loadError ? <div className="load-error"><CircleHelp size={22} /><h2>Your local data couldn’t be opened</h2><p>{loadError}</p><button className="button button-secondary" onClick={() => { setLoadError(''); initialize().catch((error: unknown) => { const message = error instanceof Error ? error.message : 'unknown error'; setLoadError(message); toast.error(`Could not load local data: ${message}`) }) }}>Try again</button></div> : <div className="loading-state"><span className="loader" /> Loading your placement workspace…</div> : (
              <Routes>
                <Route element={<Outlet context={context} />}>
                  <Route path="/" element={<Overview />} />
                  <Route path="/applications" element={<Applications />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/calendar" element={<CalendarPage />} />
                  <Route path="/analytics" element={<Analytics />} />
                  <Route path="/resumes" element={<ResumeLibrary />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<Overview />} />
                </Route>
              </Routes>
            )}
          </div>
        </main>
      </div>
      <AnimatePresence>
        {formApplication && <ApplicationModal application={formApplication} onClose={() => setFormApplication(undefined)} onSave={submitApplication} resumes={useTracker.getState().resumes} />}
        {detailApplication && <ApplicationDrawer application={applications.find((item) => item.id === detailApplication.id) ?? detailApplication} onClose={() => setDetailApplication(null)} onEdit={(item) => { setDetailApplication(null); setFormApplication(item) }} onDelete={removeApplication} />}
      </AnimatePresence>
    </BrowserRouter>
  )
}

function PageTitle() {
  const location = useLocation()
  const title = navItems.find((item) => item.to === location.pathname)?.label ?? (location.pathname === '/settings' ? 'Settings' : 'Overview')
  return <>{title === 'Kanban board' ? 'Pipeline' : title}</>
}

function PageHeading({ eyebrow, title, description, actions }: { eyebrow?: string; title: string; description?: string; actions?: React.ReactNode }) {
  return <div className="page-heading">
    <div>{eyebrow && <div className="eyebrow">{eyebrow}</div>}<h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="heading-actions">{actions}</div>}
  </div>
}

function Overview() {
  const { applications, openForm, openDetails } = useAppContext()
  const activities = useTracker((state) => state.activities)
  const preferences = useTracker((state) => state.preferences)
  const navigate = useNavigate()
  const hour = APP_NOW.getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'
  const totalSent = applications.filter((app) => Boolean(app.appliedDate) && app.status !== 'Saved').length
  const oaPassed = applications.filter((app) => app.rounds.some((round) => round.completed && round.passed && /online assessment|\boa\b/i.test(round.name))).length
  const interviewRounds = applications.reduce((sum, app) => sum + app.rounds.filter((round) => round.completed && /interview/i.test(round.name)).length, 0)
  const offers = applications.filter((app) => app.status === 'Offer Received').length
  const conversion = totalSent ? Math.round((offers / totalSent) * 100) : 0
  const stats = [
    { label: 'Applications sent', value: totalSent, detail: 'with an applied date', icon: BriefcaseBusiness, tint: 'violet', trend: 'Your pipeline' },
    { label: 'OAs passed', value: oaPassed, detail: 'unique applications', icon: CheckCheck, tint: 'blue', trend: 'Completed milestones' },
    { label: 'Interviews attended', value: interviewRounds, detail: 'completed rounds', icon: Users, tint: 'amber', trend: 'Across all companies' },
    { label: 'Offers received', value: offers, detail: 'ready for your next step', icon: Sparkles, tint: 'green', trend: 'Offers in hand' },
    { label: 'Conversion rate', value: `${conversion}%`, detail: 'offers / applications sent', icon: TrendingUp, tint: 'pink', trend: 'Overall selection' },
  ]
  const statusData = applicationStatuses.map((status) => ({ name: status, value: applications.filter((app) => app.status === status).length, color: statusColors[status] })).filter((item) => item.value > 0)
  const months = Array.from({ length: 6 }, (_, index) => startOfMonth(subMonths(APP_NOW, 5 - index)))
  const monthlyData = months.map((month) => ({
    month: format(month, 'MMM'),
    applications: applications.filter((app) => app.appliedDate && format(parseISO(app.appliedDate), 'yyyy-MM') === format(month, 'yyyy-MM')).length,
  }))
  const funnelStages = [
    { name: 'Applied', count: totalSent, color: '#8887ff' },
    { name: 'OA passed', count: oaPassed, color: '#56b8f5' },
    { name: 'Technical interview', count: applications.filter((app) => app.rounds.some((round) => round.completed && round.passed && /technical/i.test(round.name))).length, color: '#f3b35e' },
    { name: 'HR round', count: applications.filter((app) => app.rounds.some((round) => round.completed && round.passed && /\bhr\b|human resources/i.test(round.name))).length, color: '#c49afb' },
    { name: 'Offer', count: offers, color: '#40c99b' },
  ]
  const reminders = useMemo(() => getUpcomingEvents(applications).slice(0, 4), [applications])
  const maxFunnel = Math.max(funnelStages[0].count, 1)

  return <div className="page-content">
    <PageHeading eyebrow={format(APP_NOW, 'EEEE, MMMM d').toUpperCase()} title={`${greeting}, ${preferences.name.split(' ')[0]}`} description="Here’s what’s happening with your placement journey." actions={<button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Add application</button>} />
    <div className="welcome-strip"><div className="welcome-symbol"><Zap size={18} fill="currentColor" /></div><div><strong>Small steps add up.</strong><span> You’re building great momentum. Keep your pipeline moving.</span></div><button onClick={() => openForm()}>Log an update <ArrowRight size={14} /></button></div>
    <section className="metric-grid" aria-label="Placement metrics">
      {stats.map((stat, index) => {
        const Icon = stat.icon
        return <motion.article key={stat.label} className="metric-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.045 }}>
          <div className="metric-top"><span className={`metric-icon ${stat.tint}`}><Icon size={17} /></span><span className="metric-kicker">{stat.trend}</span><ArrowUpRight size={14} className="metric-arrow" /></div>
          <div className="metric-value">{stat.value}</div><div className="metric-label">{stat.label}</div><div className="metric-detail">{stat.detail}</div>
        </motion.article>
      })}
    </section>
    <div className="dashboard-grid">
      <section className="panel trend-panel">
        <div className="panel-heading"><div><h2>Application activity</h2><p>Your applications over the last 6 months</p></div><span className="period-pill"><span /> Last 6 months</span></div>
        <div className="chart-area"><Suspense fallback={<div className="chart-loading" />}><ActivityAreaChart data={monthlyData} /></Suspense></div>
        <div className="chart-footnote"><span><i className="legend-dot violet-dot" /> Applications sent</span><span>Only dates in your records are shown</span></div>
      </section>
      <section className="panel status-panel">
        <div className="panel-heading"><div><h2>Application status</h2><p>Where things stand right now</p></div><button className="subtle-icon" onClick={() => location.assign('/applications')} aria-label="View all applications"><ArrowUpRight size={16} /></button></div>
        <Suspense fallback={<div className="chart-loading donut-loading" />}><StatusDonut data={statusData} total={applications.length} /></Suspense>
        <div className="status-legend">{applicationStatuses.map((status) => {
          const count = applications.filter((app) => app.status === status).length
          const percentage = applications.length ? Math.round(count / applications.length * 100) : 0
          return <div key={status} className="legend-row"><span><i className="legend-dot" style={{ background: statusColors[status] }} />{status}</span><strong>{count} <small>{percentage}%</small></strong></div>
        })}</div>
      </section>
      <section className="panel funnel-panel">
        <div className="panel-heading"><div><h2>Recruitment funnel</h2><p>Completed milestones across your applications</p></div><span className="tiny-badge">LIVE</span></div>
        <div className="funnel-list">{funnelStages.map((stage, index) => {
          const previous = funnelStages[index - 1]
          const percent = previous?.count ? Math.round(stage.count / previous.count * 100) : null
          const dropoff = percent === null ? null : 100 - percent
          return <button className="funnel-row" key={stage.name} onClick={() => navigate(`/applications?stage=${encodeURIComponent(stage.name)}`)} title={`View ${stage.name} applications`}>
            <span className="funnel-stage"><i className="legend-dot" style={{ background: stage.color }} />{stage.name}</span>
            <span className="funnel-track"><i style={{ width: `${Math.min(stage.count / maxFunnel * 100, 100)}%`, background: stage.color }} /></span>
            <strong>{stage.count}</strong><span className="funnel-percent"><b>{percent === null ? '—' : `${percent}%`}</b><small>{!previous ? 'entry' : dropoff === null ? '—' : `${dropoff}% drop`}</small></span>
          </button>
        })}</div>
        <div className="funnel-foot"><span>Stage conversion</span><span>Click a stage to explore <ArrowRight size={12} /></span></div>
      </section>
      <section className="panel reminders-panel">
        <div className="panel-heading"><div><h2>Coming up</h2><p>Interviews, assessments & deadlines</p></div><Link className="text-link" to="/calendar">View calendar <ArrowRight size={13} /></Link></div>
        {reminders.length === 0 ? <div className="empty-inline"><CalendarDays size={18} /><span>No upcoming dates. Add a deadline or interview to stay on track.</span></div> :
          <div className="reminder-list">{reminders.map((event) => <button key={event.id} className="reminder-row" onClick={() => { const app = applications.find((item) => item.id === event.applicationId); if (app) openDetails(app) }}>
            <span className={`reminder-date ${event.type}`}>{format(parseISO(event.date), 'MMM')}<strong>{format(parseISO(event.date), 'd')}</strong></span>
            <span className="reminder-copy"><strong>{event.title}</strong><small>{event.company} · {event.typeLabel}</small></span>
            <span className="reminder-time">{event.delta}</span>
          </button>)}</div>}
      </section>
      <section className="panel recent-panel">
        <div className="panel-heading"><div><h2>Recent applications</h2><p>Your latest activity at a glance</p></div><Link className="text-link" to="/applications">See all <ArrowRight size={13} /></Link></div>
        <ApplicationRows applications={[...applications].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)} onSelect={openDetails} />
      </section>
      <section className="panel activity-panel">
        <div className="panel-heading"><div><h2>Activity</h2><p>Recent changes in your workspace</p></div><Activity size={16} className="muted-icon" /></div>
        {activities.length === 0 ? <div className="empty-inline"><Activity size={17} /><span>Your activity will appear here as you update your pipeline.</span></div> :
          <div className="activity-list">{activities.slice(0, 4).map((activity) => <div key={activity.id} className="activity-row"><span className="activity-marker"><Check size={12} /></span><div><strong>{activity.description}</strong><small>{formatDistance(activity.createdAt)}</small></div></div>)}</div>}
      </section>
    </div>
  </div>
}

function formatDistance(value: string) {
  const minutes = Math.max(0, Math.round((APP_NOW.getTime() - parseISO(value).getTime()) / 60000))
  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

type CalendarEvent = { id: string; applicationId: string; title: string; company: string; date: string; type: 'interview' | 'assessment' | 'deadline'; typeLabel: string; delta: string }

function getUpcomingEvents(applications: PlacementApplication[]): CalendarEvent[] {
  const today = APP_NOW
  const events: CalendarEvent[] = []
  for (const app of applications) {
    if (app.deadline) events.push({ id: `${app.id}-deadline`, applicationId: app.id, title: 'Application deadline', company: app.company, date: app.deadline, type: 'deadline', typeLabel: 'Deadline', delta: dateDelta(app.deadline) })
    for (const round of app.rounds) {
      if (!round.date || round.completed) continue
      const isAssessment = /assessment|\boa\b/i.test(round.name)
      events.push({ id: round.id, applicationId: app.id, title: round.name, company: app.company, date: round.date, type: isAssessment ? 'assessment' : 'interview', typeLabel: isAssessment ? 'Assessment' : 'Interview', delta: dateDelta(round.date) })
    }
  }
  return events.filter((event) => !isBefore(parseISO(event.date), startOfMonth(subMonths(today, 1)))).sort((a, b) => a.date.localeCompare(b.date))
}

function dateDelta(value: string) {
  const days = Math.ceil((parseISO(value).getTime() - startOfDay(APP_NOW).getTime()) / 86400000)
  if (days < 0) return `${Math.abs(days)}d overdue`
  if (days === 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return `In ${days} days`
}

function EmptyChart({ text }: { text: string }) {
  return <div className="chart-empty"><span><Activity size={19} /></span><p>{text}</p></div>
}

function ApplicationRows({ applications, onSelect }: { applications: PlacementApplication[]; onSelect: (app: PlacementApplication) => void }) {
  if (!applications.length) return <div className="empty-inline"><BriefcaseBusiness size={18} /><span>No applications yet. Add your first opportunity to get started.</span></div>
  return <div className="recent-list">{applications.map((app) => <button key={app.id} className="recent-row" onClick={() => onSelect(app)}>
    <CompanyMark company={app.company} />
    <span className="recent-company"><strong>{app.company}</strong><small>{app.role}</small></span>
    <span className={`status-pill ${statusClass[app.status]}`}><i />{app.status}</span>
    <span className="recent-date">{app.appliedDate ? format(parseISO(app.appliedDate), 'MMM d') : '—'}</span>
  </button>)}</div>
}

function CompanyMark({ company, className = '' }: { company: string; className?: string }) {
  const initials = company.trim().split(/\s+/).slice(0, 2).map((word) => word[0]).join('').toUpperCase() || '?'
  const hues = [248, 194, 162, 291, 25, 207]
  const hue = company.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % hues.length
  return <span className={`company-mark ${className}`} style={{ '--company-hue': hues[hue] } as React.CSSProperties}>{initials}</span>
}

function Applications() {
  const { applications, search, setSearch, openForm, openDetails } = useAppContext()
  const saveApplication = useTracker((state) => state.saveApplication)
  const [searchParams, setSearchParams] = useSearchParams()
  const requestedStage = searchParams.get('stage') ?? ''
  const [statusFilter, setStatusFilter] = useState('All statuses')
  const [sortKey, setSortKey] = useState<'appliedDate' | 'company' | 'ctc'>('appliedDate')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkStatus, setBulkStatus] = useState<ApplicationStatus>('Applied')
  const [filtersExpanded, setFiltersExpanded] = useState(false)
  const [minPackage, setMinPackage] = useState('')
  const [maxPackage, setMaxPackage] = useState('')
  const [appliedFrom, setAppliedFrom] = useState('')
  const [appliedTo, setAppliedTo] = useState('')
  const [deadlineFrom, setDeadlineFrom] = useState('')
  const [deadlineTo, setDeadlineTo] = useState('')
  const filtered = applications.filter((app) => {
    const textMatch = `${app.company} ${app.role} ${app.location}`.toLowerCase().includes(search.toLowerCase())
    const stageMatch = !requestedStage || matchesFunnelStage(app, requestedStage)
    const packageValue = readPackageValue(app.ctc)
    const packageMatches = (!minPackage || (packageValue !== undefined && Number.isFinite(packageValue) && packageValue >= Number(minPackage)))
      && (!maxPackage || (packageValue !== undefined && Number.isFinite(packageValue) && packageValue <= Number(maxPackage)))
    const appliedMatches = (!appliedFrom || Boolean(app.appliedDate && app.appliedDate >= appliedFrom))
      && (!appliedTo || Boolean(app.appliedDate && app.appliedDate <= appliedTo))
    const deadlineMatches = (!deadlineFrom || Boolean(app.deadline && app.deadline >= deadlineFrom))
      && (!deadlineTo || Boolean(app.deadline && app.deadline <= deadlineTo))
    return textMatch && stageMatch && packageMatches && appliedMatches && deadlineMatches && (statusFilter === 'All statuses' || app.status === statusFilter)
  }).sort((a, b) => {
    if (sortKey === 'ctc') {
      const aValue = readPackageValue(a.ctc)
      const bValue = readPackageValue(b.ctc)
      if (aValue === undefined) return bValue === undefined ? 0 : 1
      if (bValue === undefined) return -1
      return sortDirection === 'asc' ? aValue - bValue : bValue - aValue
    }
    const result = sortKey === 'company' ? a.company.localeCompare(b.company) : (a.appliedDate ?? '').localeCompare(b.appliedDate ?? '')
    return sortDirection === 'asc' ? result : -result
  })
  const selectAll = () => setSelected(selected.length === filtered.length ? [] : filtered.map((app) => app.id))
  const exportCsv = () => {
    const rows = [['Company', 'Role', 'CTC', 'Location', 'Status', 'Applied date', 'Deadline', 'Resume'], ...filtered.map((app) => [app.company, app.role, app.ctc, app.location, app.status, app.appliedDate ?? '', app.deadline ?? '', app.linkedResumeName ?? ''])]
    const csv = rows.map((row) => row.map((field) => {
      const value = String(field)
      const safeValue = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value
      return `"${safeValue.replaceAll('"', '""')}"`
    }).join(',')).join('\r\n')
    const link = document.createElement('a')
    link.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
    link.download = 'placement-applications.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    toast.success('Applications exported')
  }
  const updateSelected = async () => {
    try {
      await Promise.all(applications.filter((app) => selected.includes(app.id)).map((app) => saveApplication({ ...app, status: bulkStatus })))
      setSelected([])
      toast.success('Selected applications updated')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Bulk update failed')
    }
  }
  const clearFilters = () => {
    setStatusFilter('All statuses')
    setMinPackage('')
    setMaxPackage('')
    setAppliedFrom('')
    setAppliedTo('')
    setDeadlineFrom('')
    setDeadlineTo('')
    setSearch('')
    setSearchParams({})
  }

  return <div className="page-content">
    <PageHeading eyebrow="YOUR PIPELINE" title="Applications" description="Keep every opportunity organized, from first click to final offer." actions={<><button className="button button-secondary" onClick={exportCsv}><Download size={15} /> Export CSV</button><button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Add application</button></>} />
    <section className="panel applications-panel">
      <div className="table-toolbar">
        <div className="toolbar-left"><span className="result-count"><strong>{filtered.length}</strong> applications</span>{requestedStage && <button className="stage-filter" onClick={() => setSearchParams({})}>{requestedStage}<X size={12} /></button>}<label className="filter-select"><Filter size={14} /><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>All statuses</option>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><ChevronDown size={13} /></label></div>
        <div className="toolbar-right">
          {selected.length > 0 && <div className="bulk-tools"><span>{selected.length} selected</span><select value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as ApplicationStatus)} aria-label="Bulk status"><option disabled>Set status…</option>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select><button className="button button-secondary button-small" onClick={updateSelected}>Update</button></div>}
          <button className="button button-secondary button-small sort-button" onClick={() => { setSortKey(sortKey === 'appliedDate' ? 'company' : sortKey === 'company' ? 'ctc' : 'appliedDate'); setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc') }}><ArrowDownUp size={14} /> Sort: {sortKey === 'appliedDate' ? 'date' : sortKey === 'ctc' ? 'package' : 'company'}</button>
          <button className={`button button-secondary button-small ${filtersExpanded ? 'active-tool' : ''}`} onClick={() => setFiltersExpanded((value) => !value)}><Filter size={13} /> Filters</button>
        </div>
      </div>
      {filtersExpanded && <div className="advanced-filters">
        <label title="Compared with the first numeric value in the package field">Package min<input type="number" min="0" value={minPackage} onChange={(event) => setMinPackage(event.target.value)} placeholder="e.g. 80" /></label>
        <label title="Compared with the first numeric value in the package field">Package max<input type="number" min="0" value={maxPackage} onChange={(event) => setMaxPackage(event.target.value)} placeholder="e.g. 150" /></label>
        <label>Applied after<input type="date" value={appliedFrom} onChange={(event) => setAppliedFrom(event.target.value)} /></label>
        <label>Applied before<input type="date" value={appliedTo} onChange={(event) => setAppliedTo(event.target.value)} /></label>
        <label>Deadline after<input type="date" value={deadlineFrom} onChange={(event) => setDeadlineFrom(event.target.value)} /></label>
        <label>Deadline before<input type="date" value={deadlineTo} onChange={(event) => setDeadlineTo(event.target.value)} /></label>
        <button className="clear-filters" onClick={clearFilters}>Clear all filters</button>
      </div>}
      <div className="table-scroll"><table className="application-table"><thead><tr>
        <th className="check-col"><input type="checkbox" checked={filtered.length > 0 && selected.length === filtered.length} onChange={selectAll} aria-label="Select all applications" /></th>
        <th>COMPANY</th><th>ROLE</th><th>CTC / PACKAGE</th><th>LOCATION</th><th>STATUS</th><th>APPLIED</th><th>DEADLINE</th><th>RESUME</th><th />
      </tr></thead><tbody>
        {filtered.map((app) => <tr key={app.id} tabIndex={0} onClick={() => openDetails(app)} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openDetails(app) } }}>
          <td onClick={(event) => event.stopPropagation()}><input type="checkbox" checked={selected.includes(app.id)} onChange={(event) => setSelected(event.target.checked ? [...selected, app.id] : selected.filter((id) => id !== app.id))} aria-label={`Select ${app.company}`} /></td>
          <td><span className="table-company"><CompanyMark company={app.company} /><strong>{app.company}</strong></span></td><td className="role-cell">{app.role}</td><td>{app.ctc || <span className="muted-cell">—</span>}</td><td><span className="location-cell"><MapPin size={12} />{app.location || '—'}</span></td>
          <td><span className={`status-pill ${statusClass[app.status]}`}><i />{app.status}</span></td>
          <td>{app.appliedDate ? format(parseISO(app.appliedDate), 'MMM d, yyyy') : <span className="muted-cell">—</span>}</td>
          <td>{app.deadline ? <span className={isBefore(parseISO(app.deadline), APP_NOW) ? 'overdue-cell' : ''}>{format(parseISO(app.deadline), 'MMM d, yyyy')}</span> : <span className="muted-cell">—</span>}</td>
          <td>{app.linkedResumeName ? <span className="resume-chip"><FileText size={12} />{app.linkedResumeName}</span> : <span className="muted-cell">—</span>}</td>
          <td><button className="row-more" aria-label={`Open ${app.company}`}><MoreHorizontal size={16} /></button></td>
        </tr>)}
      </tbody></table>
      {!filtered.length && <div className="table-empty"><span><Search size={20} /></span><strong>No applications found</strong><p>Try changing your search or filters, or add an application.</p><button className="button button-primary button-small" onClick={() => openForm()}><Plus size={14} /> Add application</button></div>}
      </div>
      <div className="table-footer"><span>Showing <strong>{filtered.length}</strong> of <strong>{applications.length}</strong> applications</span><span>Stored securely on this device <span className="privacy-dot" /></span></div>
    </section>
  </div>
}

function matchesFunnelStage(app: PlacementApplication, stage: string) {
  if (stage === 'Applied') return Boolean(app.appliedDate) && app.status !== 'Saved'
  if (stage === 'OA passed') return app.rounds.some((round) => round.completed && round.passed && /online assessment|\boa\b/i.test(round.name))
  if (stage === 'Technical interview') return app.rounds.some((round) => round.completed && round.passed && /technical/i.test(round.name))
  if (stage === 'HR round') return app.rounds.some((round) => round.completed && round.passed && /\bhr\b|human resources/i.test(round.name))
  if (stage === 'Offer') return app.status === 'Offer Received'
  return false
}

function readPackageValue(value: string) {
  const numericValue = value.match(/\d+(?:\.\d+)?/)?.[0]
  return numericValue === undefined ? undefined : Number(numericValue)
}

function Pipeline() {
  const { applications, openForm, openDetails } = useAppContext()
  const moveApplication = useTracker((state) => state.moveApplication)
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const handleDrag = async ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return
    const app = applications.find((item) => item.id === active.id)
    if (!app) return
    const overStatus = over.data.current?.status ?? over.id
    const newStatus = String(overStatus) as ApplicationStatus
    if (!applicationStatuses.includes(newStatus)) return
    if (newStatus === 'Rejected' || newStatus === 'Offer Received') {
      if (!window.confirm(`Move ${app.company} to ${newStatus}?`)) return
    }
    try {
      await moveApplication(app.id, newStatus)
      toast.success(`${app.company} moved to ${newStatus}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not move application')
    }
  }
  return <div className="page-content pipeline-page">
    <PageHeading eyebrow="VISUAL PIPELINE" title="Your pipeline" description="Drag and drop opportunities as they move forward." actions={<button className="button button-primary" onClick={() => openForm()}><Plus size={16} /> Add application</button>} />
    <DndContext sensors={sensors} onDragEnd={handleDrag}>
      <div className="kanban-board">{applicationStatuses.map((status) => <KanbanColumn key={status} status={status} applications={applications.filter((app) => app.status === status)} onAdd={() => openForm(undefined, status)} onSelect={openDetails} />)}</div>
    </DndContext>
  </div>
}

function KanbanColumn({ status, applications, onAdd, onSelect }: { status: ApplicationStatus; applications: PlacementApplication[]; onAdd: () => void; onSelect: (app: PlacementApplication) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, data: { status } })
  return <div className={`kanban-column ${isOver ? 'drop-over' : ''}`} data-status={status}>
    <div className="kanban-column-head"><span className="column-indicator" style={{ background: statusColors[status] }} /><strong>{status}</strong><span className="column-count">{applications.length}</span><button aria-label={`Add to ${status}`} onClick={onAdd}><Plus size={14} /></button></div>
    <SortableContext items={applications.map((app) => app.id)} strategy={verticalListSortingStrategy}>
      <div className="kanban-cards" ref={setNodeRef}>
        {applications.map((app) => <KanbanCard key={app.id} app={app} onSelect={onSelect} />)}
        {!applications.length && <div className="kanban-empty">Drop an application here</div>}
      </div>
    </SortableContext>
  </div>
}

function KanbanCard({ app, onSelect }: { app: PlacementApplication; onSelect: (app: PlacementApplication) => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: app.id, data: { status: app.status } })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 }
  return <article ref={setNodeRef} style={style} className="kanban-card" {...attributes} {...listeners} onClick={() => onSelect(app)}>
    <div className="kanban-card-top"><CompanyMark company={app.company} /><span className="card-company">{app.company}</span><GripVertical size={14} className="drag-icon" /></div>
    <strong className="kanban-role">{app.role}</strong>
    <div className="kanban-meta">{app.ctc && <span>{app.ctc}</span>}{app.location && <span><MapPin size={11} />{app.location}</span>}</div>
    <div className="kanban-card-foot"><span>{app.appliedDate ? `Applied ${format(parseISO(app.appliedDate), 'MMM d')}` : 'Not applied'}</span>{app.deadline && <span className={isBefore(parseISO(app.deadline), APP_NOW) ? 'deadline-danger' : 'deadline-normal'}><Clock3 size={11} />{dateDelta(app.deadline)}</span>}</div>
  </article>
}

function CalendarPage() {
  const { applications, openDetails } = useAppContext()
  const [view, setView] = useState<'Agenda' | 'Week' | 'Month'>('Agenda')
  const events = getUpcomingEvents(applications)
  const monthEvents = events.filter((event) => format(parseISO(event.date), 'yyyy-MM') === format(APP_NOW, 'yyyy-MM'))
  const weekStart = startOfWeek(APP_NOW)
  const weekEnd = endOfWeek(APP_NOW)
  const weekEvents = events.filter((event) => {
    const date = parseISO(event.date)
    return date >= weekStart && date <= weekEnd
  })
  const shown = view === 'Month' ? monthEvents : view === 'Week' ? weekEvents : events
  const grouped = shown.reduce<Record<string, CalendarEvent[]>>((result, event) => {
    const key = event.date
    result[key] = [...(result[key] ?? []), event]
    return result
  }, {})
  return <div className="page-content">
    <PageHeading eyebrow="STAY ON TRACK" title="Calendar" description="Interviews, assessments and deadlines in one place." actions={<div className="segmented-control"><button className={view === 'Agenda' ? 'active' : ''} onClick={() => setView('Agenda')}>Agenda</button><button className={view === 'Week' ? 'active' : ''} onClick={() => setView('Week')}>Week</button><button className={view === 'Month' ? 'active' : ''} onClick={() => setView('Month')}>Month</button></div>} />
    <div className="calendar-layout">
      <section className="panel calendar-panel">
        <div className="calendar-toolbar"><div><h2>{view === 'Agenda' ? 'Upcoming events' : view === 'Month' ? format(APP_NOW, 'MMMM yyyy') : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d, yyyy')}`}</h2><p>{view === 'Agenda' ? `${shown.length} scheduled date${shown.length === 1 ? '' : 's'}` : `${shown.length} event${shown.length === 1 ? '' : 's'} in this ${view.toLowerCase()}`}</p></div><div className="calendar-legend"><span><i className="legend-dot" style={{ background: '#948bff' }} /> Interview</span><span><i className="legend-dot" style={{ background: '#38bdf8' }} /> Assessment</span><span><i className="legend-dot" style={{ background: '#f2ad52' }} /> Deadline</span></div></div>
        {!shown.length ? <div className="calendar-empty"><span><CalendarDays size={22} /></span><h3>No dates scheduled</h3><p>Once you add interview rounds or application deadlines, they’ll show up here.</p></div> : <div className="agenda-list">{Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).map(([date, items]) => <div className="agenda-day" key={date}>
          <div className="agenda-date"><span>{format(parseISO(date), 'EEE')}</span><strong>{format(parseISO(date), 'd')}</strong><small>{format(parseISO(date), 'MMM')}</small></div>
          <div className="agenda-events">{items.map((event) => <button key={event.id} className={`agenda-event ${event.type}`} onClick={() => { const app = applications.find((item) => item.id === event.applicationId); if (app) openDetails(app) }}>
            <span className="event-line" /><span className="agenda-event-copy"><strong>{event.title}</strong><small>{event.company} · {event.typeLabel}</small></span><span className={event.delta.includes('overdue') ? 'event-overdue' : 'event-delta'}>{event.delta}</span><ChevronRight size={15} />
          </button>)}</div>
        </div>)}</div>}
      </section>
      <aside className="calendar-aside">
        <div className="panel calendar-summary"><span className="summary-icon"><CalendarDays size={17} /></span><div><strong>{events.length}</strong><span>scheduled events</span></div><span className="summary-badge">All time</span></div>
        <div className="panel mini-tip"><span className="tip-icon"><Sparkles size={16} /></span><h3>One step at a time</h3><p>Keep interview dates and deadlines up to date so nothing sneaks up on you.</p><div className="tip-foot"><span>Stay prepared</span><ArrowRight size={13} /></div></div>
      </aside>
    </div>
  </div>
}

function Analytics() {
  const { applications } = useAppContext()
  const activities = useTracker((state) => state.activities)
  const sent = applications.filter((app) => app.appliedDate && app.status !== 'Saved')
  const offers = applications.filter((app) => app.status === 'Offer Received').length
  const completed = applications.flatMap((app) => app.rounds.filter((round) => round.completed && /interview/i.test(round.name)))
  const outcomes = completed.filter((round) => round.passed !== undefined)
  const passed = outcomes.filter((round) => round.passed).length
  const offerActivities = new Map<string, string>()
  for (const activity of activities) {
    if (activity.toStatus === 'Offer Received' && !offerActivities.has(activity.applicationId)) offerActivities.set(activity.applicationId, activity.createdAt)
  }
  const avgDays = applications.flatMap((app) => {
    const offerDate = offerActivities.get(app.id)
    if (!app.appliedDate || !offerDate) return []
    const days = (Date.parse(offerDate) - parseISO(app.appliedDate).getTime()) / 86400000
    return days >= 0 ? [days] : []
  })
  const reasons = applications.filter((app) => app.status === 'Rejected' && app.rejectionReason).reduce<Record<string, number>>((acc, app) => {
    const reason = app.rejectionReason!.trim()
    acc[reason] = (acc[reason] ?? 0) + 1
    return acc
  }, {})
  const packageData = applications.flatMap((app) => {
    const value = readPackageValue(app.ctc)
    return value === undefined ? [] : [{ company: app.company, package: value }]
  }).slice(0, 8)
  const companyStats = applications.reduce<Record<string, { count: number; rounds: number }>>((result, app) => {
    const current = result[app.company] ?? { count: 0, rounds: 0 }
    result[app.company] = { count: current.count + 1, rounds: current.rounds + app.rounds.length }
    return result
  }, {})
  return <div className="page-content">
    <PageHeading eyebrow="YOUR PROGRESS" title="Analytics" description="A clear picture of your recruiting journey, built from your records." actions={<span className="privacy-label"><span className="privacy-dot" /> Calculated locally</span>} />
    <div className="analytics-kpis">
      <div className="panel analytics-kpi"><span>APPLICATIONS SENT</span><strong>{sent.length}</strong><small>Records with an applied date</small></div>
      <div className="panel analytics-kpi"><span>INTERVIEW SUCCESS</span><strong>{outcomes.length ? `${Math.round(passed / outcomes.length * 100)}%` : '—'}</strong><small>{passed} of {outcomes.length} rounds with recorded outcomes passed</small></div>
      <div className="panel analytics-kpi"><span>OFFERS RECEIVED</span><strong>{offers}</strong><small>Based on current application status</small></div>
      <div className="panel analytics-kpi"><span>AVG. TIME TO OFFER</span><strong>{avgDays.length ? `${Math.max(0, Math.round(avgDays.reduce((sum, day) => sum + day, 0) / avgDays.length))}d` : '—'}</strong><small>{avgDays.length ? 'From applied date to recorded offer' : 'Need a recorded offer transition'}</small></div>
    </div>
    <div className="analytics-grid">
      <section className="panel analytics-chart-panel"><div className="panel-heading"><div><h2>Monthly applications</h2><p>Only dates recorded in your history</p></div><span className="data-badge"><Activity size={13} /> Real data</span></div>
        <div className="chart-area tall"><Suspense fallback={<div className="chart-loading" />}><MonthlyBarChart data={monthlyApplications(applications)} /></Suspense></div>
      </section>
      <section className="panel analytics-chart-panel"><div className="panel-heading"><div><h2>Package distribution</h2><p>Packages from your application records</p></div><span className="data-badge"><Activity size={13} /> Real data</span></div>
        {!packageData.length ? <EmptyChart text="Add package details to see this breakdown." /> : <div className="chart-area tall"><Suspense fallback={<div className="chart-loading" />}><PackageBarChart data={packageData} /></Suspense></div>}
      </section>
      <section className="panel analytics-chart-panel"><div className="panel-heading"><div><h2>Company activity</h2><p>Applications by company</p></div></div>
        {!applications.length ? <EmptyChart text="Your company activity will appear here." /> : <div className="company-stat-list">{Object.entries(companyStats).slice(0, 6).map(([company, stats]) => <div key={company} className="company-stat"><CompanyMark company={company} /><strong>{company}</strong><span>{stats.count} {stats.count === 1 ? 'application' : 'applications'}</span><span>{stats.rounds} {stats.rounds === 1 ? 'round' : 'rounds'}</span></div>)}</div>}
      </section>
      <section className="panel analytics-chart-panel"><div className="panel-heading"><div><h2>Rejection reasons</h2><p>From reasons you’ve recorded</p></div></div>
        {!Object.keys(reasons).length ? <EmptyChart text="No rejection reasons recorded yet." /> : <div className="reason-list">{Object.entries(reasons).map(([reason, count]) => <div key={reason}><span>{reason}</span><strong>{count}</strong></div>)}</div>}
      </section>
    </div>
    <p className="analytics-disclaimer"><CircleHelp size={14} /> Metrics are calculated from your saved records. Missing dates and milestones are not estimated.</p>
  </div>
}

function monthlyApplications(applications: PlacementApplication[]) {
  return Array.from({ length: 6 }, (_, index) => {
    const month = startOfMonth(subMonths(APP_NOW, 5 - index))
    return { month: format(month, 'MMM'), count: applications.filter((app) => app.appliedDate && format(parseISO(app.appliedDate), 'yyyy-MM') === format(month, 'yyyy-MM')).length }
  })
}

function ResumeLibrary() {
  const resumes = useTracker((state) => state.resumes)
  const saveResume = useTracker((state) => state.saveResume)
  const deleteResume = useTracker((state) => state.deleteResume)
  const [busy, setBusy] = useState(false)
  const [dragging, setDragging] = useState(false)
  const [jobDescription, setJobDescription] = useState('')
  const [selectedResume, setSelectedResume] = useState('')
  const [preview, setPreview] = useState<ResumeDocument | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const currentResume = resumes.find((resume) => resume.id === selectedResume) ?? resumes[0]
  const match = currentResume ? matchResume(currentResume.extractedText, jobDescription) : null
  const processFiles = async (files: FileList | File[]) => {
    setBusy(true)
    try {
      for (const file of Array.from(files)) {
        if (file.size > 10 * 1024 * 1024) throw new Error(`${file.name} is over the 10 MB limit.`)
        const extension = file.name.split('.').pop()?.toLowerCase()
        if (!['pdf', 'docx'].includes(extension ?? '')) throw new Error(`${file.name} isn’t a supported PDF or DOCX file.`)
        const validMime = extension === 'pdf'
          ? ['application/pdf', 'application/octet-stream'].includes(file.type)
          : ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/octet-stream'].includes(file.type)
        if (!validMime) throw new Error(`${file.name} has an unexpected file type.`)
        let extractedText = ''
        if (extension === 'pdf') {
          const pdfjs = await import('pdfjs-dist')
          pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
          const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise
          const pages: string[] = []
          for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
            const page = await document.getPage(pageNumber)
            const content = await page.getTextContent()
            pages.push(content.items.map((item) => 'str' in item ? item.str : '').join(' '))
          }
          extractedText = pages.join('\n').replace(/[ \t]+/g, ' ').trim()
        } else {
          const mammoth = await import('mammoth/mammoth.browser')
          const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() })
          extractedText = result.value.replace(/\s+/g, ' ').trim()
        }
        if (!extractedText) throw new Error(`${file.name} contains no readable text.`)
        const skills = extractSkills(extractedText)
        const resume: ResumeDocument = { id: crypto.randomUUID(), name: file.name, fileType: extension as 'pdf' | 'docx', extractedText, uploadedAt: new Date().toISOString(), fileSize: file.size, skills, keywords: extractKeywords(extractedText) }
        await saveResume(resume, file)
        setSelectedResume(resume.id)
        toast.success(`${file.name} processed locally`)
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not process this document')
    } finally {
      setBusy(false)
    }
  }
  return <div className="page-content">
    <PageHeading eyebrow="DOCUMENTS" title="Resume library" description="Your documents stay private and are processed right in your browser." actions={<button className="button button-primary" onClick={() => inputRef.current?.click()} disabled={busy}><Upload size={15} /> Upload resume</button>} />
    <input ref={inputRef} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" hidden onChange={(event) => { if (event.target.files) void processFiles(event.target.files); event.currentTarget.value = '' }} />
    <div className="resume-layout">
      <div className="resume-main">
        <div className={`upload-zone ${dragging ? 'dragging' : ''}`} onDragOver={(event) => { event.preventDefault(); setDragging(true) }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); void processFiles(event.dataTransfer.files) }} onClick={() => inputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter' || event.key === ' ') inputRef.current?.click() }}>
          <span className="upload-icon"><Upload size={19} /></span><strong>{busy ? 'Reading document locally…' : 'Drop your resume here'}</strong><span>or <u>browse files</u> · PDF or DOCX · up to 10 MB</span>{busy && <span className="loader" />}
        </div>
        <div className="resume-section-head"><div><h2>Your documents</h2><p>{resumes.length} {resumes.length === 1 ? 'resume' : 'resumes'} saved on this device</p></div><span className="privacy-label"><span className="privacy-dot" /> Private</span></div>
        {!resumes.length ? <div className="panel resume-empty"><span><FileText size={21} /></span><h3>Your resume library is ready</h3><p>Upload a PDF or DOCX to extract skills, compare it with a job description, and link it to applications.</p><button className="button button-secondary" onClick={() => inputRef.current?.click()}><Upload size={15} /> Choose a file</button></div> : <div className="resume-cards">{resumes.map((resume) => <article key={resume.id} className={`panel resume-card ${selectedResume === resume.id ? 'selected' : ''}`} onClick={() => setSelectedResume(resume.id)}>
          <span className="resume-file-icon"><FileText size={20} /></span><div className="resume-card-copy"><strong>{resume.name}</strong><span>{resume.fileType.toUpperCase()} · {formatBytes(resume.fileSize)} · {format(parseISO(resume.uploadedAt), 'MMM d, yyyy')}</span><div className="skill-tags">{resume.skills.slice(0, 4).map((skill) => <span key={skill}>{skill}</span>)}{resume.skills.length > 4 && <span>+{resume.skills.length - 4}</span>}</div></div>
          <button className="icon-button" aria-label={`Preview ${resume.name}`} onClick={(event) => { event.stopPropagation(); setPreview(resume) }}><ArrowUpRight size={16} /></button><button className="icon-button danger-hover" aria-label={`Delete ${resume.name}`} onClick={async (event) => { event.stopPropagation(); if (window.confirm(`Delete ${resume.name}?`)) { try { await deleteResume(resume.id); toast.success('Resume deleted') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not delete resume') } } }}><Trash2 size={15} /></button>
        </article>)}</div>}
        <section className="panel matcher-panel"><div className="panel-heading"><div><h2>Resume match</h2><p>Compare a resume with a job description using local keyword matching.</p></div><span className="match-spark"><Sparkles size={16} /></span></div>
          <div className="matcher-controls"><label>Resume<select value={selectedResume} onChange={(event) => setSelectedResume(event.target.value)}><option value="">Select a resume</option>{resumes.map((resume) => <option key={resume.id} value={resume.id}>{resume.name}</option>)}</select></label><label>Job description<textarea value={jobDescription} onChange={(event) => setJobDescription(event.target.value)} placeholder="Paste the role requirements here…" rows={4} /></label></div>
          {match && jobDescription.trim() && <div className="match-result"><div className="match-score"><strong>{match.percent}%</strong><span>keyword match</span></div><div className="match-details"><div><span className="match-positive"><Check size={13} /> Matched skills</span><p>{match.matched.length ? match.matched.join(', ') : 'No matches found yet.'}</p></div><div><span className="match-missing"><X size={13} /> Missing keywords</span><p>{match.missing.length ? match.missing.join(', ') : 'No missing skills found.'}</p></div></div></div>}
          <div className="matcher-disclaimer"><CircleHelp size={13} /> A keyword-based estimate, not an AI assessment of candidate suitability.</div>
        </section>
      </div>
      <aside className="panel privacy-panel"><span className="privacy-lock"><Check size={17} /></span><h3>Your documents stay yours.</h3><p>Files and extracted text are stored in your browser’s IndexedDB. Nothing is uploaded to a server.</p><div className="privacy-list"><span><Check size={13} /> Local extraction</span><span><Check size={13} /> No external APIs</span><span><Check size={13} /> Delete any time</span></div></aside>
    </div>
    <AnimatePresence>{preview && <DocumentPreview resume={preview} onClose={() => setPreview(null)} />}</AnimatePresence>
  </div>
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.max(1, Math.round(bytes / 1024))} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

function SettingsPage() {
  const preferences = useTracker((state) => state.preferences)
  const setPreferences = useTracker((state) => state.setPreferences)
  const applications = useTracker((state) => state.applications)
  const [name, setName] = useState(preferences.name)
  const [target, setTarget] = useState(preferences.target)
  const [compact, setCompact] = useState(preferences.compact)
  const [exporting, setExporting] = useState(false)
  const save = () => {
    try {
      setPreferences({ name: name.trim() || 'Candidate', target: target.trim(), compact })
      toast.success('Preferences saved')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not save preferences')
    }
  }
  const exportBackup = async () => {
    setExporting(true)
    try {
      const [resumes, activities] = await Promise.all([db.resumes.toArray(), db.activities.toArray()])
      const data = { exportedAt: new Date().toISOString(), applications, resumes, activities }
      const anchor = document.createElement('a')
      anchor.href = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
      anchor.download = 'placement-tracker-backup.json'
      anchor.click()
      URL.revokeObjectURL(anchor.href)
      toast.success('Backup downloaded')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not export backup')
    } finally {
      setExporting(false)
    }
  }
  return <div className="page-content">
    <PageHeading eyebrow="PREFERENCES" title="Settings" description="Make your placement workspace feel like yours." />
    <div className="settings-layout">
      <section className="panel settings-panel"><div className="settings-section-head"><span className="settings-icon"><Users size={17} /></span><div><h2>Profile</h2><p>Personalize your workspace.</p></div></div>
        <label className="settings-field">Display name<input value={name} onChange={(event) => setName(event.target.value)} /></label>
        <label className="settings-field">Career focus<input value={target} onChange={(event) => setTarget(event.target.value)} placeholder="e.g. Product & Engineering" /></label>
        <label className="settings-toggle"><span><strong>Compact application list</strong><small>Use a denser layout for your application list.</small></span><input type="checkbox" checked={compact} onChange={(event) => setCompact(event.target.checked)} /></label>
        <div className="settings-actions"><button className="button button-primary" onClick={save}>Save preferences</button></div>
      </section>
      <section className="panel settings-panel"><div className="settings-section-head"><span className="settings-icon green"><Download size={17} /></span><div><h2>Your data</h2><p>Everything stays on this device. Export a copy whenever you need.</p></div></div>
        <div className="data-summary"><span><BriefcaseBusiness size={15} /> {applications.length} applications</span><span><FolderOpen size={15} /> {useTracker.getState().resumes.length} resumes</span></div>
        <button className="button button-secondary" onClick={exportBackup} disabled={exporting}><Download size={15} /> {exporting ? 'Preparing backup…' : 'Export local backup'}</button>
        <div className="local-storage-note"><span className="privacy-dot" /> Stored locally with IndexedDB <span>·</span> No account required</div>
      </section>
      <section className="panel settings-panel about-panel"><span className="brand-mark"><Sparkles size={16} /></span><div><h2>Placemently Pro</h2><p>Version 1.0.0 · Your personal placement command center.</p></div><span className="about-stack">React · IndexedDB · Private by design</span></section>
    </div>
  </div>
}

const applicationFormSchema = z.object({
  company: z.string().trim().min(1, 'Enter a company name'),
  role: z.string().trim().min(1, 'Enter a role title'),
  ctc: z.string(),
  location: z.string(),
  status: z.enum(applicationStatuses),
  appliedDate: z.string(),
  deadline: z.string(),
  jobDescription: z.string(),
  linkedResumeId: z.string(),
  customNotes: z.string(),
  rejectionReason: z.string(),
})
type FormValues = z.infer<typeof applicationFormSchema>

function ApplicationModal({ application, onClose, onSave, resumes }: { application: PlacementApplication; onClose: () => void; onSave: (app: PlacementApplication) => Promise<void>; resumes: ResumeDocument[] }) {
  const isEditing = Boolean(application.company)
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormValues>({
    resolver: zodResolver(applicationFormSchema),
    defaultValues: {
      company: application.company, role: application.role, ctc: application.ctc, location: application.location, status: application.status,
      appliedDate: application.appliedDate ?? '', deadline: application.deadline ?? '', jobDescription: application.jobDescription,
      linkedResumeId: application.linkedResumeId ?? '', customNotes: application.customNotes, rejectionReason: application.rejectionReason ?? '',
    },
  })
  const submit = async (values: FormValues) => {
    const resume = resumes.find((item) => item.id === values.linkedResumeId)
    await onSave({
      ...application,
      ...values,
      appliedDate: values.appliedDate || undefined,
      deadline: values.deadline || undefined,
      linkedResumeId: resume?.id,
      linkedResumeName: resume?.name,
      linkedResumeText: resume?.extractedText,
    })
  }
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <motion.section className="application-modal" initial={{ opacity: 0, y: 16, scale: 0.985 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: 0.985 }} role="dialog" aria-modal="true" aria-labelledby="application-modal-title">
      <div className="modal-header"><div><span className="modal-kicker">{isEditing ? 'UPDATE YOUR PIPELINE' : 'NEW OPPORTUNITY'}</span><h2 id="application-modal-title">{isEditing ? 'Edit application' : 'Add an application'}</h2><p>Capture the details now. You can always update them later.</p></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={18} /></button></div>
      <form onSubmit={handleSubmit(submit)} className="application-form">
        <div className="form-grid"><label className="form-field">Company name <span>*</span><input {...register('company')} placeholder="e.g. Acme Inc." autoFocus /><small className="field-error">{errors.company?.message}</small></label>
          <label className="form-field">Role title <span>*</span><input {...register('role')} placeholder="e.g. Product Designer" /><small className="field-error">{errors.role?.message}</small></label>
          <label className="form-field">CTC / Package<input {...register('ctc')} placeholder="e.g. $120k – $150k" /></label>
          <label className="form-field">Location<input {...register('location')} placeholder="e.g. Remote, New York" /></label>
          <label className="form-field">Application status<select {...register('status')}>{applicationStatuses.map((status) => <option key={status}>{status}</option>)}</select></label>
          <label className="form-field">Applied date<input type="date" {...register('appliedDate')} /></label>
          <label className="form-field">Deadline<input type="date" {...register('deadline')} /></label>
          <label className="form-field">Linked resume<select {...register('linkedResumeId')}><option value="">No resume linked</option>{resumes.map((resume) => <option value={resume.id} key={resume.id}>{resume.name}</option>)}</select></label>
        </div>
        <label className="form-field full-field">Job description<textarea {...register('jobDescription')} placeholder="Paste the job description or key requirements…" rows={3} /></label>
        <label className="form-field full-field">Notes<textarea {...register('customNotes')} placeholder="Add a note to remember…" rows={2} /></label>
        <label className="form-field full-field">Rejection reason<input {...register('rejectionReason')} placeholder="Optional — helps you spot patterns later" /></label>
        <div className="form-footer"><span><span className="privacy-dot" /> Saved privately on this device</span><div><button type="button" className="button button-secondary" onClick={onClose}>Cancel</button><button type="submit" className="button button-primary" disabled={isSubmitting}>{isSubmitting ? 'Saving…' : <><Check size={15} /> {isEditing ? 'Save changes' : 'Save application'}</>}</button></div></div>
      </form>
    </motion.section>
  </motion.div>
}

function ApplicationDrawer({ application, onClose, onEdit, onDelete }: { application: PlacementApplication; onClose: () => void; onEdit: (app: PlacementApplication) => void; onDelete: (id: string) => void }) {
  const [tab, setTab] = useState<'Overview' | 'Resume' | 'Rounds' | 'Notes'>('Overview')
  const saveApplication = useTracker((state) => state.saveApplication)
  const [roundName, setRoundName] = useState('')
  const [roundDate, setRoundDate] = useState('')
  const [roundNotes, setRoundNotes] = useState('')
  const addRound = async () => {
    if (!roundName.trim()) return toast.error('Enter a round name')
    try {
      await saveApplication({ ...application, rounds: [...application.rounds, { id: crypto.randomUUID(), name: roundName.trim(), date: roundDate || undefined, notes: roundNotes, completed: false }] })
      setRoundName(''); setRoundDate(''); setRoundNotes('')
      toast.success('Interview round added')
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not add round') }
  }
  const toggleCompleted = async (roundId: string) => {
    const rounds = application.rounds.map((round) => round.id === roundId ? { ...round, completed: !round.completed } : round)
    try { await saveApplication({ ...application, rounds }); toast.success('Round updated') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not update round') }
  }
  const setRoundOutcome = async (roundId: string, value: string) => {
    const rounds = application.rounds.map((round) => round.id === roundId
      ? { ...round, completed: true, passed: value === 'passed' }
      : round)
    try { await saveApplication({ ...application, rounds }); toast.success('Round outcome saved') } catch (error) { toast.error(error instanceof Error ? error.message : 'Could not save outcome') }
  }
  return <motion.div className="drawer-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <motion.aside className="application-drawer" initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} transition={{ type: 'spring', damping: 27, stiffness: 260 }} role="dialog" aria-modal="true" aria-label={`${application.company} application details`}>
      <div className="drawer-top"><span className="drawer-eyebrow">APPLICATION DETAILS</span><button className="icon-button" onClick={onClose} aria-label="Close details"><X size={18} /></button></div>
      <div className="drawer-company"><CompanyMark company={application.company} className="large" /><div><h2>{application.company}</h2><p>{application.role}</p></div><button className="button button-secondary button-small" onClick={() => onEdit(application)}>Edit</button></div>
      <div className="drawer-chip-row"><span className={`status-pill ${statusClass[application.status]}`}><i />{application.status}</span>{application.ctc && <span className="drawer-meta">{application.ctc}</span>}{application.location && <span className="drawer-meta"><MapPin size={13} />{application.location}</span>}</div>
      <div className="drawer-tabs">{(['Overview', 'Resume', 'Rounds', 'Notes'] as const).map((item) => <button key={item} className={tab === item ? 'active' : ''} onClick={() => setTab(item)}>{item}{item === 'Rounds' && application.rounds.length > 0 && <span>{application.rounds.length}</span>}</button>)}</div>
      <div className="drawer-body">
        {tab === 'Overview' && <><div className="detail-pairs"><div><span>Applied</span><strong>{application.appliedDate ? format(parseISO(application.appliedDate), 'MMM d, yyyy') : 'Not applied yet'}</strong></div><div><span>Deadline</span><strong>{application.deadline ? format(parseISO(application.deadline), 'MMM d, yyyy') : 'No deadline'}</strong></div><div><span>Created</span><strong>{format(parseISO(application.createdAt), 'MMM d, yyyy')}</strong></div><div><span>Last updated</span><strong>{format(parseISO(application.updatedAt), 'MMM d, yyyy')}</strong></div></div>
          {application.jobDescription && <div className="drawer-section"><h3>Job description</h3><p className="preserve-lines">{application.jobDescription}</p></div>}
          <div className="drawer-section"><h3>Timeline</h3><div className="timeline-entry"><span className="timeline-dot" /><div><strong>{application.status}</strong><small>{format(parseISO(application.updatedAt), 'MMM d, yyyy')}</small></div></div><div className="timeline-entry"><span className="timeline-dot muted" /><div><strong>Application created</strong><small>{format(parseISO(application.createdAt), 'MMM d, yyyy')}</small></div></div></div></>}
        {tab === 'Resume' && <div className="drawer-section">{application.linkedResumeName ? <><div className="linked-resume"><FileText size={18} /><div><strong>{application.linkedResumeName}</strong><small>Linked to this application</small></div></div><h3>Extracted text</h3><p className="resume-extract">{application.linkedResumeText || 'No extracted text available.'}</p></> : <div className="drawer-empty"><FileText size={19} /><p>No resume linked yet. Edit this application to attach one from your library.</p></div>}</div>}
        {tab === 'Rounds' && <div className="drawer-section"><h3>Interview rounds</h3>{application.rounds.length === 0 && <div className="drawer-empty"><Users size={18} /><p>No rounds yet. Add an assessment, interview, or hiring manager call.</p></div>}
          {application.rounds.map((round) => <div className={`round-row ${round.completed ? 'complete' : ''}`} key={round.id}><button className="round-check" onClick={() => void toggleCompleted(round.id)} aria-label={round.completed ? 'Mark round incomplete' : 'Mark round complete'}>{round.completed && <Check size={13} />}</button><div className="round-copy"><strong>{round.name}</strong><small>{round.date ? format(parseISO(round.date), 'MMM d, yyyy') : 'No date scheduled'}{round.completed ? ' · Completed' : ''}</small>{round.notes && <p>{round.notes}</p>}{round.completed && <select className="round-outcome" aria-label={`${round.name} outcome`} value={round.passed === undefined ? '' : round.passed ? 'passed' : 'failed'} onChange={(event) => event.target.value && void setRoundOutcome(round.id, event.target.value)}><option value="">Set outcome…</option><option value="passed">Passed</option><option value="failed">Not passed</option></select>}</div></div>)}
          <div className="add-round"><input value={roundName} onChange={(event) => setRoundName(event.target.value)} placeholder="e.g. Technical interview" /><input value={roundDate} onChange={(event) => setRoundDate(event.target.value)} type="date" aria-label="Round date" /><textarea value={roundNotes} onChange={(event) => setRoundNotes(event.target.value)} placeholder="Preparation notes…" rows={2} /><button className="button button-secondary button-small" onClick={() => void addRound()}><Plus size={14} /> Add round</button></div>
        </div>}
        {tab === 'Notes' && <div className="drawer-section"><h3>Personal notes</h3><p className="preserve-lines">{application.customNotes || 'No notes yet. Use Edit to add your personal notes or recruiter communication.'}</p>{application.rejectionReason && <><h3 className="notes-subhead">Rejection reason</h3><p>{application.rejectionReason}</p></>}</div>}
      </div>
      <div className="drawer-footer"><span>Updated {formatDistance(application.updatedAt)}</span><button className="button button-danger" onClick={() => onDelete(application.id)}><Trash2 size={14} /> Delete application</button></div>
    </motion.aside>
  </motion.div>
}

function DocumentPreview({ resume, onClose }: { resume: ResumeDocument; onClose: () => void }) {
  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <motion.section className="document-modal" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} role="dialog" aria-modal="true" aria-label="Resume text preview">
      <div className="modal-header"><div><span className="modal-kicker">LOCAL EXTRACTION</span><h2>{resume.name}</h2><p>{resume.skills.length} identified skills · {formatBytes(resume.fileSize)}</p></div><button className="icon-button" onClick={onClose} aria-label="Close preview"><X size={18} /></button></div>
      <div className="preview-skills">{resume.skills.length ? resume.skills.map((skill) => <span key={skill}>{skill}</span>) : <span>No skills detected</span>}</div>
      <pre className="extracted-preview">{resume.extractedText}</pre>
    </motion.section>
  </motion.div>
}

export default App
