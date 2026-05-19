'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function AdminDashboard() {
  const [students, setStudents] = useState<any[]>([])
  const [teachers, setTeachers] = useState<any[]>([])
  const [selectedStudent, setSelectedStudent] = useState<string>('')
  const [selectedTeacher, setSelectedTeacher] = useState<string>('')
  const [activeTab, setActiveTab] = useState<'students'|'teachers'|'links'>('students')
  const [message, setMessage] = useState('')
  const router = useRouter()

  useEffect(() => { checkAdmin(); fetchAll() }, [])

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
  }

  const linkTeacherStudent = async () => {
    if (!selectedTeacher || !selectedStudent) {
      setMessage('Please select both a teacher and a student')
      return
    }
    const { error } = await supabase.from('teacher_student_links').insert({
      teacher_id: selectedTeacher,
      student_id: selectedStudent
    })
    if (error) setMessage('Already linked or error: ' + error.message)
    else setMessage('Successfully linked!')
    setTimeout(() => setMessage(''), 3000)
  }

  const logout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const tabs = ['students', 'teachers', 'links'] as const

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
            <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
          </div>
          <div>
            <h1 className="font-bold text-white">AppMeter</h1>
            <p className="text-xs text-gray-400">Admin Dashboard</p>
          </div>
        </div>
        <button onClick={logout} className="text-gray-400 hover:text-white text-sm transition">Sign out</button>
      </div>

      <div className="p-6 max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Students</p>
            <p className="text-3xl font-bold text-blue-400">{students.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">Total Teachers</p>
            <p className="text-3xl font-bold text-purple-400">{teachers.length}</p>
          </div>
          <div className="bg-gray-900 rounded-2xl p-5 border border-gray-800">
            <p className="text-gray-400 text-xs uppercase tracking-wider mb-1">System Status</p>
            <p className="text-lg font-bold text-green-400">Active</p>
          </div>
        </div>

        <div className="flex gap-2 mb-6">
          {tabs.map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-medium capitalize transition ${
                activeTab === tab ? 'bg-purple-600 text-white' : 'bg-gray-900 text-gray-400 hover:bg-gray-800'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'students' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold">All Students</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {students.map(s => (
                <div key={s.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-sm font-bold text-blue-400">
                      {s.full_name?.[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{s.full_name}</p>
                      <p className="text-gray-500 text-xs">{s.email}</p>
                    </div>
                  </div>
                  <span className="text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 px-3 py-1 rounded-full">Student</span>
                </div>
              ))}
              {students.length === 0 && <p className="text-gray-600 text-sm px-5 py-8 text-center">No students yet</p>}
            </div>
          </div>
        )}

        {activeTab === 'teachers' && (
          <div className="bg-gray-900 rounded-2xl border border-gray-800 overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800">
              <h3 className="font-semibold">All Teachers</h3>
            </div>
            <div className="divide-y divide-gray-800">
              {teachers.map(t => (
                <div key={t.id} className="flex items-center justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-sm font-bold text-purple-400">
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

        {activeTab === 'links' && (
          <div className="space-y-4">
            <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
              <h3 className="font-semibold mb-4">Link Teacher to Student</h3>
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
                    value={selectedStudent}
                    onChange={e => setSelectedStudent(e.target.value)}
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
                  className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold py-3 rounded-xl transition"
                >
                  Link Teacher to Student
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
