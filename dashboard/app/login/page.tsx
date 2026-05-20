'use client'
import { useState } from 'react'

export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', data.user.id)
      .single()

    if (profileError || !profile) {
      setError('Profile not found. Contact admin.')
      setLoading(false)
      return
    }

    if (profile.role === 'admin') router.push('/admin')
    else if (profile.role === 'teacher') router.push('/teacher')
    else {
      setError('Access denied. Only teachers and admins can log in here.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-br from-blue-950 via-gray-950 to-purple-950 opacity-80"/>
      <div className="absolute top-20 left-20 w-72 h-72 bg-blue-600 rounded-full filter blur-3xl opacity-10 animate-pulse"/>
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-purple-600 rounded-full filter blur-3xl opacity-10 animate-pulse"/>

      <div className="relative z-10 w-full max-w-md px-6">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-blue-600 mb-4 shadow-lg shadow-blue-500/30">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">AppMeter</h1>
          <p className="text-gray-400 mt-2 text-sm">Student Usage Dashboard</p>
        </div>

        <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-800 rounded-3xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6">Sign in to continue</h2>

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4">
              <p className="text-red-400 text-sm">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Email</label>
              <input
                className="w-full mt-1.5 bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="your@email.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                type="email"
              />
            </div>

            <div>
              <label className="text-gray-400 text-xs font-medium uppercase tracking-wider">Password</label>
              <input
                type="password"
                className="w-full mt-1.5 bg-gray-800/50 border border-gray-700 text-white rounded-xl px-4 py-3 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
              />
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-all duration-200 shadow-lg shadow-blue-500/20 mt-2"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
