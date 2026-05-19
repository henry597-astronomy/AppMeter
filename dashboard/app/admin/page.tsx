'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  Cell, PieChart, Pie, Legend, RadialBarChart, RadialBar
} from 'recharts'

const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9']
const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']
const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<any>(null)
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [selectedStudentLink, setSelectedStudentLink] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'students'|'teachers'|'links'>('students')
  const [usage, setUsage] = useState<any[]>([])
  const [dailyData, setDailyData] = useState<any[]>([])
  const [monthlyData, setMonthlyData] = useState<any[]>([])
  const [totalTime, setTotalTime] = useState(0)
  const [filter, setFilter] = useState<'today'|'week'|'month'>('week')
  const [message, setMessage] = useState('')
  const [loadingUsage, setLoadingUsage] = useState(false)
  const [studentWarnings, setStudentWarnings] = useState<Record<string, boolean>>({})
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

    // Check warnings for each student
    const warnings: Record<string, boolean> = {}
    for (const student of (s || [])) {
      const today = new Date()
      today.setHours(0,0,0,0)
      const { data } = await supabase
        .from('usage_records')
        .select('duration_seconds')
        .eq('student_id', student.id)
        .gte('start_time', today.toISOString())
      const total = (data || []).reduce((a, b) => a + (b.duration_seconds || 0), 0)
      warnings[student.id] = total > 5 * 3600
    }
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

    // App breakdown
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

    // Daily breakdown (by day of week)
    const dayMap: Record<number, number> = {0:0,1:0,2:0,3:0,4:0,5:0,6:0}
    data?.forEach(r => {
      const day = new Date(r.start_time).getDay()
      dayMap[day] = (dayMap[day] || 0) + (r.duration_seconds || 0)
    })
    setDailyData(DAYS.map((name, i) => ({
      name,
      hours: parseFloat((dayMap[i] / 3600).toFixed(1)),
      warning: dayMap[i] > 5 * 3600
    })))

    // Monthly breakdown (last 6 months)
    const monthMap: Record<number, number> = {}
    data?.forEach(r => {
      const month = new Date(r.start_time).getMonth()
      monthMap[month] = (monthMap[month] || 0) + (r.duration_seconds || 0)
    })
    const last6 = []
    for (let i = 5; i >= 0; i--) {
      const m = (now.getMonth() - i + 12) % 12
      last6.push({
        name: MONTHS[m],
        hours: parseFloat(((monthMap[m] || 0) / 3600).toFixed(1))
      })
    }
    setMonthlyData(last6)
    setLoadingUsage(false)
  }

  const selectStudent = (s: any) => {
    setSelectedStudent(s)
    fetchUsage(s.id)
  }

  const formatTime = (s: number) => {
    const h = Math.floor(s/3600)
    const m = Math.floor((s%3600)/60)
    return h > 0 ? `${h}h ${m}m` : `${m}m`
  }

  const linkTeacherStudent = async () => {
    if (!selectedTeacher || !selectedStudentLink) {
      setMessage('Please select both a teacher and a student')
      return
    }
    const { error } = await supabase.from('teacher_student_links').insert({
      teacher_id: selectedTeacher,
      student_id: selectedStudentLink
    })
    if (error) setMessage('Already linked or error: ' + error.message)
    else setMessage('Successfully linked!')
    setTimeout(() => setMessage(''), 3000)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-3 shadow-xl">
          <p className="text-white font-medium">{label}</p>
          <p className="text-blue-400">{payload[0].value} {payload[0].name === 'hours' ? 'hrs' : 'min'}</p>
        </div>
      )
    }
    return null
  }

  return (
    <div className="min-h-screen bg-[#080C14] text-white">
      {/* Header */}
      <div className="border-b border-gray-800/50 bg-gray-900/30 backdrop-blur-xl px-6 py-4 flex items-center justify-between sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-gradient-to-br from-purple-500 to-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white tracking-tight">AppMeter</h1>
            <p className="text-xs text-gray-500">Admin Control Panel</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm bg-gray-800 hover:bg-gray-700 px-4 py-2 rounded-xl transition">Sign out</button>
      </div>

      <div className="p-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gradient-to-br from-blue-600/20 to-blue-600/5 rounded-2xl p-5 border border-blue-500/20">
            <p className="text-blue-400 text-xs uppercase tracking-wider mb-1">Students</p>
            <p className="text-4xl font-black text-white">{students.length}</p>
            <p className="text-blue-400/60 text-xs mt-1">registered</p>
          </div>
          <div className="bg-gradient-to-br from-purple-600/20 to-purple-600/5 rounded-2xl p-5 border border-purple-500/20">
            <p className="text-purple-400 text-xs uppercase tracking-wider mb-1">Teachers</p>
            <p className="text-4xl font-black text-white">{teachers.length}</p>
            <p className="text-purple-400/60 text-xs mt-1">registered</p>
          </div>
          <div className="bg-gradient-to-br from-green-600/20 to-green-600/5 rounded-2xl p-5 border border-green-500/20">
            <p className="text-green-400 text-xs uppercase tracking-wider mb-1">Warnings</p>
            <p className="text-4xl font-black text-yellow-400">{Object.values(studentWarnings).filter(Boolean).length}</p>
            <p className="text-green-400/60 text-xs mt-1">today</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 bg-gray-900/50 p-1 rounded-2xl w-fit">
          {(['students','teachers','links'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); setSelectedStudent(null) }}
              className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition ${
                activeTab === tab
                  ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Students Tab */}
        {activeTab === 'students' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Student List */}
            <div className="lg:col-span-1 space-y-2">
              <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">All Students</h2>
              {students.map(s => (
                <button
                  key={s.id}
                  onClick={() => selectStudent(s)}
                  className={`w-full text-left flex items-center gap-3 px-4 py-3.5 rounded-2xl transition-all ${
                    selectedStudent?.id === s.id
                      ? 'bg-gradient-to-r from-purple-600/30 to-blue-600/30 border border-purple-500/40'
                      : 'bg-gray-900/60 hover:bg-gray-800/60 border border-gray-800'
                  }`}
                >
                  <div className="relative">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-sm font-bold shadow-lg">
                      {s.full_name?.[0]?.toUpperCase()}
                    </div>
                    {studentWarnings[s.id] && (
                      <span className="absolute -top-1 -right-1 text-sm">⚠️</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm truncate">{s.full_name}</p>
                    <p className="text-gray-500 text-xs truncate">{s.email}</p>
                  </div>
                  {studentWarnings[s.id] && (
                    <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full shrink-0">High</span>
                  )}
                </button>
              ))}
              {students.length === 0 && (
                <div className="text-center py-12 text-gray-600">No students yet</div>
              )}
            </div>

            {/* Student Detail */}
            <div className="lg:col-span-2">
              {selectedStudent ? (
                <div className="space-y-5">
                  {/* Student Header */}
                  <div className="bg-gradient-to-r from-gray-900 to-gray-900/50 rounded-2xl p-5 border border-gray-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl font-black shadow-lg shadow-purple-500/20">
                        {selectedStudent.full_name?.[0]?.toUpperCase()}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-xl font-bold">{selectedStudent.full_name}</h2>
                          {studentWarnings[selectedStudent.id] && <span className="text-lg">⚠️</span>}
                        </div>
                        <p className="text-gray-400 text-sm">{selectedStudent.email}</p>
                        {studentWarnings[selectedStudent.id] && (
                          <p className="text-yellow-400 text-xs mt-1">⚠️ Used phone more than 5 hours today</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(['today','week','month'] as const).map(f => (
                        <button
                          key={f}
                          onClick={() => setFilter(f)}
                          className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition ${
                            filter === f
                              ? 'bg-gradient-to-r from-purple-600 to-blue-600 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {f}
                        </button>
                      ))}
                    </div>
                  </div>

                  {loadingUsage ? (
                    <div className="flex items-center justify-center h-48">
                      <div className="w-8 h-8 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"/>
                    </div>
                  ) : (
                    <>
                      {/* Stats Row */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-gradient-to-br from-blue-600/20 to-transparent rounded-2xl p-4 border border-blue-500/20">
                          <p className="text-blue-400 text-xs uppercase tracking-wider">Screen Time</p>
                          <p className="text-2xl font-black mt-1">{formatTime(totalTime)}</p>
                        </div>
                        <div className="bg-gradient-to-br from-purple-600/20 to-transparent rounded-2xl p-4 border border-purple-500/20">
                          <p className="text-purple-400 text-xs uppercase tracking-wider">Apps Used</p>
                          <p className="text-2xl font-black mt-1">{usage.length}</p>
                        </div>
                        <div className="bg-gradient-to-br from-orange-600/20 to-transparent rounded-2xl p-4 border border-orange-500/20">
                          <p className="text-orange-400 text-xs uppercase tracking-wider">Top App</p>
                          <p className="text-lg font-black mt-1 truncate">{usage[0]?.name || '--'}</p>
                        </div>
                      </div>

                      {/* Daily Chart */}
                      <div className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-1">📅 Daily Usage (hours per day)</h3>
                        <p className="text-xs text-gray-600 mb-4">Days above 5h are highlighted in red</p>
                        <ResponsiveContainer width="100%" height={180}>
                          <BarChart data={dailyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                            <Tooltip content={<CustomTooltip/>}/>
                            <Bar dataKey="hours" radius={[6,6,0,0]}>
                              {dailyData.map((d, i) => (
                                <Cell key={i} fill={d.warning ? '#ef4444' : '#3b82f6'}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* Monthly Chart */}
                      <div className="bg-gray-900/60 rounded-2xl p-5 border border-gray-800">
                        <h3 className="text-sm font-semibold text-gray-400 mb-4">📆 Monthly Usage (hours)</h3>
                        <ResponsiveContainer width="100%" height={160}>
                          <BarChart data={monthlyData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                            <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                            <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                            <Tooltip content={<CustomTooltip/>}/>
                            <Bar dataKey="hours" radius={[6,6,0,0]}>
                              {monthlyData.map((_, i) => (
                                <Cell key={i} fill={COLORS[i % COLORS.length]}/>
                              ))}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>

                      {/* App Breakdown */}
                      {usage.length > 0 && (
                        <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden">
                          <div className="px-5 py-4 border-b border-gray-800">
                            <h3 className="text-sm font-semibold text-gray-400">📱 App Breakdown</h3>
                          </div>
                          <div className="divide-y divide-gray-800/50">
                            {usage.map((app, i) => {
                              const appWarning = app.seconds > 3 * 3600
                              const pct = Math.round((app.seconds / totalTime) * 100)
                              return (
                                <div key={app.name} className="px-5 py-3">
                                  <div className="flex items-center justify-between mb-1.5">
                                    <div className="flex items-center gap-2">
                                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}/>
                                      <span className="text-sm font-medium">{app.name}</span>
                                      {appWarning && <span className="text-sm">⚠️</span>}
                                    </div>
                                    <div className="flex items-center gap-2">
                                      {appWarning && (
                                        <span className="text-xs bg-yellow-500/10 text-yellow-400 border border-yellow-500/20 px-2 py-0.5 rounded-full">
                                          Over 3h
                                        </span>
                                      )}
                                      <span className="text-sm font-mono" style={{ color: COLORS[i % COLORS.length] }}>
                                        {formatTime(app.seconds)}
                                      </span>
                                    </div>
                                  </div>
                                  <div className="w-full bg-gray-800 rounded-full h-1.5">
                                    <div
                                      className="h-1.5 rounded-full transition-all"
                                      style={{ width: `${pct}%`, backgroundColor: appWarning ? '#f59e0b' : COLORS[i % COLORS.length] }}
                                    />
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
              ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-900/40 rounded-2xl border border-gray-800">
                  <div className="text-4xl mb-3">👈</div>
                  <p className="text-gray-400 font-medium">Select a student</p>
                  <p className="text-gray-600 text-sm mt-1">to view their detailed usage</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Teachers Tab */}
        {activeTab === 'teachers' && (
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold">All Teachers</h3>
            </div>
            <div className="divide-y divide-gray-800/50">
              {teachers.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-sm font-bold shadow-lg">
                      {t.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{t.full_name}</p>
                      <p className="text-gray-500 text-xs">{t.email}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-purple-500/10 text-purple-400 border border-purple-500/20 px-3 py-1 rounded-full">Teacher</span>
                </div>
              ))}
              {teachers.length === 0 && <p className="text-gray-600 text-sm px-5 py-8 text-center">No teachers yet</p>}
            </div>
          </div>
        )}

        {/* Links Tab */}
        {activeTab === 'links' && (
          <div className="bg-gray-900/60 rounded-2xl border border-gray-800 p-6 max-w-lg">
            <h3 className="font-semibold mb-1">Link Teacher to Student</h3>
            <p className="text-gray-500 text-sm mb-4">Teachers can only see students they are linked to</p>
            <div className="space-y-3">
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Select Teacher</label>
                <select
                  className="w-full mt-1.5 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition"
                  value={selectedTeacher}
                  onChange={e => setSelectedTeacher(e.target.value)}
                >
                  <option value="">Choose a teacher...</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.full_name} — {t.email}</option>)}
                </select>
              </div>
              <div>
                <label className="text-gray-400 text-xs uppercase tracking-wider">Select Student</label>
                <select
                  className="w-full mt-1.5 bg-gray-800 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-purple-500 transition"
                  value={selectedStudentLink}
                  onChange={e => setSelectedStudentLink(e.target.value)}
                >
                  <option value="">Choose a student...</option>
                  {students.map(s => <option key={s.id} value={s.id}>{s.full_name} — {s.email}</option>)}
                </select>
              </div>
              {message && (
                <div className={`rounded-xl p-3 text-sm ${message.includes('Successfully') ? 'bg-green-500/10 text-green-400 border border-green-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                  {message}
                </div>
              )}
              <button
                onClick={linkTeacherStudent}
                className="w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-semibold py-3 rounded-xl transition shadow-lg shadow-purple-500/20"
              >
                Link Teacher to Student
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
