import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

type MonthlyCount = { month: string; applications?: number; count?: number }
type StatusValue = { name: string; value: number; color: string }
type PackageValue = { company: string; package: number }

const tooltipStyle = { background: '#161c29', border: '1px solid #293144', borderRadius: 10, color: '#e5e9f2' }
const axisStyle = { fill: '#7d8798', fontSize: 11 }

export function ActivityAreaChart({ data }: { data: MonthlyCount[] }) {
  return <ResponsiveContainer width="100%" height="100%"><AreaChart data={data} margin={{ top: 8, right: 6, left: -20, bottom: 0 }}>
    <defs><linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8a83ff" stopOpacity={0.28} /><stop offset="95%" stopColor="#8a83ff" stopOpacity={0} /></linearGradient></defs>
    <CartesianGrid stroke="#252b3a" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={10} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axisStyle} />
    <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: '#5d5bef', strokeDasharray: '4 4' }} />
    <Area type="monotone" dataKey="applications" stroke="#938bff" strokeWidth={2.4} fill="url(#activityGradient)" activeDot={{ r: 4, fill: '#a29cff' }} />
  </AreaChart></ResponsiveContainer>
}

export function StatusDonut({ data, total }: { data: StatusValue[]; total: number }) {
  return <div className="donut-wrap">
    {total === 0 ? <div className="chart-empty"><span>—</span><p>Add an application to see your status mix.</p></div> : <>
      <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={data} dataKey="value" nameKey="name" innerRadius={66} outerRadius={88} paddingAngle={4} stroke="none" cornerRadius={4}>{data.map((item) => <Cell key={item.name} fill={item.color} />)}</Pie><Tooltip contentStyle={tooltipStyle} /></PieChart></ResponsiveContainer>
      <div className="donut-total"><strong>{total}</strong><span>total</span></div>
    </>}
  </div>
}

export function MonthlyBarChart({ data }: { data: MonthlyCount[] }) {
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}><CartesianGrid stroke="#252b3a" vertical={false} /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={axisStyle} dy={8} /><YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="count" fill="#8884f7" radius={[5, 5, 0, 0]} maxBarSize={38} /></BarChart></ResponsiveContainer>
}

export function PackageBarChart({ data }: { data: PackageValue[] }) {
  return <ResponsiveContainer width="100%" height="100%"><BarChart data={data} layout="vertical" margin={{ left: 8, right: 8, top: 0, bottom: 0 }}><CartesianGrid stroke="#252b3a" horizontal={false} /><XAxis type="number" hide /><YAxis type="category" dataKey="company" width={72} axisLine={false} tickLine={false} tick={axisStyle} /><Tooltip contentStyle={tooltipStyle} /><Bar dataKey="package" fill="#4fc5a1" radius={[0, 5, 5, 0]} maxBarSize={18} /></BarChart></ResponsiveContainer>
}
