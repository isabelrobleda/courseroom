import { useState, type FormEvent, type ReactNode } from 'react'
import { X } from 'lucide-react'

export function PageTitle({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-ink/60">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  )
}

export function Empty({ children }: { children: ReactNode }) {
  return <div className="card border-dashed text-center text-ink/50">{children}</div>
}

export function ErrorBox({ error }: { error: string | null }) {
  if (!error) return null
  return <div className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-ink/40 p-4" onClick={onClose}>
      <div className="card w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">{title}</h2>
          <button className="btn-ghost !p-1.5" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Tiny inline "title + description" form used for creating courses/modules. */
export function QuickForm({
  onSubmit, submitLabel = 'Save', placeholder = 'Title', withDescription = true, initial,
}: {
  onSubmit: (v: { title: string; description: string }) => Promise<void>
  submitLabel?: string; placeholder?: string; withDescription?: boolean
  initial?: { title: string; description: string }
}) {
  const [title, setTitle] = useState(initial?.title ?? '')
  const [description, setDescription] = useState(initial?.description ?? '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!title.trim()) return
    setBusy(true); setError(null)
    try { await onSubmit({ title: title.trim(), description: description.trim() }) }
    catch (err) { setError((err as Error).message) }
    finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-3">
      <input className="input" placeholder={placeholder} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      {withDescription && <textarea className="input" rows={3} placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />}
      <ErrorBox error={error} />
      <div className="flex justify-end"><button className="btn-primary" disabled={busy}>{submitLabel}</button></div>
    </form>
  )
}

export function fmtDate(d: string | null | undefined) {
  if (!d) return ''
  return new Date(d).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
