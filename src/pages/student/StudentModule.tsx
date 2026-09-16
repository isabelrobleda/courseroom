import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, CheckCircle2, FileUp, RotateCcw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { ContentItem, Homework, HomeworkSubmission, Module, Quiz, QuizAttempt, QuizQuestion } from '../../lib/types'
import { homeworkSignedUrl, uploadHomeworkFile } from '../../lib/storage'
import ContentViewer from '../../components/ContentViewer'
import { ErrorBox, fmtDate } from '../../components/ui'

export default function StudentModule() {
  const { moduleId } = useParams()
  const { session, profile } = useAuth()
  const uid = session!.user.id
  const [mod, setMod] = useState<Module | null>(null)
  const [siblings, setSiblings] = useState<Module[]>([])
  const [items, setItems] = useState<ContentItem[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [attempts, setAttempts] = useState<QuizAttempt[]>([])
  const [hw, setHw] = useState<Homework | null>(null)
  const [subs, setSubs] = useState<HomeworkSubmission[]>([])

  const load = async () => {
    const { data: m } = await supabase.from('modules').select('*').eq('id', moduleId).single()
    const module = m as Module
    setMod(module)
    const [{ data: sib }, { data: it }, { data: q }, { data: h }] = await Promise.all([
      supabase.from('modules').select('*').eq('course_id', module.course_id).eq('published', true).order('position'),
      supabase.from('content_items').select('*').eq('module_id', moduleId).order('position'),
      supabase.from('quizzes').select('*').eq('module_id', moduleId).maybeSingle(),
      supabase.from('homework').select('*').eq('module_id', moduleId).maybeSingle(),
    ])
    setSiblings((sib ?? []) as Module[]); setItems((it ?? []) as ContentItem[]); setQuiz(q as Quiz | null); setHw(h as Homework | null)
    if (q) {
      const [{ data: qs }, { data: at }] = await Promise.all([
        supabase.from('quiz_questions').select('*').eq('quiz_id', q.id).order('position'),
        supabase.from('quiz_attempts').select('*').eq('quiz_id', q.id).eq('user_id', uid).order('created_at', { ascending: false }),
      ])
      setQuestions((qs ?? []) as QuizQuestion[]); setAttempts((at ?? []) as QuizAttempt[])
    }
    if (h) {
      const { data: s } = await supabase.from('homework_submissions').select('*').eq('homework_id', h.id).eq('user_id', uid).order('submitted_at', { ascending: false })
      setSubs((s ?? []) as HomeworkSubmission[])
    }
    // Mark as read (students only — don't pollute reports when the teacher previews)
    if (profile?.role === 'student') {
      await supabase.from('module_views').upsert({ user_id: uid, module_id: moduleId }, { onConflict: 'user_id,module_id', ignoreDuplicates: true })
    }
  }
  useEffect(() => { load() }, [moduleId])

  if (!mod) return null
  const idx = siblings.findIndex((s) => s.id === mod.id)
  const prev = siblings[idx - 1], next = siblings[idx + 1]

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-2 text-sm text-ink/50"><Link to={`/course/${mod.course_id}`} className="hover:underline">Volver al curso</Link></div>
      <div className="mb-8">
        <div className="text-xs font-semibold uppercase tracking-wide text-ink/40">Módulo {idx + 1} de {siblings.length}</div>
        <h1 className="text-3xl font-extrabold tracking-tight">{mod.title}</h1>
        {mod.description && <p className="mt-2 text-ink/60">{mod.description}</p>}
      </div>

      <div className="space-y-8">
        {items.map((it) => (
          <section key={it.id}>
            {it.type !== 'text' && <h2 className="mb-2 font-bold">{it.title}</h2>}
            <ContentViewer item={it} />
          </section>
        ))}
        {items.length === 0 && <p className="text-ink/50">Este módulo aún no tiene contenido.</p>}
      </div>

      {quiz && questions.length > 0 && (
        <QuizBlock quiz={quiz} questions={questions} attempts={attempts} uid={uid} onDone={load} readOnly={profile?.role !== 'student'} />
      )}
      {hw && <HomeworkBlock hw={hw} subs={subs} uid={uid} onDone={load} readOnly={profile?.role !== 'student'} />}

      <div className="mt-12 flex justify-between border-t border-ink/10 pt-6">
        {prev ? <Link to={`/module/${prev.id}`} className="btn-ghost"><ArrowLeft size={16} /> {prev.title}</Link> : <span />}
        {next ? <Link to={`/module/${next.id}`} className="btn-primary">{next.title} <ArrowRight size={16} /></Link> : <Link to={`/course/${mod.course_id}`} className="btn-primary">Terminar curso <CheckCircle2 size={16} /></Link>}
      </div>
    </div>
  )
}

