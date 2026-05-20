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
  LayoutDashboard, 
  Users, 
  UserRound, 
  LogOut, 
  ChevronLeft, 
  Clock, 
  Smartphone,
  Search,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  AlertTriangle,
  GraduationCap
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
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-white font-bold text-xs mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-indigo-400 text-lg font-black">
          {payload[0].value} min
        </p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <div className="flex relative z-10">
        {/* Sidebar */}
        <aside className="w-80 h-screen sticky top-0 border-r border-white/5 bg-slate-950/50 backdrop-blur-xl flex flex-col">
          <div className="p-8">
            <div className="flex items-center gap-3 mb-10">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-black text-white tracking-tight text-xl">AppMeter</h1>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Faculty Dashboard</p>
              </div>
            </div>

            <div className="relative group mb-8">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
              <input 
                type="text" 
                placeholder="Search students..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900/50 border border-white/5 rounded-2xl py-3 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all"
              />
            </div>

            <div className="space-y-2 overflow-y-auto max-h-[calc(100vh-300px)] pr-2 custom-scrollbar">
              <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1 mb-2">My Students</p>
              {filteredStudents.length === 0 ? (
                <div className="p-8 text-center bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-xs text-slate-500 font-medium">No students found</p>
                </div>
              ) : (
                filteredStudents.map((s: any) => (
                  <button
                    key={s.student_id}
                    onClick={() => selectStudent(s)}
                    className={`w-full text-left p-4 rounded-2xl transition-all duration-300 group ${
                      selected?.student_id === s.student_id
                        ? 'bg-indigo-500/10 border border-indigo-500/20 shadow-lg shadow-indigo-500/5'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-black transition-all duration-300 ${
                        selected?.student_id === s.student_id
                          ? 'bg-gradient-to-br from-indigo-500 to-blue-600 text-white shadow-lg'
                          : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700 group-hover:text-slate-200'
                      }`}>
                        {s.profiles?.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className={`font-bold truncate transition-colors ${
                          selected?.student_id === s.student_id ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                        }`}>
                          {s.profiles?.full_name}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                          {s.profiles?.grade || 'No Grade'}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="mt-auto p-8 border-t border-white/5">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-4 rounded-2xl text-sm font-bold text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all group"
            >
              <LogOut className="w-5 h-5 transition-transform group-hover:-translate-x-1" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <header className="h-24 border-b border-white/5 bg-slate-950/20 backdrop-blur-md flex items-center justify-between px-10 sticky top-0 z-20">
            <div className="flex items-center gap-4">
              <h2 className="text-xl font-black text-white">
                {selected ? 'Student Analysis' : 'Select a Student'}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                <UserRound className="w-5 h-5 text-slate-400" />
              </div>
              <span className="text-sm font-bold text-slate-300">Faculty Member</span>
            </div>
          </header>

          <div className="p-10 max-w-6xl mx-auto">
            {selected ? (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* Student Profile Header */}
                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-8 relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-12 opacity-[0.03]">
                    <GraduationCap className="w-48 h-48" />
                  </div>
                  
                  <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                    <div className="w-32 h-32 rounded-[32px] bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-indigo-500/20">
                      {selected.profiles?.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div className="text-center md:text-left flex-1">
                      <h2 className="text-4xl font-black text-white mb-2">{selected.profiles?.full_name}</h2>
                      <p className="text-slate-400 mb-4">{selected.profiles?.email}</p>
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                        <span className="px-4 py-1.5 rounded-full text-xs font-black text-white bg-indigo-500/20 border border-indigo-500/30">
                          {selected.profiles?.grade}
                        </span>
                        <span className="px-4 py-1.5 rounded-full text-xs font-black text-slate-400 bg-white/5 border border-white/10">
                          ID: {selected.student_id.slice(0, 8)}
                        </span>
                      </div>
                    </div>
                    <div className="flex bg-slate-950/50 p-1.5 rounded-2xl border border-white/5">
                      {(['today', 'week', 'month'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          className={`px-6 py-2.5 rounded-xl text-xs font-bold capitalize transition-all duration-200 ${
                            filter === f ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {loading ? (
                  <div className="flex flex-col items-center justify-center h-96 gap-4">
                    <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                    <p className="text-slate-500 font-medium animate-pulse">Analyzing usage patterns...</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 space-y-8">
                      {/* Usage Chart */}
                      <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-8">
                          <div>
                            <h3 className="text-lg font-bold text-white">Application Activity</h3>
                            <p className="text-sm text-slate-400">Time distribution across top 10 apps (minutes)</p>
                          </div>
                        </div>
                        <div className="h-[300px] w-full">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={usage}>
                              <XAxis 
                                dataKey="name" 
                                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }} 
                                axisLine={false} 
                                tickLine={false}
                                dy={10}
                              />
                              <YAxis 
                                tick={{ fill: '#64748b', fontSize: 11 }} 
                                axisLine={false} 
                                tickLine={false}
                                dx={-10}
                              />
                              <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                              <Bar dataKey="minutes" radius={[8, 8, 0, 0]} barSize={40}>
                                {usage.map((_, i) => (
                                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                ))}
                              </Bar>
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* App List */}
                      <div className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden">
                        <div className="p-8 border-b border-white/5 flex items-center justify-between">
                          <h3 className="text-lg font-bold text-white">App Breakdown</h3>
                          <span className="text-xs font-bold text-slate-500">{usage.length} Apps Tracked</span>
                        </div>
                        <div className="divide-y divide-white/5">
                          {usage.length > 0 ? usage.map((app, i) => {
                            const pct = Math.round((app.seconds / totalTime) * 100)
                            return (
                              <div key={app.name} className="p-6 hover:bg-white/[0.02] transition-colors">
                                <div className="flex items-center justify-between mb-4">
                                  <div className="flex items-center gap-4">
                                    <div className="w-10 h-10 rounded-xl bg-slate-800 flex items-center justify-center text-lg shadow-inner">
                                      {app.name[0].toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="font-bold text-white">{app.name}</p>
                                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{pct}% of total usage</p>
                                    </div>
                                  </div>
                                  <div className="text-right">
                                    <p className="text-lg font-black text-white">{formatTime(app.seconds)}</p>
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all duration-1000" 
                                    style={{ 
                                      width: `${pct}%`, 
                                      backgroundColor: COLORS[i % COLORS.length],
                                      boxShadow: `0 0 12px ${COLORS[i % COLORS.length]}40`
                                    }} 
                                  />
                                </div>
                              </div>
                            )
                          }) : (
                            <div className="p-20 text-center">
                              <p className="text-slate-500 font-medium">No usage recorded for this period</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="space-y-8">
                      {/* Summary Stats */}
                      <div className="grid grid-cols-1 gap-4">
                        {[
                          { label: 'Total Usage', value: formatTime(totalTime), icon: Clock, color: 'indigo' },
                          { label: 'Unique Apps', value: usage.length, icon: Smartphone, color: 'fuchsia' },
                          { label: 'Primary App', value: usage[0]?.name || '--', icon: TrendingUp, color: 'emerald' },
                        ].map((s, i) => (
                          <div key={i} className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                            <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-2xl bg-${s.color}-500/10 text-${s.color}-400`}>
                                <s.icon className="w-6 h-6" />
                              </div>
                              <div>
                                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-0.5">{s.label}</p>
                                <p className="text-xl font-black text-white truncate max-w-[150px]">{s.value}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Safety Card */}
                      <div className="bg-indigo-600/10 border border-indigo-500/20 rounded-[32px] p-8">
                        <div className="flex items-center gap-3 mb-4">
                          <ShieldCheck className="w-6 h-6 text-indigo-400" />
                          <h4 className="font-bold text-white">Faculty Insights</h4>
                        </div>
                        <p className="text-sm text-slate-400 leading-relaxed mb-6">
                          Reviewing app usage helps identify potential distractions and support student well-being.
                        </p>
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <div className="w-1 h-1 rounded-full bg-indigo-400" />
                            Monitor educational app focus
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-300">
                            <div className="w-1 h-1 rounded-full bg-indigo-400" />
                            Track screen time trends
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[60vh] text-center animate-in fade-in zoom-in duration-700">
                <div className="w-24 h-24 rounded-[32px] bg-slate-900/50 border border-white/5 flex items-center justify-center mb-8">
                  <Users className="w-10 h-10 text-slate-600" />
                </div>
                <h3 className="text-2xl font-black text-white mb-2">No Student Selected</h3>
                <p className="text-slate-500 max-w-xs mx-auto">
                  Choose a student from the sidebar to view their application usage and behavioral analysis.
                </p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
