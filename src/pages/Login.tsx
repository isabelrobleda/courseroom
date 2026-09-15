import { useState, type FormEvent } from 'react'
import { GraduationCap } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { ErrorBox } from '../components/ui'

export default function Login() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null); setNotice(null)
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
        if (!data.session) setNotice('Check your inbox to confirm your email, then sign in.')
      }
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 text-2xl font-extrabold tracking-tight">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-white"><GraduationCap size={22} /></span>
          Courseroom
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <div className="grid grid-cols-2 rounded-lg bg-ink/5 p-1 text-sm font-semibold">
            {(['signin', 'signup'] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-md py-1.5 ${mode === m ? 'bg-white shadow-sm' : 'text-ink/50'}`}>
                {m === 'signin' ? 'Sign in' : 'Create account'}
              </button>
            ))}
          </div>
          {mode === 'signup' && (
            <div><label className="label">Full name</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div><label className="label">Email</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Password</label><input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <ErrorBox error={error} />
          {notice && <div className="rounded-lg bg-mint-soft px-3 py-2 text-sm text-mint">{notice}</div>}
          <button className="btn-primary w-full justify-center" disabled={busy}>{mode === 'signin' ? 'Sign in' : 'Create account'}</button>
        </form>
      </div>
    </div>
  )
}
