'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell
} from 'recharts'

const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
const GRADES = ['Grade 9','Grade 10','Grade 11','Grade 12']

const GRADE_THEMES: Record<string, any> = {
  'Grade 9':  {
    gradient: 'linear-gradient(135deg, #1D4ED8 0%, #06B6D4 100%)',
    shadow: '0 20px 60px rgba(29,78,216,0.4)',
    badge: 'bg-blue-500/20 text-blue-300 border-blue-400/30',
    bar: '#3b82f6', text: 'text-blue-300', icon: '🔵'
  },
  'Grade 10': {
    gradient: 'linear-gradient(135deg, #7C3AED 0%, #EC4899 100%)',
    shadow: '0 20px 60px rgba(124,58,237,0.4)',
    badge: 'bg-purple-500/20 text-purple-300 border-purple-400/30',
    bar: '#8b5cf6', text: 'text-purple-300', icon: '🟣'
  },
  'Grade 11': {
    gradient: 'linear-gradient(135deg, #059669 0%, #10B981 100%)',
    shadow: '0 20px 60px rgba(5,150,105,0.4)',
    badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30',
    bar: '#10b981', text: 'text-emerald-300', icon: '🟢'
  },
  'Grade 12': {
    gradient: 'linear-gradient(135deg, #D97706 0%, #EF4444 100%)',
    shadow: '0 20px 60px rgba(217,119,6,0.4)',
    badge: 'bg-orange-500/20 text-orange-300 border-orange-400/30',
    bar: '#f59e0b', text: 'text-orange-300', icon: '🟠'
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
  const [filter, setFilter] = useState<'today'|'week'|'month'>('week')
  const [activeTab, setActiveTab] = useState<'grades'|'teachers'|'links'>('grades')
  const [selectedTeacher, setSelectedTeacher] = useState('')
  const [selectedStudentLink, setSelectedStudentLink] = useState('')
  const [message, setMessage] = useState('')
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [studentWarnings, setStudentWarnings] = useState<Record<string, boolean>>({})
  const [view, setView] = useState<'grades'|'students'|'detail'>('grades')
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
    const today = new Date(); today.setHours(0,0,0,0)

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
    if (filter === 'today') fromDate.setHours(0,0,0,0)
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
    const sorted = Object.entries(map).sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([name, seconds]) => ({ name, minutes: Math.round(seconds/60), seconds }))
    setUsage(sorted)
    setTotalTime(sorted.reduce((a,b) => a + b.seconds, 0))

    const dayMap: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
    data?.forEach(r => { const d = new Date(r.start_time).getDay(); dayMap[d] = (dayMap[d]||0) + (r.duration_seconds||0) })
    setDailyData(DAYS.map((name, i) => ({ name, hours: parseFloat((dayMap[i]/3600).toFixed(1)), warning: dayMap[i] > 5*3600 })))

    const monthMap: Record<number, number> = {}
    data?.forEach(r => { const m = new Date(r.start_time).getMonth(); monthMap[m] = (monthMap[m]||0) + (r.duration_seconds||0) })
    const last6 = []
    for (let i = 5; i >= 0; i--) {
      const m = (now.getMonth() - i + 12) % 12
      last6.push({ name: MONTHS[m], hours: parseFloat(((monthMap[m]||0)/3600).toFixed(1)) })
    }
    setMonthlyData(last6)
    setLoadingUsage(false)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const gradeStudents = selectedGrade ? students.filter(s => s.grade === selectedGrade) : []

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
      <div className="bg-gray-900 border border-white/10 rounded-2xl p-3 shadow-2xl">
        <p className="text-white font-bold text-sm">{label}</p>
        <p className="text-blue-400 text-sm">{payload[0].value} {payload[0].name === 'hours' ? 'hrs' : 'min'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen text-white" style={{ background: 'linear-gradient(135deg, #060A12 0%, #0D0F1E 50%, #060A12 100%)' }}>

      {/* Ambient Background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl" style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}/>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 rounded-full opacity-5 blur-3xl" style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }}/>
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-white/5 backdrop-blur-2xl px-6 py-4 flex items-center justify-between sticky top-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl flex items-center justify-center shadow-2xl" style={{ background: 'linear-gradient(135deg, #6366f1, #3b82f6)' }}>
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-white tracking-tight text-lg">AppMeter</h1>
            <p className="text-xs text-white/30">Admin Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== 'grades' && (
            <button onClick={() => { setView(view === 'detail' ? 'students' : 'grades'); setSelectedStudent(null) }}
              className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition px-3 py-1.5 rounded-xl hover:bg-white/5">
              ← Back
            </button>
          )}
          <button onClick={logout} className="text-white/40 hover:text-white text-sm px-4 py-2 rounded-xl border border-white/10 hover:border-white/20 transition backdrop-blur">
            Sign out
          </button>
        </div>
      </div>

      <div className="relative z-10 p-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-8 p-1 rounded-2xl w-fit" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
          {(['grades','teachers','links'] as const).map(tab => (
            <button key={tab}
              onClick={() => { setActiveTab(tab); setView('grades'); setSelectedStudent(null); setSelectedGrade(null) }}
              className={`px-5 py-2.5 rounded-xl text-sm font-bold capitalize transition-all ${
                activeTab === tab ? 'text-white shadow-lg' : 'text-white/30 hover:text-white/60'
              }`}
              style={activeTab === tab ? { background: 'linear-gradient(135deg, #6366f1, #3b82f6)' } : {}}
            >
              {tab === 'grades' ? '🎓 Grades' : tab === 'teachers' ? '👨‍🏫 Teachers' : '🔗 Links'}
            </button>
          ))}
        </div>

        {/* GRADES TAB */}
        {activeTab === 'grades' && (
          <>
            {/* GRADES OVERVIEW */}
            {view === 'grades' && (
              <>
                {/* Top Stats */}
                <div className="grid grid-cols-3 gap-4 mb-8">
                  {[
                    { label: 'Total Students', value: students.length, gradient: 'linear-gradient(135deg, #1D4ED8, #06B6D4)', shadow: 'rgba(29,78,216,0.3)' },
                    { label: 'Total Teachers', value: teachers.length, gradient: 'linear-gradient(135deg, #7C3AED, #EC4899)', shadow: 'rgba(124,58,237,0.3)' },
                    { label: '⚠️ Warnings', value: Object.values(studentWarnings).filter(Boolean).length, gradient: 'linear-gradient(135deg, #D97706, #EF4444)', shadow: 'rgba(217,119,6,0.3)' },
                  ].map((stat, i) => (
                    <div key={i} className="rounded-3xl p-6 relative overflow-hidden" style={{ background: stat.gradient, boxShadow: `0 20px 40px ${stat.shadow}` }}>
                      <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(45deg, transparent 40%, rgba(255,255,255,0.1) 100%)' }}/>
                      <p className="text-white/70 text-xs uppercase tracking-widest mb-2">{stat.label}</p>
                      <p className="text-5xl font-black text-white">{stat.value}</p>
                    </div>
                  ))}
                </div>

                {/* Grade Cards */}
                <h2 className="text-xs font-bold text-white/20 uppercase tracking-widest mb-5">Class Overview — Today</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                  {GRADES.map(grade => {
                    const theme = GRADE_THEMES[grade]
                    const stats = gradeStats[grade] || { count: 0, totalSeconds: 0, avgSeconds: 0 }
                    const gradeWarnings = students.filter(s => s.grade === grade && studentWarnings[s.id]).length
                    const pct = Math.min(Math.round((stats.avgSeconds / (5*3600)) * 100), 100)

                    return (
                      <div key={grade}
                        onClick={() => { setSelectedGrade(grade); setView('students') }}
                        className="relative overflow-hidden rounded-3xl cursor-pointer group transition-all duration-300 hover:scale-[1.02]"
                        style={{ background: theme.gradient, boxShadow: theme.shadow }}
                      >
                        {/* Glass overlay */}
                        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-all duration-300" style={{ background: 'linear-gradient(135deg, rgba(255,255,255,0.1), transparent)' }}/>

                        {/* Decorative circle */}
                        <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent)' }}/>
                        <div className="absolute -bottom-4 -left-4 w-24 h-24 rounded-full opacity-10" style={{ background: 'radial-gradient(circle, rgba(255,255,255,0.5), transparent)' }}/>

                        <div className="relative p-6">
                          <div className="flex items-start justify-between mb-4">
                            <div>
                              <p className="text-white/60 text-xs uppercase tracking-widest mb-1">{theme.icon} {grade}</p>
                              <p className="text-5xl font-black text-white">{stats.count}
                                <span className="text-base font-normal text-white/50 ml-2">students</span>
                              </p>
                            </div>
                            {gradeWarnings > 0 && (
                              <div className="bg-black/20 backdrop-blur rounded-2xl px-3 py-2 text-center border border-white/10">
                                <p className="text-xl">⚠️</p>
                                <p className="text-white text-xs font-black">{gradeWarnings}</p>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-3 mb-4">
                            <div className="bg-black/20 backdrop-blur rounded-2xl p-3 border border-white/10">
                              <p className="text-white/50 text-xs mb-1">Total Today</p>
                              <p className="text-xl font-black text-white">{formatTime(stats.totalSeconds)}</p>
                            </div>
                            <div className="bg-black/20 backdrop-blur rounded-2xl p-3 border border-white/10">
                              <p className="text-white/50 text-xs mb-1">Avg / Student</p>
                              <p className="text-xl font-black text-white">{formatTime(stats.avgSeconds)}</p>
                            </div>
                          </div>

                          <div className="bg-black/20 rounded-full h-2 overflow-hidden mb-2">
                            <div className="h-full bg-white/60 rounded-full transition-all" style={{ width: `${pct}%` }}/>
                          </div>
                          <div className="flex items-center justify-between">
                            <p className="text-white/40 text-xs">{pct}% of 5h daily limit</p>
                            <p className="text-white/60 text-xs font-bold group-hover:text-white transition">View students →</p>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Grade Comparison Chart */}
                <div className="rounded-3xl p-6 mb-6" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <h3 className="font-bold text-white/50 text-sm mb-1">📊 Grade Comparison</h3>
                  <p className="text-white/20 text-xs mb-5">Average hours per student today</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={GRADES.map(g => ({
                      name: g.replace('Grade ', 'G'), hours: parseFloat(((gradeStats[g]?.avgSeconds||0)/3600).toFixed(1))
                    }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#ffffff30', fontSize: 13, fontWeight: 'bold' }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#ffffff30', fontSize: 11 }} axisLine={false} tickLine={false}/>
                      <Tooltip content={<CustomTooltip/>}/>
                      <Bar dataKey="hours" radius={[12,12,0,0]}>
                        {GRADES.map((g, i) => (
                          <Cell key={i} fill={['#3b82f6','#8b5cf6','#10b981','#f59e0b'][i]}/>
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* STUDENTS LIST */}
            {view === 'students' && selectedGrade && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className="px-4 py-2 rounded-2xl text-sm font-black text-white" style={{ background: GRADE_THEMES[selectedGrade].gradient }}>
                    {selectedGrade}
                  </div>
                  <h2 className="text-2xl font-black">{gradeStudents.length} Students</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gradeStudents.map(s => {
                    const hasWarning = studentWarnings[s.id]
                    const theme = GRADE_THEMES[selectedGrade]
                    return (
                      <button key={s.id}
                        onClick={() => { setSelectedStudent(s); setView('detail'); fetchUsage(s.id) }}
                        className="text-left rounded-3xl p-5 transition-all hover:scale-[1.02] group"
                        style={{ background: 'rgba(255,255,255,0.04)', border: `1px solid ${hasWarning ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}` }}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-xl" style={{ background: theme.gradient }}>
                            {s.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-black truncate">{s.full_name}</p>
                              {hasWarning && <span>⚠️</span>}
                            </div>
                            <p className="text-white/30 text-xs truncate">{s.email}</p>
                          </div>
                        </div>
                        {hasWarning && (
                          <div className="rounded-xl px-3 py-1.5 mb-3 text-xs font-bold text-yellow-300" style={{ background: 'rgba(251,191,36,0.1)', border: '1px solid rgba(251,191,36,0.2)' }}>
                            ⚠️ Over 5h screen time today
                          </div>
                        )}
                        <p className="text-white/30 text-xs font-bold group-hover:text-white/60 transition">View details →</p>
                      </button>
                    )
                  })}
                  {gradeStudents.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-white/20">No students in {selectedGrade} yet</div>
                  )}
                </div>
              </>
            )}

            {/* STUDENT DETAIL */}
            {view === 'detail' && selectedStudent && (
              <div className="space-y-5">
                <div className="rounded-3xl p-6" style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black shadow-2xl"
                        style={{ background: GRADE_THEMES[selectedStudent.grade]?.gradient || 'linear-gradient(135deg,#6366f1,#3b82f6)' }}>
                        {selectedStudent.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-2xl font-black">{selectedStudent.full_name}</h2>
                          {studentWarnings[selectedStudent.id] && <span>⚠️</span>}
                        </div>
                        <p className="text-white/40 text-sm">{selectedStudent.email}</p>
                        <div className="inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-black text-white"
                          style={{ background: GRADE_THEMES[selectedStudent.grade]?.gradient }}>
                          {selectedStudent.grade}
                        </div>
                        {studentWarnings[selectedStudent.id] && (
                          <p className="text-yellow-400 text-xs mt-1 font-bold">⚠️ Over 5h screen time today</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['today','week','month'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          className="px-3 py-1.5 rounded-xl text-xs font-black capitalize transition"
                          style={filter === f ? { background: 'linear-gradient(135deg,#6366f1,#3b82f6)', color: 'white' } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.4)' }}>
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {loadingUsage ? (
                  <div className="flex items-center justify-center h-48">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin"/>
                  </div>
                ) : (
                  <>
                    <div className="grid grid-cols-3 gap-4">
                      {[
                        { label: 'Screen Time', value: formatTime(totalTime), gradient: 'linear-gradient(135deg,#1D4ED8,#06B6D4)', shadow: 'rgba(29,78,216,0.3)' },
                        { label: 'Apps Used', value: usage.length, gradient: 'linear-gradient(135deg,#7C3AED,#EC4899)', shadow: 'rgba(124,58,237,0.3)' },
                        { label: 'Top App', value: usage[0]?.name || '--', gradient: 'linear-gradient(135deg,#D97706,#EF4444)', shadow: 'rgba(217,119,6,0.3)' },
                      ].map((s, i) => (
                        <div key={i} className="rounded-2xl p-4 relative overflow-hidden" style={{ background: s.gradient, boxShadow: `0 10px 30px ${s.shadow}` }}>
                          <div className="absolute inset-0 opacity-20" style={{ background: 'linear-gradient(45deg,transparent,rgba(255,255,255,0.1))' }}/>
                          <p className="text-white/60 text-xs uppercase tracking-wider mb-1">{s.label}</p>
                          <p className="text-2xl font-black text-white truncate">{s.value}</p>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 className="text-sm font-bold text-white/50 mb-1">📅 Daily Usage (hours)</h3>
                      <p className="text-xs text-white/20 mb-4">🔴 Red bars = over 5h limit</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Bar dataKey="hours" radius={[8,8,0,0]}>
                            {dailyData.map((d, i) => <Cell key={i} fill={d.warning ? '#ef4444' : '#6366f1'}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    <div className="rounded-3xl p-5" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <h3 className="text-sm font-bold text-white/50 mb-4">📆 Monthly Usage (hours)</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fill: '#ffffff40', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Bar dataKey="hours" radius={[8,8,0,0]}>
                            {monthlyData.map((_, i) => <Cell key={i} fill={COLORS[i%COLORS.length]}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {usage.length > 0 && (
                      <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div className="px-5 py-4 border-b border-white/5">
                          <h3 className="text-sm font-bold text-white/50">📱 App Breakdown</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                          {usage.map((app, i) => {
                            const appWarning = app.seconds > 3*3600
                            const pct = Math.round((app.seconds/totalTime)*100)
                            return (
                              <div key={app.name} className="px-5 py-3">
                                <div className="flex items-center justify-between mb-2">
                                  <div className="flex items-center gap-2">
                                    <div className="w-3 h-3 rounded-full" style={{ background: COLORS[i%COLORS.length], boxShadow: `0 0 8px ${COLORS[i%COLORS.length]}` }}/>
                                    <span className="text-sm font-bold">{app.name}</span>
                                    {appWarning && <span className="text-sm">⚠️</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {appWarning && (
                                      <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.2)' }}>
                                        Over 3h
                                      </span>
                                    )}
                                    <span className="text-sm font-mono font-black" style={{ color: COLORS[i%COLORS.length] }}>{formatTime(app.seconds)}</span>
                                  </div>
                                </div>
                                <div className="w-full rounded-full h-1.5" style={{ background: 'rgba(255,255,255,0.05)' }}>
                                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, background: appWarning ? 'linear-gradient(90deg,#f59e0b,#ef4444)' : COLORS[i%COLORS.length], boxShadow: `0 0 8px ${COLORS[i%COLORS.length]}40` }}/>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </>
        )}

        {/* TEACHERS TAB */}
        {activeTab === 'teachers' && (
          <div className="rounded-3xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="font-black">All Teachers</h3>
            </div>
            <div className="divide-y divide-white/5">
              {teachers.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black shadow-lg"
                      style={{ background: 'linear-gradient(135deg,#7C3AED,#EC4899)' }}>
                      {t.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-sm">{t.full_name}</p>
                      <p className="text-white/30 text-xs">{t.email}</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold px-3 py-1 rounded-full" style={{ background: 'rgba(124,58,237,0.15)', color: '#c084fc', border: '1px solid rgba(124,58,237,0.3)' }}>Teacher</span>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-white/20 text-sm px-5 py-8 text-center">No teachers yet</p>}
            </div>
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <div className="rounded-3xl p-6 max-w-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <h3 className="font-black mb-1">Link Teacher to Student</h3>
            <p className="text-white/30 text-sm mb-5">Teachers only see students they are linked to</p>
            <div className="space-y-3">
              <div>
                <label className="text-white/30 text-xs uppercase tracking-wider">Select Teacher</label>
                <select className="w-full mt-1.5 text-white rounded-xl px-4 py-3 outline-none transition"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
                  <option value="">Choose a teacher...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/30 text-xs uppercase tracking-wider">Select Student</label>
                <select className="w-full mt-1.5 text-white rounded-xl px-4 py-3 outline-none transition"
                  style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                  value={selectedStudentLink} onChange={e => setSelectedStudentLink(e.target.value)}>
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.grade}) — {s.email}</option>)}
                </select>
              </div>
              {message && (
                <div className="rounded-xl p-3 text-sm font-bold" style={{ background: message.includes('success') ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)', color: message.includes('success') ? '#34d399' : '#f87171', border: `1px solid ${message.includes('success') ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}` }}>
                  {message}
                </div>
              )}
              <button onClick={linkTeacherStudent}
                className="w-full text-white font-black py-3 rounded-xl transition hover:opacity-90 shadow-xl"
                style={{ background: 'linear-gradient(135deg,#6366f1,#3b82f6)', boxShadow: '0 10px 30px rgba(99,102,241,0.3)' }}>
                Link Teacher to Student
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
