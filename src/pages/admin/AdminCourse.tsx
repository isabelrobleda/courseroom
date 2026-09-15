import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUp, ArrowDown, Plus, Trash2, ChevronRight, Pencil, Eye, EyeOff } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Course, Module } from '../../lib/types'
import { Empty, Modal, PageTitle, QuickForm } from '../../components/ui'

export default function AdminCourse() {
  const { courseId } = useParams()
  const [course, setCourse] = useState<Course | null>(null)
  const [modules, setModules] = useState<Module[]>([])
  const [creating, setCreating] = useState(false)
  const [editing, setEditing] = useState(false)
  const [extras, setExtras] = useState<Record<string, { items: number; quiz: boolean; hw: boolean }>>({})

  const load = async () => {
    const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single()
    setCourse(c as Course)
    const { data: m } = await supabase.from('modules').select('*').eq('course_id', courseId).order('position')
    const mods = (m ?? []) as Module[]
    setModules(mods)
    const ids = mods.map((x) => x.id)
    if (ids.length) {
      const [{ data: items }, { data: quizzes }, { data: hws }] = await Promise.all([
        supabase.from('content_items').select('module_id').in('module_id', ids),
        supabase.from('quizzes').select('module_id').in('module_id', ids),
        supabase.from('homework').select('module_id').in('module_id', ids),
      ])
      const e: typeof extras = {}
      for (const id of ids) e[id] = { items: 0, quiz: false, hw: false }
      for (const i of items ?? []) e[i.module_id].items++
      for (const q of quizzes ?? []) e[q.module_id].quiz = true
      for (const h of hws ?? []) e[h.module_id].hw = true
      setExtras(e)
    }
  }
  useEffect(() => { load() }, [courseId])

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= modules.length) return
    const a = modules[i], b = modules[j]
    await Promise.all([
      supabase.from('modules').update({ position: j }).eq('id', a.id),
      supabase.from('modules').update({ position: i }).eq('id', b.id),
    ])
    load()
  }
  const remove = async (m: Module) => {
    if (!confirm(`¿Eliminar el módulo "${m.title}"?`)) return
    await supabase.from('modules').delete().eq('id', m.id)
    load()
  }
  const togglePublish = async (m: Module) => {
    await supabase.from('modules').update({ published: !m.published }).eq('id', m.id)
    load()
  }

  if (!course) return null
  return (
    <>
      <div className="mb-2 text-sm text-ink/50"><Link to="/admin" className="hover:underline">Cursos</Link> / {course.title}</div>
      <PageTitle title={course.title} subtitle={course.description}
        actions={<>
          <button className="btn-ghost" onClick={() => setEditing(true)}><Pencil size={15} /> Editar</button>
          <button className="btn-accent" onClick={() => setCreating(true)}><Plus size={16} /> Nuevo módulo</button>
        </>} />
      {modules.length === 0 && <Empty>Aún no hay módulos. Un módulo contiene material (imágenes, PDF, videos, texto), un quiz opcional y una tarea opcional.</Empty>}
      <ol className="space-y-2">
        {modules.map((m, i) => {
          const x = extras[m.id]
          return (
            <li key={m.id} className="card flex items-center gap-3 !py-3">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-ink/5 text-sm font-bold">{i + 1}</span>
              <div className="min-w-0 flex-1">
                <Link to={`/admin/module/${m.id}`} className="font-bold hover:underline">{m.title}</Link>
                <div className="flex flex-wrap gap-2 text-xs text-ink/50">
                  <span>{x?.items ?? 0} elemento{x?.items === 1 ? '' : 's'} de contenido</span>
                  {x?.quiz && <span className="text-mint">· quiz</span>}
                  {x?.hw && <span className="text-accent">· tarea</span>}
                  {!m.published && <span className="badge bg-ink/5 text-ink/50">oculto</span>}
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button className="btn-ghost !px-2" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn-ghost !px-2" onClick={() => move(i, 1)} disabled={i === modules.length - 1}><ArrowDown size={14} /></button>
                <button className="btn-ghost !px-2" onClick={() => togglePublish(m)} title={m.published ? 'Ocultar a los alumnos' : 'Mostrar a los alumnos'}>{m.published ? <EyeOff size={14} /> : <Eye size={14} />}</button>
                <button className="btn-danger !px-2" onClick={() => remove(m)}><Trash2 size={14} /></button>
                <Link to={`/admin/module/${m.id}`} className="btn-primary !px-3">Editar <ChevronRight size={14} /></Link>
              </div>
            </li>
          )
        })}
      </ol>
      {creating && (
        <Modal title="Nuevo módulo" onClose={() => setCreating(false)}>
          <QuickForm submitLabel="Crear módulo" placeholder="Título del módulo" onSubmit={async (v) => {
            const { error } = await supabase.from('modules').insert({ course_id: courseId, title: v.title, description: v.description || null, position: modules.length })
            if (error) throw error
            setCreating(false); load()
          }} />
        </Modal>
      )}
      {editing && (
        <Modal title="Editar curso" onClose={() => setEditing(false)}>
          <QuickForm submitLabel="Guardar" initial={{ title: course.title, description: course.description ?? '' }} onSubmit={async (v) => {
            const { error } = await supabase.from('courses').update({ title: v.title, description: v.description || null }).eq('id', course.id)
            if (error) throw error
            setEditing(false); load()
          }} />
        </Modal>
      )}
    </>
  )
}
