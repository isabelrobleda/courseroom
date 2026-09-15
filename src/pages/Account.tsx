import { useState, type FormEvent } from 'react'
import { KeyRound, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { ErrorBox, PageTitle } from '../components/ui'

export default function Account() {
  const { profile } = useAuth()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null); setDone(false)
    if (pw.length < 8) { setError('La contraseña debe tener al menos 8 caracteres.'); return }
    if (pw !== pw2) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) { setError(error.message); return }
    setPw(''); setPw2(''); setDone(true)
  }

  return (
    <div className="mx-auto max-w-md">
      <PageTitle title="Mi cuenta" subtitle={profile?.email} />
      <form onSubmit={submit} className="card space-y-4">
        <div className="flex items-center gap-2 font-bold"><KeyRound size={18} /> Cambiar contraseña</div>
        <div><label className="label">Nueva contraseña</label><input className="input" type="password" minLength={8} value={pw} onChange={(e) => setPw(e.target.value)} required autoComplete="new-password" /></div>
        <div><label className="label">Repite la nueva contraseña</label><input className="input" type="password" minLength={8} value={pw2} onChange={(e) => setPw2(e.target.value)} required autoComplete="new-password" /></div>
        <ErrorBox error={error} />
        {done && <div className="flex items-center gap-2 rounded-lg bg-mint-soft px-3 py-2 text-sm text-mint"><Check size={16} /> Contraseña actualizada. Úsala la próxima vez que inicies sesión.</div>}
        <button className="btn-primary w-full justify-center" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
      </form>
    </div>
  )
}
