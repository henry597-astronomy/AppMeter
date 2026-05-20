'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell, PieChart, Pie
} from 'recharts'

const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

const GRADES = ['Grade 9','Grade 10','Grade 11','Grade 12']
const GRADE_COLORS: Record<string, {from: string, to: string, border: string, text: string, bg: string}> = {
  'Grade 9':  { from: 'from-blue-600',   to: 'to-cyan-600',    border: 'border-blue-500/30',   text: 'text-blue-400',   bg: 'bg-blue-600' },
  'Grade 10': { from: 'from-purple-600', to: 'to-pink-600',    border: 'border-purple-500/30', text: 'text-purple-400', bg: 'bg-purple-600' },
  'Grade 11': { from: 'from-green-600',  to: 'to-emerald-600', border: 'border-green-500/30',  text: 'text-green-400',  bg: 'bg-green-600' },
  'Grade 12': { from: 'from-orange-600', to: 'to-red-600',     border: 'border-orange-500/30', text: 'text-orange-400', bg: 'bg-orange-600' },
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
    const { data: profile } = await supabase
      .from('profiles').select('role').eq('id', user.user.id).single()
    if (profile?.role !== 'admin') router.push('/login')
  }

  const fetchAll = async () => {
    const { data: s } = await supabase.from('profiles').select('*').eq('role', 'student')
    const { data: t } = await supabase.from('profiles').select('*').eq('role', 'teacher')
    setStudents(s || [])
    setTeachers(t || [])

    // Calculate grade stats and warnings
    const warnings: Record<string, boolean> = {}
    const stats: Record<string, any> = {}
    const today = new Date(); today.setHours(0,0,0,0)

    for (const grade of GRADES) {
      const gradeStudents = (s || []).filter(st => st.grade === grade)
      let totalSeconds = 0
      for (const student of gradeStudents) {
        const { data: rec } = await supabase
          .from('usage_records')
          .select('duration_seconds')
          .eq('student_id', student.id)
          .gte('start_time', today.toISOString())
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
      .from('usage_records')
      .select('app_name, duration_seconds, start_time')
      .eq('student_id', studentId)
      .gte('start_time', fromDate.toISOString())
      .order('start_time', { ascending: false })

    const map: Record<string, number> = {}
    data?.forEach(r => {
      const name = r.app_name.split('.').pop() || r.app_name
      map[name] = (map[name] || 0) + (r.duration_seconds || 0)
    })
    const sorted = Object.entries(map)
      .sort((a,b) => b[1]-a[1]).slice(0,10)
      .map(([name, seconds]) => ({ name, minutes: Math.round(seconds/60), seconds }))
    setUsage(sorted)
    setTotalTime(sorted.reduce((a,b) => a + b.seconds, 0))

    const dayMap: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
    data?.forEach(r => {
      const day = new Date(r.start_time).getDay()
      dayMap[day] = (dayMap[day] || 0) + (r.duration_seconds || 0)
    })
    setDailyData(DAYS.map((name, i) => ({
      name, hours: parseFloat((dayMap[i]/3600).toFixed(1)), warning: dayMap[i] > 5*3600
    })))

    const monthMap: Record<number, number> = {}
    data?.forEach(r => {
      const month = new Date(r.start_time).getMonth()
      monthMap[month] = (monthMap[month] || 0) + (r.duration_seconds || 0)
    })
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
    const { error } = await supabase.from('teacher_student_links').insert({
      teacher_id: selectedTeacher, student_id: selectedStudentLink
    })
    setMessage(error ? 'Error: ' + error.message : 'Linked successfully!')
    setTimeout(() => setMessage(''), 3000)
  }

  const logout = async () => { await supabase.auth.signOut(); router.push('/login') }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null
    return (
      <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl">
        <p className="text-white font-medium text-sm">{label}</p>
        <p className="text-blue-400 text-sm">{payload[0].value} {payload[0].name === 'hours' ? 'hrs' : 'min'}</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#060A12] text-white">
      {/* Header */}
      <div className="border-b border-white/5 bg-white/3 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-violet-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-violet-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-black text-white tracking-tight">AppMeter</h1>
            <p className="text-xs text-white/30">Admin Control Panel</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {view !== 'grades' && (
            <button
              onClick={() => { setView(view === 'detail' ? 'students' : 'grades'); setSelectedStudent(null) }}
              className="text-white/50 hover:text-white text-sm flex items-center gap-1 transition"
            >
              ← Back
            </button>
          )}
          <button onClick={logout} className="text-white/40 hover:text-white text-sm bg-white/5 hover:bg-white/10 px-4 py-2 rounded-xl transition">
            Sign out
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-white/3 p-1 rounded-2xl w-fit">
          {(['grades','teachers','links'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setView('grades'); setSelectedStudent(null); setSelectedGrade(null) }}
              className={`px-5 py-2 rounded-xl text-sm font-semibold capitalize transition ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white shadow-lg shadow-violet-500/20'
                  : 'text-white/40 hover:text-white'
              }`}
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
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                  <div className="bg-gradient-to-br from-violet-600/20 to-transparent rounded-2xl p-5 border border-violet-500/20 col-span-2 lg:col-span-1">
                    <p className="text-violet-400 text-xs uppercase tracking-widest mb-2">Total Students</p>
                    <p className="text-5xl font-black text-white">{students.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-blue-600/20 to-transparent rounded-2xl p-5 border border-blue-500/20">
                    <p className="text-blue-400 text-xs uppercase tracking-widest mb-2">Teachers</p>
                    <p className="text-5xl font-black text-white">{teachers.length}</p>
                  </div>
                  <div className="bg-gradient-to-br from-yellow-600/20 to-transparent rounded-2xl p-5 border border-yellow-500/20">
                    <p className="text-yellow-400 text-xs uppercase tracking-widest mb-2">Warnings</p>
                    <p className="text-5xl font-black text-white">{Object.values(studentWarnings).filter(Boolean).length}</p>
                  </div>
                </div>

                {/* Grade Cards */}
                <h2 className="text-xs font-bold text-white/30 uppercase tracking-widest mb-4">Class Overview</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-8">
                  {GRADES.map(grade => {
                    const gc = GRADE_COLORS[grade]
                    const stats = gradeStats[grade] || { count: 0, totalSeconds: 0, avgSeconds: 0 }
                    const gradeWarnings = students
                      .filter(s => s.grade === grade && studentWarnings[s.id]).length
                    return (
                      <div
                        key={grade}
                        className={`relative overflow-hidden rounded-3xl border ${gc.border} bg-gradient-to-br ${gc.from}/10 ${gc.to}/5 p-6 cursor-pointer hover:scale-[1.02] transition-all duration-300 group`}
                        onClick={() => { setSelectedGrade(grade); setView('students') }}
                      >
                        <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${gc.from} ${gc.to} rounded-full filter blur-3xl opacity-10 group-hover:opacity-20 transition`}/>
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${gc.text} bg-white/5 border ${gc.border} mb-2`}>
                              {grade}
                            </div>
                            <p className="text-4xl font-black text-white">{stats.count}
                              <span className="text-base font-normal text-white/30 ml-1">students</span>
                            </p>
                          </div>
                          {gradeWarnings > 0 && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-2xl px-3 py-2 text-center">
                              <p className="text-2xl">⚠️</p>
                              <p className="text-yellow-400 text-xs font-bold">{gradeWarnings}</p>
                            </div>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3 mb-4">
                          <div className="bg-white/5 rounded-2xl p-3">
                            <p className="text-white/30 text-xs mb-1">Total Today</p>
                            <p className={`text-lg font-black ${gc.text}`}>{formatTime(stats.totalSeconds)}</p>
                          </div>
                          <div className="bg-white/5 rounded-2xl p-3">
                            <p className="text-white/30 text-xs mb-1">Avg Per Student</p>
                            <p className={`text-lg font-black ${gc.text}`}>{formatTime(stats.avgSeconds)}</p>
                          </div>
                        </div>

                        {/* Mini bar chart */}
                        {stats.count > 0 && (
                          <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                            <div
                              className={`h-full bg-gradient-to-r ${gc.from} ${gc.to} rounded-full transition-all`}
                              style={{ width: `${Math.min((stats.avgSeconds / (5*3600)) * 100, 100)}%` }}
                            />
                          </div>
                        )}
                        <p className="text-white/20 text-xs mt-2">
                          {Math.min(Math.round((gradeStats[grade]?.avgSeconds || 0) / (5*3600) * 100), 100)}% of 5h limit
                        </p>

                        <div className={`mt-4 flex items-center gap-1 ${gc.text} text-sm font-semibold group-hover:gap-2 transition-all`}>
                          View detailed info <span>→</span>
                        </div>
                      </div>
                    )
                  })}
                </div>

                {/* Overall Grade Comparison Chart */}
                <div className="bg-white/3 rounded-3xl border border-white/5 p-6 mb-6">
                  <h3 className="font-bold text-white/60 text-sm mb-1">📊 Grade Comparison — Today's Usage</h3>
                  <p className="text-white/20 text-xs mb-5">Average hours per student per grade</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={GRADES.map(g => ({
                      name: g.replace('Grade ', 'G'),
                      hours: parseFloat(((gradeStats[g]?.avgSeconds || 0)/3600).toFixed(1))
                    }))} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                      <XAxis dataKey="name" tick={{ fill: '#ffffff30', fontSize: 12 }} axisLine={false} tickLine={false}/>
                      <YAxis tick={{ fill: '#ffffff30', fontSize: 12 }} axisLine={false} tickLine={false}/>
                      <Tooltip contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #ffffff10', borderRadius: '16px' }} labelStyle={{ color: '#fff' }} formatter={(v: any) => [`${v} hrs`, 'Avg']}/>
                      <Bar dataKey="hours" radius={[10,10,0,0]}>
                        {GRADES.map((g, i) => <Cell key={i} fill={['#3b82f6','#8b5cf6','#10b981','#f59e0b'][i]}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* STUDENTS LIST VIEW */}
            {view === 'students' && selectedGrade && (
              <>
                <div className="flex items-center gap-3 mb-6">
                  <div className={`px-4 py-1.5 rounded-full text-sm font-bold ${GRADE_COLORS[selectedGrade].text} bg-white/5 border ${GRADE_COLORS[selectedGrade].border}`}>
                    {selectedGrade}
                  </div>
                  <h2 className="text-xl font-black">{gradeStudents.length} Students</h2>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {gradeStudents.map(s => {
                    const hasWarning = studentWarnings[s.id]
                    const gc = GRADE_COLORS[selectedGrade]
                    return (
                      <button
                        key={s.id}
                        onClick={() => { setSelectedStudent(s); setView('detail'); fetchUsage(s.id) }}
                        className={`text-left bg-white/3 hover:bg-white/6 border ${hasWarning ? 'border-yellow-500/40' : 'border-white/5'} rounded-2xl p-5 transition-all hover:scale-[1.02] group`}
                      >
                        <div className="flex items-center gap-3 mb-3">
                          <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${gc.from} ${gc.to} flex items-center justify-center text-lg font-black shadow-lg`}>
                            {s.full_name?.[0]?.toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="font-bold truncate">{s.full_name}</p>
                              {hasWarning && <span>⚠️</span>}
                            </div>
                            <p className="text-white/30 text-xs truncate">{s.email}</p>
                          </div>
                        </div>
                        {hasWarning && (
                          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl px-3 py-1.5 mb-3">
                            <p className="text-yellow-400 text-xs font-medium">⚠️ Over 5h screen time today</p>
                          </div>
                        )}
                        <div className={`flex items-center gap-1 ${gc.text} text-xs font-semibold group-hover:gap-2 transition-all`}>
                          View details <span>→</span>
                        </div>
                      </button>
                    )
                  })}
                  {gradeStudents.length === 0 && (
                    <div className="col-span-3 text-center py-16 text-white/20">
                      No students in {selectedGrade} yet
                    </div>
                  )}
                </div>
              </>
            )}

            {/* STUDENT DETAIL VIEW */}
            {view === 'detail' && selectedStudent && (
              <div className="space-y-5">
                {/* Student Header */}
                <div className={`bg-gradient-to-r from-white/5 to-transparent rounded-3xl p-6 border border-white/5`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${GRADE_COLORS[selectedStudent.grade]?.from || 'from-blue-500'} ${GRADE_COLORS[selectedStudent.grade]?.to || 'to-purple-600'} flex items-center justify-center text-2xl font-black shadow-xl`}>
                        {selectedStudent.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <h2 className="text-2xl font-black">{selectedStudent.full_name}</h2>
                          {studentWarnings[selectedStudent.id] && <span className="text-xl">⚠️</span>}
                        </div>
                        <p className="text-white/40 text-sm">{selectedStudent.email}</p>
                        <div className={`inline-block mt-1 px-3 py-0.5 rounded-full text-xs font-bold ${GRADE_COLORS[selectedStudent.grade]?.text || 'text-blue-400'} bg-white/5`}>
                          {selectedStudent.grade}
                        </div>
                        {studentWarnings[selectedStudent.id] && (
                          <p className="text-yellow-400 text-xs mt-1">⚠️ Over 5h screen time today</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['today','week','month'] as const).map(f => (
                        <button key={f} onClick={() => setFilter(f)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition ${filter === f ? 'bg-gradient-to-r from-violet-600 to-blue-600 text-white' : 'bg-white/5 text-white/40 hover:text-white'}`}>
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
                    {/* Stats */}
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-gradient-to-br from-blue-600/20 to-transparent rounded-2xl p-4 border border-blue-500/20">
                        <p className="text-blue-400 text-xs uppercase tracking-wider">Screen Time</p>
                        <p className="text-3xl font-black mt-1">{formatTime(totalTime)}</p>
                      </div>
                      <div className="bg-gradient-to-br from-violet-600/20 to-transparent rounded-2xl p-4 border border-violet-500/20">
                        <p className="text-violet-400 text-xs uppercase tracking-wider">Apps Used</p>
                        <p className="text-3xl font-black mt-1">{usage.length}</p>
                      </div>
                      <div className="bg-gradient-to-br from-orange-600/20 to-transparent rounded-2xl p-4 border border-orange-500/20">
                        <p className="text-orange-400 text-xs uppercase tracking-wider">Top App</p>
                        <p className="text-xl font-black mt-1 truncate">{usage[0]?.name || '--'}</p>
                      </div>
                    </div>

                    {/* Daily Chart */}
                    <div className="bg-white/3 rounded-3xl p-5 border border-white/5">
                      <h3 className="text-sm font-bold text-white/50 mb-1">📅 Daily Usage</h3>
                      <p className="text-xs text-white/20 mb-4">Red = over 5h limit</p>
                      <ResponsiveContainer width="100%" height={180}>
                        <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#ffffff30', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fill: '#ffffff30', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Bar dataKey="hours" radius={[6,6,0,0]}>
                            {dailyData.map((d, i) => <Cell key={i} fill={d.warning ? '#ef4444' : '#6366f1'}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Monthly Chart */}
                    <div className="bg-white/3 rounded-3xl p-5 border border-white/5">
                      <h3 className="text-sm font-bold text-white/50 mb-4">📆 Monthly Usage</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                          <XAxis dataKey="name" tick={{ fill: '#ffffff30', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <YAxis tick={{ fill: '#ffffff30', fontSize: 11 }} axisLine={false} tickLine={false}/>
                          <Tooltip content={<CustomTooltip/>}/>
                          <Bar dataKey="hours" radius={[6,6,0,0]}>
                            {monthlyData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>

                    {/* App Breakdown */}
                    {usage.length > 0 && (
                      <div className="bg-white/3 rounded-3xl border border-white/5 overflow-hidden">
                        <div className="px-5 py-4 border-b border-white/5">
                          <h3 className="text-sm font-bold text-white/50">📱 App Breakdown</h3>
                        </div>
                        <div className="divide-y divide-white/5">
                          {usage.map((app, i) => {
                            const appWarning = app.seconds > 3*3600
                            const pct = Math.round((app.seconds/totalTime)*100)
                            return (
                              <div key={app.name} className="px-5 py-3">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2">
                                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i%COLORS.length] }}/>
                                    <span className="text-sm font-semibold">{app.name}</span>
                                    {appWarning && <span className="text-sm">⚠️</span>}
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {appWarning && (
                                      <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">Over 3h</span>
                                    )}
                                    <span className="text-sm font-mono" style={{ color: COLORS[i%COLORS.length] }}>{formatTime(app.seconds)}</span>
                                  </div>
                                </div>
                                <div className="w-full bg-white/5 rounded-full h-1.5">
                                  <div className="h-1.5 rounded-full" style={{ width: `${pct}%`, backgroundColor: appWarning ? '#f59e0b' : COLORS[i%COLORS.length] }}/>
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
          <div className="bg-white/3 rounded-3xl border border-white/5 overflow-hidden">
            <div className="px-5 py-4 border-b border-white/5">
              <h3 className="font-bold">All Teachers</h3>
            </div>
            <div className="divide-y divide-white/5">
              {teachers.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-black">
                      {t.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-sm">{t.full_name}</p>
                      <p className="text-white/30 text-xs">{t.email}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full">Teacher</span>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-white/20 text-sm px-5 py-8 text-center">No teachers yet</p>}
            </div>
          </div>
        )}

        {/* LINKS TAB */}
        {activeTab === 'links' && (
          <div className="bg-white/3 rounded-3xl border border-white/5 p-6 max-w-lg">
            <h3 className="font-bold mb-1">Link Teacher to Student</h3>
            <p className="text-white/30 text-sm mb-5">Teachers can only see students they are linked to</p>
            <div className="space-y-3">
              <div>
                <label className="text-white/30 text-xs uppercase tracking-wider">Select Teacher</label>
                <select className="w-full mt-1.5 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition"
                  value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}>
                  <option value="">Choose a teacher...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-white/30 text-xs uppercase tracking-wider">Select Student</label>
                <select className="w-full mt-1.5 bg-white/5 border border-white/10 text-white rounded-xl px-4 py-3 outline-none focus:border-violet-500 transition"
                  value={selectedStudentLink} onChange={e => setSelectedStudentLink(e.target.value)}>
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} ({s.grade}) — {s.email}</option>)}
                </select>
              </div>
              {message && (
                <div className={`rounded-xl p-3 text-sm ${message.includes('success') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {message}
                </div>
              )}
              <button onClick={linkTeacherStudent}
                className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500 text-white font-bold py-3 rounded-xl transition shadow-lg shadow-violet-500/20">
                Link Teacher to Student
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
