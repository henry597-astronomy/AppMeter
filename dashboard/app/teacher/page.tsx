'use client'
import { useEffect, useState } from 'react'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { useRouter } from 'next/navigation'

export default function TeacherDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [usage, setUsage] = useState<any[]>([])
  const [filter, setFilter] = useState<'today'|'week'|'month'>('today')
  const [loading, setLoading] = useState(false)
  const [totalTime, setTotalTime] = useState(0)
  const router = useRouter()

  useEffect(() => { fetchStudents() }, [])
  useEffect(() => { if (selected) fetchUsage(selected.student_id) }, [filter])

  const fetchStudents = async () => {
    const { data: user } = await supabase.auth.getUser()
    if (!user.user) { router.push('/login'); return }
    const { data } = await supabase
      .from('teacher_student_links')
      .select('student_id, profiles!teacher_student_links_student_id_fkey(full_name, id)')
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

  const COLORS = ['#3b82f6','#6366f1','#8b5cf6','#a78bfa','#60a5fa','#34d399','#fbbf24','#f87171','#fb923c','#e879f9']

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white">AppMeter</h1>
            <p className="text-xs text-gray-400">Teacher Dashboard</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm transition">Sign out</button>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1">
          <h2 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Students</h2>
          <div className="space-y-2">
            {students.length === 0 && (
              <p className="text-gray-600 text-sm">No students linked yet</p>
            )}
            {students.map((s: any) => (
              <button
                key={s.student_id}
                onClick={() => selectStudent(s)}
                className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
                  selected?.student_id === s.student_id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-gray-900 hover:bg-gray-800 text-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-xs font-bold">
                    {s.profiles?.full_name?.[0]?.toUpperCase()}
                  </div>
                  <span className="font-medium text-sm">{s.profiles?.full_name}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {selected ? (
            <>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold">{selected.profiles?.full_name}'s Usage</h2>
                <div className="flex gap-2">
                  {(['today','week','month'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition ${
                        filter === f ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Screen Time</p>
                  <p className="text-3xl font-bold text-blue-400">{formatTime(totalTime)}</p>
                </div>
                <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                  <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Apps Used</p>
                  <p className="text-3xl font-bold text-purple-400">{usage.length}</p>
                </div>
              </div>

              {loading ? (
                <div className="flex items-center justify-center h-48">
                  <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"/>
                </div>
              ) : usage.length > 0 ? (
                <>
                  <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
                    <h3 className="text-sm font-semibold text-gray-400 mb-4">Usage by App (minutes)</h3>
                    <ResponsiveContainer width="100%" height={220}>
                      <BarChart data={usage} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                        <XAxis dataKey="name" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <YAxis tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false}/>
                        <Tooltip
                          contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '12px' }}
                          labelStyle={{ color: '#fff' }}
                          formatter={(v: any) => [`${v} min`, 'Time']}
                        />
                        <Bar dataKey="minutes" radius={[6,6,0,0]}>
                          {usage.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]}/>)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-800">
                      <h3 className="text-sm font-semibold text-gray-400">App Breakdown</h3>
                    </div>
                    <div className="divide-y divide-gray-800">
                      {usage.map((app, i) => (
                        <div key={app.name} className="flex items-center justify-between px-5 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }}/>
                            <span className="text-sm font-medium">{app.name}</span>
                          </div>
                          <span className="text-sm font-mono text-blue-400">{formatTime(app.seconds)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
                  <p className="text-gray-500">No usage data for this period</p>
                </div>
              )}
            </>
          ) : (
            <div className="bg-gray-900 rounded-2xl p-12 border border-gray-800 text-center">
              <p className="text-gray-400 text-lg font-medium">Select a student</p>
              <p className="text-gray-600 text-sm mt-1">Choose a student from the left to view their app usage</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
