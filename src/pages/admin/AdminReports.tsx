import { useEffect, useMemo, useState } from 'react'
import { Download, Check, Minus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { downloadCsv, toCsv } from '../../lib/csv'
import { Empty, PageTitle, fmtDate } from '../../components/ui'

interface ReportRow {
  user_id: string; email: string; full_name: string | null
  course_id: string; course_title: string
  module_id: string; module_title: string; module_position: number
  module_read: boolean; viewed_at: string | null
  quiz_id: string | null; best_score: number | null; quiz_total: number | null; quiz_attempts: number
  homework_id: string | null; homework_submitted: boolean; homework_submitted_at: string | null
}

export default function AdminReports() {
  const [rows, setRows] = useState<ReportRow[]>([])
  const [courseId, setCourseId] = useState<string>('')
  const [view, setView] = useState<'matrix' | 'detail'>('matrix')

  useEffect(() => {
    supabase.from('student_module_report').select('*').order('email').order('module_position').then(({ data }) => setRows((data ?? []) as ReportRow[]))
  }, [])

  const courses = useMemo(() => {
    const m = new Map<string, string>()
    rows.forEach((r) => m.set(r.course_id, r.course_title))
    return [...m.entries()]
  }, [rows])
  useEffect(() => { if (!courseId && courses.length) setCourseId(courses[0][0]) }, [courses, courseId])

  const filtered = rows.filter((r) => r.course_id === courseId)
  const modules = useMemo(() => {
    const m = new Map<string, { title: string; pos: number; hasQuiz: boolean; hasHw: boolean }>()
    filtered.forEach((r) => m.set(r.module_id, { title: r.module_title, pos: r.module_position, hasQuiz: !!r.quiz_id, hasHw: !!r.homework_id }))
    return [...m.entries()].sort((a, b) => a[1].pos - b[1].pos)
  }, [filtered])
  const students = useMemo(() => {
    const m = new Map<string, { email: string; name: string | null }>()
    filtered.forEach((r) => m.set(r.user_id, { email: r.email, name: r.full_name }))
    return [...m.entries()].sort((a, b) => (a[1].name ?? a[1].email).localeCompare(b[1].name ?? b[1].email))
  }, [filtered])
  const cell = (uid: string, mid: string) => filtered.find((r) => r.user_id === uid && r.module_id === mid)

  const exportDetail = () => {
    const csv = toCsv(filtered.map((r) => ({
      alumno: r.full_name ?? '', correo: r.email, curso: r.course_title,
      modulo_num: r.module_position + 1, modulo: r.module_title,
      leido: r.module_read ? 'sí' : 'no', fecha_lectura: r.viewed_at ?? '',
      tiene_quiz: r.quiz_id ? 'sí' : 'no', quiz_realizado: r.quiz_id ? (r.best_score != null ? 'sí' : 'no') : '',
      quiz_mejor_puntaje: r.best_score ?? '', quiz_total_preguntas: r.quiz_total ?? '', quiz_intentos: r.quiz_id ? r.quiz_attempts : '',
      tiene_tarea: r.homework_id ? 'sí' : 'no', tarea_entregada: r.homework_id ? (r.homework_submitted ? 'sí' : 'no') : '', fecha_entrega_tarea: r.homework_submitted_at ?? '',
    })))
    downloadCsv(`reporte_${courses.find((c) => c[0] === courseId)?.[1] ?? 'curso'}_detalle.csv`, csv)
  }
  const exportSummary = () => {
    const csv = toCsv(students.map(([uid, s]) => {
      const mine = filtered.filter((r) => r.user_id === uid)
      const quizzes = mine.filter((r) => r.quiz_id)
      const hws = mine.filter((r) => r.homework_id)
      const scored = quizzes.filter((r) => r.best_score != null)
      return {
        alumno: s.name ?? '', correo: s.email,
        modulos_total: mine.length, modulos_leidos: mine.filter((r) => r.module_read).length,
        quizzes_total: quizzes.length, quizzes_realizados: scored.length,
        respuestas_correctas: scored.reduce((a, r) => a + (r.best_score ?? 0), 0),
        preguntas_total: scored.reduce((a, r) => a + (r.quiz_total ?? 0), 0),
        tareas_total: hws.length, tareas_entregadas: hws.filter((r) => r.homework_submitted).length,
      }
    }))
    downloadCsv(`reporte_${courses.find((c) => c[0] === courseId)?.[1] ?? 'curso'}_resumen.csv`, csv)
  }

  return (
    <>
      <PageTitle title="Reportes" subtitle="Quién ha leído cada módulo, resultados de quizzes y entregas de tareas."
        actions={<>
          <button className="btn-ghost" onClick={exportSummary} disabled={!filtered.length}><Download size={16} /> CSV resumen</button>
          <button className="btn-primary" onClick={exportDetail} disabled={!filtered.length}><Download size={16} /> CSV detallado</button>
        </>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select className="input !w-auto" value={courseId} onChange={(e) => setCourseId(e.target.value)}>
          {courses.map(([id, t]) => <option key={id} value={id}>{t}</option>)}
        </select>
        <div className="flex rounded-lg bg-ink/5 p-1 text-sm font-semibold">
          {(['matrix', 'detail'] as const).map((v) => <button key={v} onClick={() => setView(v)} className={`rounded-md px-3 py-1 ${view === v ? 'bg-white shadow-sm' : 'text-ink/50'}`}>{v === 'matrix' ? 'Matriz' : 'Detalle'}</button>)}
        </div>
        <span className="text-sm text-ink/50">{students.length} alumno{students.length === 1 ? '' : 's'}</span>
      </div>

      {students.length === 0 && <Empty>Todavía no hay alumnos registrados (o este curso no tiene módulos).</Empty>}

      {students.length > 0 && view === 'matrix' && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
              <tr>
                <th className="sticky left-0 bg-ink/5 px-4 py-3">Alumno</th>
                {modules.map(([id, m], i) => <th key={id} className="px-3 py-3 text-center font-semibold" title={m.title}>M{i + 1}</th>)}
                <th className="px-4 py-3 text-right">Total quizzes</th>
              </tr>
            </thead>
            <tbody>
              {students.map(([uid, s]) => {
                const mine = filtered.filter((r) => r.user_id === uid && r.quiz_id && r.best_score != null)
                const tot = mine.reduce((a, r) => a + (r.quiz_total ?? 0), 0), got = mine.reduce((a, r) => a + (r.best_score ?? 0), 0)
                return (
                  <tr key={uid} className="border-t border-ink/5">
                    <td className="sticky left-0 bg-white px-4 py-2"><div className="font-semibold">{s.name || s.email}</div><div className="text-xs text-ink/50">{s.email}</div></td>
                    {modules.map(([mid, m]) => {
                      const r = cell(uid, mid)
                      return (
                        <td key={mid} className="px-3 py-2">
                          <div className="flex flex-col items-center gap-1">
                            <span className={`grid h-6 w-6 place-items-center rounded-full ${r?.module_read ? 'bg-mint text-white' : 'bg-ink/5 text-ink/30'}`} title={r?.module_read ? `Leído el ${fmtDate(r.viewed_at)}` : 'No leído'}>{r?.module_read ? <Check size={14} /> : <Minus size={14} />}</span>
                            {m.hasQuiz && <span className={`text-xs font-bold ${r?.best_score != null ? 'text-mint' : 'text-ink/30'}`}>{r?.best_score != null ? `${r.best_score}/${r.quiz_total}` : '–/–'}</span>}
                            {m.hasHw && <span className={`badge !px-1.5 !py-0 ${r?.homework_submitted ? 'bg-accent-soft text-accent' : 'bg-ink/5 text-ink/30'}`}>HW</span>}
                          </div>
                        </td>
                      )
                    })}
                    <td className="px-4 py-2 text-right font-bold">{tot ? `${got}/${tot}` : '–'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <div className="flex flex-wrap gap-4 border-t border-ink/5 px-4 py-2 text-xs text-ink/50">
            <span><span className="inline-block h-3 w-3 rounded-full bg-mint align-middle" /> módulo leído</span>
            <span><b className="text-mint">3/5</b> mejor resultado del quiz</span>
            <span><span className="badge !px-1.5 !py-0 bg-accent-soft text-accent">HW</span> tarea entregada</span>
            {modules.map(([id, m], i) => <span key={id}>M{i + 1} = {m.title}</span>)}
          </div>
        </div>
      )}

      {students.length > 0 && view === 'detail' && (
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-sm">
            <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60">
              <tr><th className="px-4 py-3">Alumno</th><th className="px-4 py-3">Módulo</th><th className="px-4 py-3">Leído</th><th className="px-4 py-3">Quiz</th><th className="px-4 py-3">Intentos</th><th className="px-4 py-3">Tarea</th></tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.user_id + r.module_id} className="border-t border-ink/5">
                  <td className="px-4 py-2"><div className="font-semibold">{r.full_name || r.email}</div><div className="text-xs text-ink/50">{r.email}</div></td>
                  <td className="px-4 py-2">{r.module_position + 1}. {r.module_title}</td>
                  <td className="px-4 py-2">{r.module_read ? <span className="text-mint">✓ {fmtDate(r.viewed_at)}</span> : <span className="text-ink/30">—</span>}</td>
                  <td className="px-4 py-2">{r.quiz_id ? (r.best_score != null ? <b>{r.best_score}/{r.quiz_total}</b> : <span className="text-ink/30">sin hacer</span>) : <span className="text-ink/20">sin quiz</span>}</td>
                  <td className="px-4 py-2">{r.quiz_id ? r.quiz_attempts : ''}</td>
                  <td className="px-4 py-2">{r.homework_id ? (r.homework_submitted ? <span className="text-accent">✓ {fmtDate(r.homework_submitted_at)}</span> : <span className="text-ink/30">pendiente</span>) : <span className="text-ink/20">sin tarea</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}