function QuizBlock({ quiz, questions, attempts, uid, onDone, readOnly }: { quiz: Quiz; questions: QuizQuestion[]; attempts: QuizAttempt[]; uid: string; onDone: () => void; readOnly: boolean }) {
  const [answers, setAnswers] = useState<Record<string, number>>({})
  const [retaking, setRetaking] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const last = attempts[0]
  const best = attempts.reduce<QuizAttempt | null>((b, a) => (!b || a.score > b.score ? a : b), null)
  const showForm = !last || retaking

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (Object.keys(answers).length < questions.length) { setError('Responde todas las preguntas antes de enviar.'); return }
    setBusy(true); setError(null)
    const ordered = questions.map((q) => answers[q.id])
    const score = questions.reduce((s, q, i) => s + (ordered[i] === q.correct_index ? 1 : 0), 0)
    if (readOnly) { alert(`Vista previa: obtendrías ${score}/${questions.length}. Los intentos de docentes no se guardan.`); setBusy(false); return }
    const { error } = await supabase.from('quiz_attempts').insert({ user_id: uid, quiz_id: quiz.id, score, total: questions.length, answers: ordered })
    setBusy(false)
    if (error) { setError(error.message); return }
    setRetaking(false); setAnswers({}); onDone()
  }

  return (
    <section className="mt-12 rounded-2xl border-2 border-lime/60 bg-mint-soft/50 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-extrabold">{quiz.title}</h2>
        {best && <span className="badge bg-mint text-white">Mejor: {best.score}/{best.total}</span>}
      </div>
      {!showForm && last ? (
        <div>
          <p className="mb-1 text-lg font-bold">Obtuviste {last.score} de {last.total}{quiz.pass_score != null && (last.score >= quiz.pass_score ? ' — aprobado 🎉' : ` — necesitas ${quiz.pass_score} para aprobar`)}</p>
          <p className="mb-4 text-sm text-ink/60">Enviado el {fmtDate(last.created_at)} · {attempts.length} intento{attempts.length === 1 ? '' : 's'}</p>
          <ol className="space-y-3">
            {questions.map((q, i) => {
              const a = last.answers[i]; const ok = a === q.correct_index
              return (
                <li key={q.id} className="rounded-xl bg-white p-4">
                  <div className="font-semibold">{i + 1}. {q.question}</div>
                  <div className={`mt-1 text-sm ${ok ? 'text-mint' : 'text-red-600'}`}>Tu respuesta: {q.options[a] ?? '—'} {ok ? '✓' : '✗'}</div>
                  {!ok && <div className="text-sm text-ink/60">Correcta: {q.options[q.correct_index]}</div>}
                </li>
              )
            })}
          </ol>
          <button className="btn-ghost mt-4" onClick={() => setRetaking(true)}><RotateCcw size={16} /> Repetir quiz</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {questions.map((q, i) => (
            <fieldset key={q.id} className="rounded-xl bg-white p-4">
              <legend className="sr-only">Pregunta {i + 1}</legend>
              <div className="mb-2 font-semibold">{i + 1}. {q.question}</div>
              <div className="space-y-1.5">
                {q.options.map((o, j) => (
                  <label key={j} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm ${answers[q.id] === j ? 'border-accent bg-accent-soft' : 'border-ink/10 hover:bg-ink/5'}`}>
                    <input type="radio" name={q.id} className="accent-accent" checked={answers[q.id] === j} onChange={() => setAnswers({ ...answers, [q.id]: j })} /> {o}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <ErrorBox error={error} />
          <div className="flex gap-2">
            <button className="btn-primary" disabled={busy}>Enviar respuestas</button>
            {retaking && <button type="button" className="btn-ghost" onClick={() => setRetaking(false)}>Cancelar</button>}
          </div>
        </form>
      )}
    </section>
  )
}

function HomeworkBlock({ hw, subs, uid, onDone, readOnly }: { hw: Homework; subs: HomeworkSubmission[]; uid: string; onDone: () => void; readOnly: boolean }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [links, setLinks] = useState<Record<string, string>>({})

  useEffect(() => {
    subs.filter((s) => s.file_path).forEach((s) => homeworkSignedUrl(s.file_path!).then((u) => setLinks((l) => ({ ...l, [s.id]: u }))).catch(() => {}))
  }, [subs])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!text.trim() && !file) { setError('Escribe una respuesta o adjunta un archivo.'); return }
    if (readOnly) { alert('Vista previa: los docentes no pueden entregar tareas.'); return }
    setBusy(true); setError(null)
    try {
      const file_path = file ? await uploadHomeworkFile(uid, hw.id, file) : null
      const { error } = await supabase.from('homework_submissions').insert({ user_id: uid, homework_id: hw.id, text_answer: text.trim() || null, file_path, file_name: file?.name ?? null })
      if (error) throw error
      setText(''); setFile(null); onDone()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }

  return (
    <section className="mt-12 rounded-2xl border-2 border-accent/40 bg-accent-soft/50 p-6">
      <h2 className="mb-1 text-xl font-extrabold">{hw.title}</h2>
      {hw.instructions && <p className="mb-4 whitespace-pre-wrap text-ink/70">{hw.instructions}</p>}
      {subs.length > 0 && (
        <div className="mb-5 space-y-2">
          <div className="text-xs font-semibold uppercase tracking-wide text-ink/50">Tus entregas</div>
          {subs.map((s) => (
            <div key={s.id} className="rounded-xl bg-white p-4 text-sm">
              <div className="mb-1 flex items-center gap-2 font-semibold text-mint"><CheckCircle2 size={16} /> Entregada el {fmtDate(s.submitted_at)}</div>
              {s.text_answer && <p className="whitespace-pre-wrap text-ink/80">{s.text_answer}</p>}
              {s.file_path && <a href={links[s.id]} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 font-semibold underline"><FileUp size={14} /> {s.file_name}</a>}
            </div>
          ))}
        </div>
      )}
      <form onSubmit={submit} className="space-y-3 rounded-xl bg-white p-4">
        <div className="font-semibold">{subs.length ? 'Entregar de nuevo' : 'Entrega tu trabajo'}</div>
        {hw.allow_text && <textarea className="input" rows={5} placeholder="Tu respuesta…" value={text} onChange={(e) => setText(e.target.value)} />}
        {hw.allow_file && <input type="file" className="input" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />}
        <ErrorBox error={error} />
        <button className="btn-accent" disabled={busy}><FileUp size={16} /> {busy ? 'Subiendo…' : 'Entregar tarea'}</button>
      </form>
    </section>
  )
}
