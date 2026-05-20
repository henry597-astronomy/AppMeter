'use client'

import { useState } from 'react'
export const dynamic = 'force-dynamic'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { Smartphone, Lock, Mail, Loader2, AlertCircle } from 'lucide-react'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async () => {
    setLoading(true)
    setError('')

    try {
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) throw authError

      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile) {
        throw new Error('Profile not found. Please contact your administrator.')
      }

      if (profile.role === 'admin') router.push('/admin')
      else if (profile.role === 'teacher') router.push('/teacher')
      else {
        throw new Error('Access denied. Only teachers and admins can access this portal.')
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#020617] text-slate-200 flex items-center justify-center p-6 relative overflow-hidden selection:bg-indigo-500/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-600/10 blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px]" />
      </div>

      <div className="w-full max-w-[440px] relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-[28px] bg-gradient-to-br from-indigo-500 to-blue-600 shadow-2xl shadow-indigo-500/20 mb-6">
            <Smartphone className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-4xl font-black text-white tracking-tight mb-2">AppMeter</h1>
          <p className="text-slate-400 font-medium">Education Monitoring Portal</p>
        </div>

        <div className="bg-slate-900/40 backdrop-blur-2xl border border-white/5 rounded-[40px] p-10 shadow-2xl">
          <h2 className="text-xl font-bold text-white mb-8">Sign in to continue</h2>

          {error && (
            <div className="bg-rose-500/10 border border-rose-500/20 rounded-2xl p-4 mb-6 flex items-start gap-3 animate-in zoom-in duration-300">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <p className="text-sm text-rose-400 font-medium leading-relaxed">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Email Address</label>
              <div className="relative group">
                <Mail className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  className="w-full bg-slate-950/50 border border-white/10 text-white rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-600"
                  placeholder="name@institution.edu"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  type="email"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 ml-1">Secure Password</label>
              <div className="relative group">
                <Lock className="w-5 h-5 absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="password"
                  className="w-full bg-slate-950/50 border border-white/10 text-white rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 transition-all placeholder:text-slate-600"
                  placeholder="••••••••••••"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleLogin()}
                />
              </div>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-gradient-to-r from-indigo-500 to-blue-600 hover:from-indigo-600 hover:to-blue-700 disabled:opacity-50 text-white font-black py-5 rounded-2xl shadow-xl shadow-indigo-500/20 transition-all active:scale-[0.98] mt-4 flex items-center justify-center gap-3"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <span>Access Dashboard</span>
              )}
            </button>
          </div>
        </div>
        
        <p className="text-center mt-8 text-slate-500 text-sm">
          Protected by industry standard encryption.
        </p>
      </div>
    </div>
  )
}
