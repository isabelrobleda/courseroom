import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Eye, EyeOff, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Course } from '../../lib/types'
import { Empty, Modal, PageTitle, QuickForm } from '../../components/ui'

export default function AdminCourses() {
  const [courses, setCourses] = useState<Course[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [creating, setCreating] = useState(false)

  const load = async () => {
    const { data } = await supabase.from('courses').select('*').order('created_at')
    setCourses((data ?? []) as Course[])
    const { data: mods } = await supabase.from('modules').select('course_id')
    const c: Record<string, number> = {}
    for (const m of mods ?? []) c[m.course_id] = (c[m.course_id] ?? 0) + 1
    setCounts(c)
  }
  useEffect(() => { load() }, [])

  const togglePublish = async (c: Course) => {
    await supabase.from('courses').update({ published: !c.published }).eq('id', c.id)
    load()
  }
  const remove = async (c: Course) => {
    if (!confirm(`¿Eliminar "${c.title}" con todos sus módulos, quizzes y el progreso de los alumnos?`)) return
    await supabase.from('courses').delete().eq('id', c.id)
    load()
  }

  return (
    <>
      <PageTitle title="Cursos" subtitle="Cada curso es un conjunto de módulos con contenido, quiz y tarea."
        actions={<button className="btn-accent" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo curso</button>} />
      {courses.length === 0 && <Empty>Aún no hay cursos. Crea el primero.</Empty>}
      <div className="grid gap-3 sm:grid-cols-2">
        {courses.map((c) => (
          <div key={c.id} className="card flex flex-col gap-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <Link to={`/admin/course/${c.id}`} className="text-lg font-bold hover:underline">{c.title}</Link>
                <p className="text-sm text-ink/60">{c.description}</p>
              </div>
              <span className={`badge ${c.published ? 'bg-mint-soft text-mint' : 'bg-ink/5 text-ink/50'}`}>{c.published ? 'Publicado' : 'Borrador'}</span>
            </div>
            <div className="mt-auto flex items-center justify-between text-sm text-ink/60">
              <span>{counts[c.id] ?? 0} módulo{(counts[c.id] ?? 0) === 1 ? '' : 's'}</span>
              <div className="flex gap-1">
                <button className="btn-ghost !px-2" onClick={() => togglePublish(c)} title={c.published ? 'Despublicar' : 'Publicar'}>{c.published ? <EyeOff size={15} /> : <Eye size={15} />}</button>
                <button className="btn-danger !px-2" onClick={() => remove(c)}><Trash2 size={15} /></button>
                <Link to={`/admin/course/${c.id}`} className="btn-primary !px-3">Abrir <ChevronRight size={15} /></Link>
              </div>
            </div>
          </div>
        ))}
      </div>
      {creating && (
        <Modal title="Nuevo curso" onClose={() => setCreating(false)}>
          <QuickForm submitLabel="Crear curso" placeholder="Título del curso" onSubmit={async (v) => {
            const { error } = await supabase.from('courses').insert({ title: v.title, description: v.description || null })
            if (error) throw error
            setCreating(false); load()
          }} />
        </Modal>
      )}
    </>
  )
}
