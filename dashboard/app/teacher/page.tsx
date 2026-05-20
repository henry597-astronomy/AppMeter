'use client'

import { useEffect, useState, useMemo } from 'react'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, 
  ResponsiveContainer, Cell 
} from 'recharts'
import { useRouter } from 'next/navigation'
import { 
  UserRound, 
  LogOut, 
  Clock, 
  Smartphone,
  Search,
  TrendingUp,
  ShieldCheck,
  GraduationCap,
  Loader2
} from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [usage, setUsage] = useState<any[]>([])
  const [filter, setFilter] = useState<'today'|'week'|'month'>('today')
  const [loading, setLoading] = useState(false)
  const [totalTime, setTotalTime] = useState(0)
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => { if (selected) fetchUsage(selected.student_id) }, [filter])

  const fetchStudents = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) { router.push('/login'); return }
    const { data } = await supabase
      .from('teacher_student_links')
      .select('student_id, profiles!teacher_student_links_student_id_fkey(full_name, id, email, grade)')
      .eq('teacher_id', user.user.id)
    setStudents(data || [])
  }

  const fetchUsage = async (studentId: string) => {
    setLoading(true)
    const now = new Date()
    let fromDate = new Date()
    if (filter === 'today') fromDate.setHours(0,0,0,0)
    else if (filter === 'week') fromDate.setDate(now.getDate() - 7)
    else fromDate.setMonth(now.getMonth() - 1)

    const { data } = await supabase
      .from('usage_records')
      .select('app_name, duration_seconds')
      .eq('student_id', studentId)
      .gte('start_time', fromDate.toISOString())

    const map: Record<string, number> = {}
    data?.forEach(r => {
      const name = r.app_name.split('.').pop() || r.app_name
      map[name] = (map[name] || 0) + (r.duration_seconds || 0)
    })

    const sorted = Object.entries(map)
      .sort((a,b) => b[1]-a[1])
      .slice(0, 10)
      .map(([name, seconds]) => ({ name, minutes: Math.round(seconds/60), seconds }))

    setUsage(sorted)
    setTotalTime(sorted.reduce((a,b) => a + b.seconds, 0))
    setLoading(false)
  }

  const selectStudent = (s: any) => {
    setSelected(s)
    fetchUsage(s.student_id)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s/3600)
    const m = Math.floor((s%3600)/60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const filteredStudents = useMemo(() => {
    if (!searchQuery) return students
    return students.filter(s => 
      s.profiles?.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      s.profiles?.email?.toLowerCase().includes(searchQuery.toLowerCase())
    )
  }, [students, searchQuery])

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-lg p-2 shadow-2xl">
        <p className="text-white font-bold text-[10px] mb-0.5 uppercase tracking-wider">{label}</p>
        <p className="text-indigo-400 text-sm font-black">
          {payload[0].value} min
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30 flex">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      {/* Sidebar - Reduced Width */}
      <aside className="w-64 h-screen sticky top-0 border-r border-white/5 bg-slate-950/50 backdrop-blur-xl flex flex-col shrink-0">
        <div className="p-6">
          <div className="flex items-center gap-2.5 mb-8">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
              <Smartphone className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-black text-white tracking-tight text-lg leading-tight">AppMeter</h1>
              <p className="text-[8px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Faculty</p>
            </div>
          </div>

          <div className="relative group mb-6">
            <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
            <input 
              type="text" 
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900/50 border border-white/5 rounded-xl py-2 pl-9 pr-4 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all"
            />
          </div>

          <div className="space-y-1.5 overflow-y-auto max-h-[calc(100vh-280px)] pr-1 custom-scrollbar">
            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">My Students</p>
            {filteredStudents.length === 0 ? (
              <div className="p-6 text-center bg-white/5 rounded-2xl border border-white/5">
                <p className="text-[10px] text-slate-500 font-medium">None found</p>
              </div>
            ) : (
              filteredStudents.map((s: any) => (
                <button
                  key={s.student_id}
                  onClick={() => selectStudent(s)}
                  className={`w-full text-left p-3 rounded-xl transition-all duration-300 group ${
                    selected?.student_id === s.student_id
                      ? 'bg-indigo-500/10 border border-indigo-500/10'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black transition-all duration-300 ${
                      selected?.student_id === s.student_id
                        ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg'
                        : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'
                    }`}>
                      {s.profiles?.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className={`text-[13px] font-bold truncate transition-colors ${
                        selected?.student_id === s.student_id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                      }`}>
                        {s.profiles?.full_name}
                      </p>
                      <p className="text-[8px] text-slate-500 font-bold uppercase tracking-wider">
                        {s.profiles?.grade || 'N/A'}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="mt-auto p-6 border-t border-white/5">
          <button onClick={logout} className="w-full flex items-center gap-2.5 px-3 py-3 rounded-xl text-xs font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all">
            <LogOut className="w-4 h-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-w-0">
        <header className="h-14 border-b border-white/5 bg-slate-950/20 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
          <h2 className="text-sm font-bold text-white">
            {selected ? 'Student Analysis' : 'Dashboard'}
          </h2>
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
              <UserRound className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <span className="text-xs font-bold text-slate-300">Faculty</span>
          </div>
        </header>

        <div className="p-8 max-w-5xl mx-auto">
          {selected ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
                <div className="flex flex-col md:flex-row items-center gap-6 relative z-10">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-3xl font-black text-white shadow-xl shadow-indigo-500/10">
                    {selected.profiles?.full_name?.[0]?.toUpperCase()}
                  </div>
                  <div className="text-center md:text-left flex-1">
                    <h2 className="text-2xl font-black text-white mb-1">{selected.profiles?.full_name}</h2>
                    <p className="text-xs text-slate-400 mb-3">{selected.profiles?.email}</p>
                    <div className="flex flex-wrap items-center justify-center md:justify-start gap-2">
                      <span className="px-3 py-1 rounded-full text-[10px] font-black text-white bg-indigo-500/20 border border-indigo-500/10">
                        {selected.profiles?.grade}
                      </span>
                    </div>
                  </div>
                  <div className="flex bg-slate-950/50 p-1 rounded-xl border border-white/5">
                    {(['today', 'week', 'month'] as const).map(f => (
                      <button key={f} onClick={() => setFilter(f)}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-all duration-200 ${
                          filter === f ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/10' : 'text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        {f}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {loading ? (
                <div className="flex flex-col items-center justify-center h-64 gap-3">
                  <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                  <p className="text-xs text-slate-500 font-medium">Analyzing...</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="lg:col-span-2 space-y-6">
                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl p-6">
                      <h3 className="text-sm font-bold text-white mb-6">Activity Timeline</h3>
                      <div className="h-[200px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={usage}>
                            <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 9, fontWeight: 600 }} axisLine={false} tickLine={false} dy={5} />
                            <YAxis tick={{ fill: '#64748b', fontSize: 9 }} axisLine={false} tickLine={false} dx={-5} />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                            <Bar dataKey="minutes" radius={[5, 5, 0, 0]} barSize={30}>
                              {usage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-slate-900/40 border border-white/5 rounded-2xl overflow-hidden">
                      <div className="p-5 border-b border-white/5 flex items-center justify-between">
                        <h3 className="text-sm font-bold text-white">App Breakdown</h3>
                      </div>
                      <div className="divide-y divide-white/5">
                        {usage.length > 0 ? usage.map((app, i) => {
                          const pct = Math.round((app.seconds / totalTime) * 100)
                          return (
                            <div key={app.name} className="p-4 hover:bg-white/[0.02] transition-colors">
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center text-xs shadow-inner">{app.name[0].toUpperCase()}</div>
                                  <div>
                                    <p className="text-[13px] font-bold text-white">{app.name}</p>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">{pct}% of total</p>
                                  </div>
                                </div>
                                <p className="text-sm font-black text-white">{formatTime(app.seconds)}</p>
                              </div>
                              <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${pct}%`, backgroundColor: COLORS[i % COLORS.length] }} />
                              </div>
                            </div>
                          )
                        }) : (
                          <div className="p-16 text-center text-slate-500 text-xs">No records found</div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="grid grid-cols-1 gap-3">
                      {[
                        { label: 'Total Usage', value: formatTime(totalTime), icon: Clock, color: 'indigo' },
                        { label: 'Unique Apps', value: usage.length, icon: Smartphone, color: 'fuchsia' },
                        { label: 'Primary App', value: usage[0]?.name || '--', icon: TrendingUp, color: 'emerald' },
                      ].map((s, i) => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 rounded-2xl p-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-${s.color}-500/10 text-${s.color}-400`}><s.icon className="w-4 h-4" /></div>
                            <div>
                              <p className="text-slate-500 text-[9px] font-bold uppercase tracking-wider mb-0.5">{s.label}</p>
                              <p className="text-base font-black text-white truncate max-w-[120px]">{s.value}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="bg-indigo-600/10 border border-indigo-500/10 rounded-3xl p-6">
                      <div className="flex items-center gap-2 mb-3">
                        <ShieldCheck className="w-4 h-4 text-indigo-400" />
                        <h4 className="text-xs font-bold text-white">Insights</h4>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">Review usage trends to support student focus and well-being.</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-[50vh] text-center animate-in fade-in zoom-in duration-700">
              <div className="w-16 h-16 rounded-2xl bg-slate-900/50 border border-white/5 flex items-center justify-center mb-6">
                <GraduationCap className="w-8 h-8 text-slate-600" />
              </div>
              <h3 className="text-xl font-black text-white mb-1">Select Student</h3>
              <p className="text-xs text-slate-500 max-w-[200px] mx-auto">Choose a student from the sidebar to begin analysis.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
