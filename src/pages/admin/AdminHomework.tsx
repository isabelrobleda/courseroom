import { useEffect, useMemo, useState } from 'react'
import { Download, FileUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { homeworkSignedUrl } from '../../lib/storage'
import { Empty, PageTitle, fmtDate } from '../../components/ui'

interface Sub {
  id: string; text_answer: string | null; file_path: string | null; file_name: string | null; submitted_at: string
  profiles: { email: string; full_name: string | null }
  homework: { id: string; title: string; modules: { title: string; position: number; courses: { title: string } } }
}

export default function AdminHomework() {
  const [subs, setSubs] = useState<Sub[]>([])
  const [filter, setFilter] = useState('')
  const [studentFilter, setStudentFilter] = useState('')
  const [links, setLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    supabase.from('homework_submissions')
      .select('id, text_answer, file_path, file_name, submitted_at, profiles(email, full_name), homework(id, title, modules(title, position, courses(title)))')
      .order('submitted_at', { ascending: false })
      .then(({ data }) => setSubs((data ?? []) as unknown as Sub[]))
  }, [])

  const openFile = async (s: Sub) => {
    if (!s.file_path) return
    const url = links[s.id] ?? await homeworkSignedUrl(s.file_path)
    setLinks((l) => ({ ...l, [s.id]: url }))
    window.open(url, '_blank')
  }

  const homeworks = useMemo(() => {
    const m = new Map<string, string>()
    subs.forEach((s) => m.set(s.homework.id, `${s.homework.modules.courses.title} › ${s.homework.modules.position + 1}. ${s.homework.modules.title}`))
    return [...m.entries()]
  }, [subs])
  const students = useMemo(() => {
    const m = new Map<string, string>()
    subs.forEach((s) => m.set(s.profiles.email, s.profiles.full_name || s.profiles.email))
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]))
  }, [subs])

  const shown = subs.filter((s) => (!filter || s.homework.id === filter) && (!studentFilter || s.profiles.email === studentFilter))

  return (
    <>
      <PageTitle title="Tareas entregadas" subtitle="Todo lo que los alumnos han entregado, lo más reciente primero." />
      <div className="mb-4 flex flex-wrap gap-3">
        <select className="input !w-auto" value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="">Todos los módulos</option>
          {homeworks.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
        </select>
        <select className="input !w-auto" value={studentFilter} onChange={(e) => setStudentFilter(e.target.value)}>
          <option value="">Todos los alumnos</option>
          {students.map(([email, name]) => <option key={email} value={email}>{name}</option>)}
        </select>
        <span className="self-center text-sm text-ink/50">{shown.length} entrega{shown.length === 1 ? '' : 's'}</span>
      </div>
      {shown.length === 0 && <Empty>Todavía no hay tareas entregadas.</Empty>}
      <div className="space-y-3">
        {shown.map((s) => (
          <div key={s.id} className="card">
            <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <span className="font-bold">{s.profiles.full_name || s.profiles.email}</span>
                <span className="ml-2 text-xs text-ink/50">{s.profiles.email}</span>
              </div>
              <span className="text-xs text-ink/50">{fmtDate(s.submitted_at)}</span>
            </div>
            <div className="mb-3 text-xs font-semibold uppercase tracking-wide text-accent">
              {s.homework.modules.courses.title} › {s.homework.modules.position + 1}. {s.homework.modules.title} · {s.homework.title}
            </div>
            {s.text_answer && <p className="whitespace-pre-wrap rounded-xl bg-ink/[0.03] p-3 text-sm">{s.text_answer}</p>}
            {s.file_path && (
              <button onClick={() => openFile(s)} className="btn-ghost mt-2"><FileUp size={15} /> {s.file_name || 'Archivo adjunto'} <Download size={14} className="text-ink/40" /></button>
            )}
          </div>
        ))}
      </div>
    </>
  )
}
