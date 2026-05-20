'use client'

import { useEffect, useState, useMemo } from 'react'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'
import { 
  LayoutDashboard, 
  Users, 
  UserRound, 
  Link as LinkIcon, 
  LogOut, 
  ChevronLeft, 
  AlertTriangle, 
  Clock, 
  Smartphone,
  GraduationCap,
  MoreHorizontal,
  Search,
  ArrowRight,
  TrendingUp,
  ShieldCheck
} from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f43f5e', '#f59e0b', '#10b981', '#06b6d4', '#3b82f6']
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const GRADES = ['Grade 9', 'Grade 10', 'Grade 11', 'Grade 12']

const GRADE_THEMES: Record<string, any> = {
  'Grade 9': {
    primary: '#3b82f6',
    gradient: 'from-blue-600 to-cyan-500',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    text: 'text-blue-400',
    icon: '9'
  },
  'Grade 10': {
    primary: '#8b5cf6',
    gradient: 'from-purple-600 to-pink-500',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/20',
    text: 'text-purple-400',
    icon: '10'
  },
  'Grade 11': {
    primary: '#10b981',
    gradient: 'from-emerald-600 to-teal-500',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/20',
    text: 'text-emerald-400',
    icon: '11'
  },
  'Grade 12': {
    primary: '#f59e0b',
    gradient: 'from-amber-600 to-orange-500',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/20',
    text: 'text-amber-400',
    icon: '12'
  },
}

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [gradeStats, setGradeStats] = useState<Record<string, any>>({})
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null)
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [usage, setUsage] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [totalTime, setTotalTime] = useState(0)
  const [filter, setFilter] = useState<'today' | 'week' | 'month'>('week')
  const [activeTab, setActiveTab] = useState<'grades' | 'teachers' | 'links'>('grades')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedStudentLink, setSelectedStudentLink] = useState('')
  const [message, setMessage] = useState('')
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [studentWarnings, setStudentWarnings] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'grades' | 'students' | 'detail'>('grades')
  const [searchQuery, setSearchQuery] = useState('')
  const router = useRouter()

  useEffect(() => { checkAdmin(); fetchAll() }, [])
  useEffect(() => { if (selectedStudent) fetchUsage(selectedStudent.id) }, [filter])

  const checkAdmin = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) { router.push('/login'); return }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.user.id).single()
    if (profile?.role !== 'admin') router.push('/login')
  }

  const fetchAll = async () => {
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student')
    const { data: t } = await supabase.from('profiles').select('*').eq('role', 'teacher')
    setStudents(s || [])
    setTeachers(t || [])

    const warnings: Record<string, boolean> = {}
    const stats: Record<string, any> = {}
    const today = new Date(); today.setHours(0, 0, 0, 0)

    for (const grade of GRADES) {
      const gradeStudents = (s || []).filter((st: any) => st.grade === grade)
      let totalSeconds = 0
      for (const student of gradeStudents) {
        const { data: rec } = await supabase
          .from('usage_records').select('duration_seconds')
          .eq('student_id', student.id).gte('start_time', today.toISOString())
        const t = (rec || []).reduce((a: number, b: any) => a + (b.duration_seconds || 0), 0)
        totalSeconds += t
        warnings[student.id] = t > 5 * 3600
      }
      stats[grade] = {
        count: gradeStudents.length,
        totalSeconds,
        avgSeconds: gradeStudents.length > 0 ? Math.round(totalSeconds / gradeStudents.length) : 0
      }
    }
    setGradeStats(stats)
    setStudentWarnings(warnings)
  }

  const fetchUsage = async (studentId: string) => {
    setLoadingUsage(true)
    const now = new Date()
    let fromDate = new Date()
    if (filter === 'today') fromDate.setHours(0, 0, 0, 0)
    else if (filter === 'week') fromDate.setDate(now.getDate() - 7)
    else fromDate.setMonth(now.getMonth() - 1)

    const { data } = await supabase
      .from('usage_records').select('app_name, duration_seconds, start_time')
      .eq('student_id', studentId).gte('start_time', fromDate.toISOString())
      .order('start_time', { ascending: false })

    const map: Record<string, number> = {}
    data?.forEach(r => {
      const name = r.app_name.split('.').pop() || r.app_name
      map[name] = (map[name] || 0) + (r.duration_seconds || 0)
    })
    const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 10)
      .map(([name, seconds]) => ({ name, minutes: Math.round(seconds / 60), seconds }))
    setUsage(sorted)
    setTotalTime(sorted.reduce((a, b) => a + b.seconds, 0))

    const dayMap: Record<number, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 }
    data?.forEach(r => { const d = new Date(r.start_time).getDay(); dayMap[d] = (dayMap[d] || 0) + (r.duration_seconds || 0) })
    setDailyData(DAYS.map((name, i) => ({ name, hours: parseFloat((dayMap[i] / 3600).toFixed(1)), warning: dayMap[i] > 5 * 3600 })))

    const monthMap: Record<number, number> = {}
    data?.forEach(r => { const m = new Date(r.start_time).getMonth(); monthMap[m] = (monthMap[m] || 0) + (r.duration_seconds || 0) })
    const last6 = []
    for (let i = 5; i >= 0; i--) {
      const m = (now.getMonth() - i + 12) % 12
      last6.push({ name: MONTHS[m], hours: parseFloat(((monthMap[m] || 0) / 3600).toFixed(1)) })
    }
    setMonthlyData(last6)
    setLoadingUsage(false)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const linkTeacherStudent = async () => {
    if (!selectedTeacher || !selectedStudentLink) { setMessage('Select both'); return }
    const { error } = await supabase.from('teacher_student_links').insert({ teacher_id: selectedTeacher, student_id: selectedStudentLink })
    setMessage(error ? 'Error: ' + error.message : 'Linked successfully!')
    setTimeout(() => setMessage(''), 3000)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-slate-900/90 backdrop-blur-md border border-white/10 rounded-xl p-3 shadow-2xl">
        <p className="text-white font-bold text-xs mb-1 uppercase tracking-wider">{label}</p>
        <p className="text-indigo-400 text-lg font-black">
          {payload[0].value} {payload[0].name === 'hours' ? 'hrs' : 'min'}
        </p>
      </div>
    )
  }

  const filteredStudents = useMemo(() => {
    let base = selectedGrade ? students.filter(s => s.grade === selectedGrade) : students
    if (searchQuery) {
      base = base.filter(s => 
        s.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) || 
        s.email?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }
    return base
  }, [students, selectedGrade, searchQuery])

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 font-sans selection:bg-indigo-500/30">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
        <div className="absolute top-[20%] right-[10%] w-[30%] h-[30%] rounded-full bg-blue-600/5 blur-[100px]" />
      </div>

      <div className="flex relative z-10">
        {/* Sidebar */}
        <aside className="w-64 h-screen sticky top-0 border-r border-white/5 bg-slate-950/50 backdrop-blur-xl flex flex-col">
          <div className="p-6">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-blue-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                <Smartphone className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="font-black text-white tracking-tight text-xl">AppMeter</h1>
                <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-[0.2em]">Admin Portal</p>
              </div>
            </div>

            <nav className="space-y-1">
              {[
                { id: 'grades', icon: LayoutDashboard, label: 'Overview' },
                { id: 'teachers', icon: Users, label: 'Teachers' },
                { id: 'links', icon: LinkIcon, label: 'Connections' },
              ].map((item) => (
                <button
                  key={item.id}
                  onClick={() => { setActiveTab(item.id as any); setView('grades'); setSelectedStudent(null); setSelectedGrade(null) }}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${
                    activeTab === item.id 
                      ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' 
                      : 'text-slate-400 hover:text-white hover:bg-white/5'
                  }`}
                >
                  <item.icon className={`w-5 h-5 ${activeTab === item.id ? 'text-indigo-400' : 'text-slate-500'}`} />
                  {item.label}
                </button>
              ))}
            </nav>
          </div>

          <div className="mt-auto p-6 border-t border-white/5">
            <button 
              onClick={logout}
              className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/5 transition-all"
            >
              <LogOut className="w-5 h-5" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          {/* Top Bar */}
          <header className="h-20 border-b border-white/5 bg-slate-950/20 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-20">
            <div className="flex items-center gap-4">
              {view !== 'grades' && (
                <button 
                  onClick={() => { setView(view === 'detail' ? 'students' : 'grades'); setSelectedStudent(null) }}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-all"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-lg font-bold text-white capitalize">
                {activeTab === 'grades' ? (view === 'grades' ? 'Dashboard Overview' : (view === 'students' ? `${selectedGrade} Students` : 'Student Analysis')) : activeTab}
              </h2>
            </div>

            <div className="flex items-center gap-6">
              <div className="relative group">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input 
                  type="text" 
                  placeholder="Search students..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-slate-900/50 border border-white/5 rounded-full py-2 pl-10 pr-4 text-sm w-64 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/30 transition-all"
                />
              </div>
              <div className="flex items-center gap-3 pl-6 border-l border-white/5">
                <div className="w-8 h-8 rounded-full bg-slate-800 border border-white/10 flex items-center justify-center">
                  <UserRound className="w-4 h-4 text-slate-400" />
                </div>
                <span className="text-sm font-medium text-slate-300">Admin</span>
              </div>
            </div>
          </header>

          <div className="p-8 max-w-7xl mx-auto">
            {/* GRADES TAB */}
            {activeTab === 'grades' && (
              <>
                {view === 'grades' && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      {[
                        { label: 'Active Students', value: students.length, icon: GraduationCap, color: 'indigo' },
                        { label: 'Faculty Members', value: teachers.length, icon: Users, color: 'fuchsia' },
                        { label: 'System Alerts', value: Object.values(studentWarnings).filter(Boolean).length, icon: AlertTriangle, color: 'rose' },
                      ].map((stat, i) => (
                        <div key={i} className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden group">
                          <div className={`absolute top-0 right-0 p-8 opacity-[0.03] group-hover:opacity-[0.07] transition-opacity`}>
                            <stat.icon className="w-24 h-24" />
                          </div>
                          <div className="flex items-center gap-4 mb-4">
                            <div className={`p-3 rounded-2xl bg-${stat.color}-500/10 text-${stat.color}-400`}>
                              <stat.icon className="w-6 h-6" />
                            </div>
                            <span className="text-slate-400 text-sm font-medium">{stat.label}</span>
                          </div>
                          <div className="flex items-baseline gap-2">
                            <span className="text-4xl font-black text-white">{stat.value}</span>
                            <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Total</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Grade Cards */}
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
                          <TrendingUp className="w-4 h-4 text-indigo-400" />
                          Class Performance
                        </h3>
                      </div>
                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {GRADES.map(grade => {
                          const theme = GRADE_THEMES[grade]
                          const stats = gradeStats[grade] || { count: 0, totalSeconds: 0, avgSeconds: 0 }
                          const gradeWarnings = students.filter(s => s.grade === grade && studentWarnings[s.id]).length
                          const pct = Math.min(Math.round((stats.avgSeconds / (5 * 3600)) * 100), 100)

                          return (
                            <div key={grade}
                              onClick={() => { setSelectedGrade(grade); setView('students') }}
                              className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 cursor-pointer group hover:bg-slate-900/60 hover:border-indigo-500/20 transition-all duration-300"
                            >
                              <div className="flex items-start justify-between mb-6">
                                <div className="flex items-center gap-4">
                                  <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-xl font-black text-white shadow-lg`}>
                                    {theme.icon}
                                  </div>
                                  <div>
                                    <h4 className="text-xl font-black text-white">{grade}</h4>
                                    <p className="text-sm text-slate-400">{stats.count} Enrolled Students</p>
                                  </div>
                                </div>
                                {gradeWarnings > 0 && (
                                  <div className="bg-rose-500/10 text-rose-400 px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 border border-rose-500/20">
                                    <AlertTriangle className="w-3 h-3" />
                                    {gradeWarnings} Alerts
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-2 gap-4 mb-6">
                                <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5">
                                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Daily Usage</p>
                                  <p className="text-lg font-black text-white">{formatTime(stats.totalSeconds)}</p>
                                </div>
                                <div className="bg-white/[0.02] rounded-2xl p-4 border border-white/5">
                                  <p className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">Avg / Student</p>
                                  <p className="text-lg font-black text-white">{formatTime(stats.avgSeconds)}</p>
                                </div>
                              </div>

                              <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest">
                                  <span className="text-slate-500">Daily Limit Utilization</span>
                                  <span className={pct > 80 ? 'text-rose-400' : 'text-indigo-400'}>{pct}%</span>
                                </div>
                                <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${theme.gradient}`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Chart Section */}
                    <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                      <div className="flex items-center justify-between mb-8">
                        <div>
                          <h3 className="text-lg font-bold text-white">Usage Comparison</h3>
                          <p className="text-sm text-slate-400">Average daily screen time across grades</p>
                        </div>
                      </div>
                      <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={GRADES.map(g => ({
                            name: g, hours: parseFloat(((gradeStats[g]?.avgSeconds || 0) / 3600).toFixed(1))
                          }))}>
                            <XAxis 
                              dataKey="name" 
                              tick={{ fill: '#64748b', fontSize: 12, fontWeight: 600 }} 
                              axisLine={false} 
                              tickLine={false}
                              dy={10}
                            />
                            <YAxis 
                              tick={{ fill: '#64748b', fontSize: 12 }} 
                              axisLine={false} 
                              tickLine={false}
                              dx={-10}
                            />
                            <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                            <Bar dataKey="hours" radius={[10, 10, 0, 0]} barSize={60}>
                              {GRADES.map((g, i) => (
                                <Cell key={i} fill={Object.values(GRADE_THEMES)[i].primary} />
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  </div>
                )}

                {/* STUDENTS LIST */}
                {view === 'students' && selectedGrade && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`px-4 py-1.5 rounded-full text-xs font-black text-white bg-gradient-to-r ${GRADE_THEMES[selectedGrade].gradient}`}>
                          {selectedGrade}
                        </div>
                        <h3 className="text-2xl font-black text-white">{filteredStudents.length} Students</h3>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {filteredStudents.map(s => {
                        const hasWarning = studentWarnings[s.id]
                        const theme = GRADE_THEMES[selectedGrade]
                        return (
                          <button key={s.id}
                            onClick={() => { setSelectedStudent(s); setView('detail'); fetchUsage(s.id) }}
                            className="text-left bg-slate-900/40 border border-white/5 rounded-3xl p-6 group hover:bg-slate-900/60 hover:border-indigo-500/20 transition-all duration-300"
                          >
                            <div className="flex items-center gap-4 mb-6">
                              <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br ${theme.gradient} flex items-center justify-center text-xl font-black text-white shadow-lg`}>
                                {s.full_name?.[0]?.toUpperCase()}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-black text-white truncate group-hover:text-indigo-400 transition-colors">{s.full_name}</h4>
                                <p className="text-xs text-slate-500 truncate">{s.email}</p>
                              </div>
                            </div>

                            {hasWarning ? (
                              <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6">
                                <div className="flex items-center gap-2 text-rose-400 text-xs font-bold mb-1">
                                  <AlertTriangle className="w-4 h-4" />
                                  Usage Alert
                                </div>
                                <p className="text-[10px] text-rose-400/70">Student has exceeded the 5-hour daily screen time limit.</p>
                              </div>
                            ) : (
                              <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-4 mb-6">
                                <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold mb-1">
                                  <ShieldCheck className="w-4 h-4" />
                                  Status Normal
                                </div>
                                <p className="text-[10px] text-emerald-400/70">Usage is within recommended daily boundaries.</p>
                              </div>
                            )}

                            <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-slate-500 group-hover:text-indigo-400 transition-colors">
                              <span>View Detailed Analysis</span>
                              <ArrowRight className="w-4 h-4" />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* STUDENT DETAIL */}
                {view === 'detail' && selectedStudent && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-8 relative overflow-hidden">
                      <div className={`absolute top-0 right-0 p-12 opacity-[0.03]`}>
                        <UserRound className="w-48 h-48" />
                      </div>
                      
                      <div className="flex flex-col md:flex-row items-center gap-8 relative z-10">
                        <div className={`w-32 h-32 rounded-[32px] bg-gradient-to-br ${GRADE_THEMES[selectedStudent.grade]?.gradient || 'from-indigo-500 to-blue-600'} flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-indigo-500/20`}>
                          {selectedStudent.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div className="text-center md:text-left flex-1">
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mb-2">
                            <h2 className="text-4xl font-black text-white">{selectedStudent.full_name}</h2>
                            {studentWarnings[selectedStudent.id] && (
                              <div className="bg-rose-500/20 text-rose-400 p-2 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                              </div>
                            )}
                          </div>
                          <p className="text-slate-400 mb-4">{selectedStudent.email}</p>
                          <div className="flex flex-wrap items-center justify-center md:justify-start gap-3">
                            <span className={`px-4 py-1.5 rounded-full text-xs font-black text-white bg-gradient-to-r ${GRADE_THEMES[selectedStudent.grade]?.gradient}`}>
                              {selectedStudent.grade}
                            </span>
                            <span className="px-4 py-1.5 rounded-full text-xs font-black text-slate-400 bg-white/5 border border-white/10">
                              ID: {selectedStudent.id.slice(0, 8)}
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

                    {loadingUsage ? (
                      <div className="flex flex-col items-center justify-center h-64 gap-4">
                        <div className="w-12 h-12 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
                        <p className="text-slate-500 font-medium animate-pulse">Aggregating data...</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                        <div className="lg:col-span-2 space-y-8">
                          {/* Main Usage Chart */}
                          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-8">
                              <div>
                                <h3 className="text-lg font-bold text-white">Activity Timeline</h3>
                                <p className="text-sm text-slate-400">Screen time distribution by {filter}</p>
                              </div>
                              <div className="flex items-center gap-2 text-rose-400 text-[10px] font-black uppercase tracking-widest bg-rose-500/10 px-3 py-1.5 rounded-lg border border-rose-500/20">
                                <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                                Limit: 5h
                              </div>
                            </div>
                            <div className="h-[250px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={dailyData}>
                                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <YAxis tick={{ fill: '#64748b', fontSize: 11 }} axisLine={false} tickLine={false} />
                                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                  <Bar dataKey="hours" radius={[6, 6, 0, 0]}>
                                    {dailyData.map((d, i) => <Cell key={i} fill={d.warning ? '#f43f5e' : '#6366f1'} />)}
                                  </Bar>
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>

                          {/* App Breakdown */}
                          <div className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden">
                            <div className="p-8 border-b border-white/5 flex items-center justify-between">
                              <h3 className="text-lg font-bold text-white">Application Analysis</h3>
                              <span className="text-xs font-bold text-slate-500">{usage.length} Apps Tracked</span>
                            </div>
                            <div className="divide-y divide-white/5">
                              {usage.map((app, i) => {
                                const appWarning = app.seconds > 3 * 3600
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
                                        {appWarning && (
                                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest">Excessive</span>
                                        )}
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
                              })}
                            </div>
                          </div>
                        </div>

                        <div className="space-y-8">
                          {/* Quick Stats */}
                          <div className="grid grid-cols-1 gap-4">
                            {[
                              { label: 'Total Time', value: formatTime(totalTime), icon: Clock, color: 'indigo' },
                              { label: 'Applications', value: usage.length, icon: Smartphone, color: 'fuchsia' },
                              { label: 'Most Used', value: usage[0]?.name || '--', icon: TrendingUp, color: 'emerald' },
                            ].map((s, i) => (
                              <div key={i} className="bg-slate-900/40 border border-white/5 rounded-3xl p-6 relative overflow-hidden">
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

                          {/* Monthly Summary */}
                          <div className="bg-slate-900/40 border border-white/5 rounded-3xl p-8">
                            <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-8">Monthly Trend</h3>
                            <div className="h-[200px] w-full">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={monthlyData}>
                                  <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
                                  <Tooltip cursor={{ fill: 'rgba(255,255,255,0.03)' }} content={<CustomTooltip />} />
                                  <Bar dataKey="hours" radius={[4, 4, 0, 0]} fill="#6366f1" />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}

            {/* TEACHERS TAB */}
            {activeTab === 'teachers' && (
              <div className="bg-slate-900/40 border border-white/5 rounded-3xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="p-8 border-b border-white/5 flex items-center justify-between">
                  <div>
                    <h3 className="text-xl font-black text-white">Faculty Directory</h3>
                    <p className="text-sm text-slate-400">Manage all registered teachers and their access</p>
                  </div>
                  <button className="bg-indigo-500 hover:bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-all shadow-lg shadow-indigo-500/20">
                    Add Teacher
                  </button>
                </div>
                <div className="divide-y divide-white/5">
                  {teachers.map(t => (
                    <div key={t.id} className="flex items-center justify-between p-6 hover:bg-white/[0.02] transition-colors">
                      <div className="flex items-center gap-4">
                        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-600 to-pink-500 flex items-center justify-center text-xl font-black text-white shadow-lg">
                          {t.full_name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-white text-lg">{t.full_name}</p>
                          <p className="text-sm text-slate-500">{t.email}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20">
                          Faculty
                        </span>
                        <button className="p-2 rounded-lg hover:bg-white/5 text-slate-500 hover:text-white transition-all">
                          <MoreHorizontal className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  ))}
                  {teachers.length === 0 && (
                    <div className="p-20 text-center">
                      <Users className="w-16 h-16 text-slate-800 mx-auto mb-4" />
                      <p className="text-slate-500 font-medium">No faculty members found</p>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* LINKS TAB */}
            {activeTab === 'links' && (
              <div className="max-w-2xl mx-auto animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-slate-900/40 border border-white/5 rounded-[40px] p-10">
                  <div className="text-center mb-10">
                    <div className="w-20 h-20 rounded-[28px] bg-indigo-500/10 text-indigo-400 flex items-center justify-center mx-auto mb-6 border border-indigo-500/20">
                      <LinkIcon className="w-10 h-10" />
                    </div>
                    <h3 className="text-3xl font-black text-white mb-2">Connect Faculty</h3>
                    <p className="text-slate-400">Establish monitoring links between teachers and students</p>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Select Teacher</label>
                      <select 
                        value={selectedTeacher} 
                        onChange={e => setSelectedTeacher(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all appearance-none"
                      >
                        <option value="">Choose a faculty member...</option>
                        {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Select Student</label>
                      <select 
                        value={selectedStudentLink} 
                        onChange={e => setSelectedStudentLink(e.target.value)}
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all appearance-none"
                      >
                        <option value="">Choose a student...</option>
                        {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.grade})</option>)}
                      </select>
                    </div>

                    <button 
                      onClick={linkTeacherStudent}
                      className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] mt-4"
                    >
                      Establish Connection
                    </button>

                    {message && (
                      <div className={`p-4 rounded-2xl text-center text-sm font-bold animate-in zoom-in duration-300 ${
                        message.includes('Error') ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      }`}>
                        {message}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
