import { useState, type FormEvent } from 'react'
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

  const forgot = async () => {
    if (!email) { setError('Escribe tu correo arriba y vuelve a pulsar "Olvidé mi contraseña".'); return }
    setBusy(true); setError(null); setNotice(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/cuenta` })
    setBusy(false)
    if (error) setError(error.message)
    else setNotice('Te enviamos un correo con un enlace para crear una contraseña nueva.')
  }

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
        if (!data.session) setNotice('Revisa tu correo para confirmar tu cuenta y después inicia sesión.')
      }
    } catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }

  return (
    <div className="grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/teammeet.png" alt="Team Meet" className="h-36 w-36" />
          <div className="text-sm font-semibold text-ink/50">Colegio Senda · Formación docente</div>
        </div>
        <form onSubmit={submit} className="card space-y-4">
          <div className="grid grid-cols-2 rounded-lg bg-ink/5 p-1 text-sm font-semibold">
            {(['signin', 'signup'] as const).map((m) => (
              <button type="button" key={m} onClick={() => setMode(m)} className={`rounded-md py-1.5 ${mode === m ? 'bg-white shadow-sm' : 'text-ink/50'}`}>
                {m === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}
              </button>
            ))}
          </div>
          {mode === 'signup' && (
            <div><label className="label">Nombre completo</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} required /></div>
          )}
          <div><label className="label">Correo electrónico</label><input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required /></div>
          <div><label className="label">Contraseña</label><input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} required /></div>
          <ErrorBox error={error} />
          {notice && <div className="rounded-lg bg-mint-soft px-3 py-2 text-sm text-mint">{notice}</div>}
          <button className="btn-primary w-full justify-center" disabled={busy}>{mode === 'signin' ? 'Iniciar sesión' : 'Crear cuenta'}</button>
          {mode === 'signin' && (
            <button type="button" onClick={forgot} disabled={busy} className="w-full text-center text-sm font-semibold text-ink/50 hover:text-ink">Olvidé mi contraseña</button>
          )}
        </form>
      </div>
    </div>
  )
}
