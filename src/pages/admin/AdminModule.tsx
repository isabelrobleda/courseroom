import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowUp, ArrowDown, FileText, Image as ImageIcon, Video, Type, Trash2, Plus, Save, Check } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ContentItem, ContentType, Homework, Module, Quiz, QuizQuestion } from '../../lib/types'
import { uploadContentFile, videoEmbedUrl } from '../../lib/storage'
import { ErrorBox, Modal, PageTitle, QuickForm } from '../../components/ui'
import ContentViewer from '../../components/ContentViewer'

const typeIcon: Record<ContentType, typeof FileText> = { text: Type, image: ImageIcon, pdf: FileText, video: Video }

export default function AdminModule() {
  const { moduleId } = useParams()
  const [mod, setMod] = useState<(Module & { courses: { title: string } }) | null>(null)
  const [items, setItems] = useState<ContentItem[]>([])
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [questions, setQuestions] = useState<QuizQuestion[]>([])
  const [hw, setHw] = useState<Homework | null>(null)
  const [tab, setTab] = useState<'content' | 'quiz' | 'homework'>('content')
  const [editing, setEditing] = useState(false)

  const load = async () => {
    const [{ data: m }, { data: it }, { data: q }, { data: h }] = await Promise.all([
      supabase.from('modules').select('*, courses(title)').eq('id', moduleId).single(),
      supabase.from('content_items').select('*').eq('module_id', moduleId).order('position'),
      supabase.from('quizzes').select('*').eq('module_id', moduleId).maybeSingle(),
      supabase.from('homework').select('*').eq('module_id', moduleId).maybeSingle(),
    ])
    setMod(m as never); setItems((it ?? []) as ContentItem[]); setQuiz(q as Quiz | null); setHw(h as Homework | null)
    if (q) {
      const { data: qs } = await supabase.from('quiz_questions').select('*').eq('quiz_id', q.id).order('position')
      setQuestions((qs ?? []) as QuizQuestion[])
    } else setQuestions([])
  }
  useEffect(() => { load() }, [moduleId])

  if (!mod) return null
  const tabBtn = (t: typeof tab, label: string) => (
    <button onClick={() => setTab(t)} className={`rounded-lg px-4 py-2 text-sm font-semibold ${tab === t ? 'bg-ink text-white' : 'bg-white hover:bg-ink/5'}`}>{label}</button>
  )

  return (
    <>
      <div className="mb-2 text-sm text-ink/50">
        <Link to="/admin" className="hover:underline">Courses</Link> / <Link to={`/admin/course/${mod.course_id}`} className="hover:underline">{mod.courses?.title}</Link> / {mod.title}
      </div>
      <PageTitle title={mod.title} subtitle={mod.description}
        actions={<><button className="btn-ghost" onClick={() => setEditing(true)}>Edit title</button><Link className="btn-ghost" to={`/module/${mod.id}`}>Preview as student</Link></>} />
      <div className="mb-6 flex gap-2">{tabBtn('content', `Content (${items.length})`)}{tabBtn('quiz', quiz ? `Quiz (${questions.length})` : 'Quiz')}{tabBtn('homework', hw ? 'Homework ✓' : 'Homework')}</div>

      {tab === 'content' && <ContentTab moduleId={mod.id} items={items} reload={load} />}
      {tab === 'quiz' && <QuizTab moduleId={mod.id} quiz={quiz} questions={questions} reload={load} />}
      {tab === 'homework' && <HomeworkTab moduleId={mod.id} hw={hw} reload={load} />}

      {editing && (
        <Modal title="Edit module" onClose={() => setEditing(false)}>
          <QuickForm submitLabel="Save" initial={{ title: mod.title, description: mod.description ?? '' }} onSubmit={async (v) => {
            const { error } = await supabase.from('modules').update({ title: v.title, description: v.description || null }).eq('id', mod.id)
            if (error) throw error
            setEditing(false); load()
          }} />
        </Modal>
      )}
    </>
  )
}

/* ---------------- Content ---------------- */
function ContentTab({ moduleId, items, reload }: { moduleId: string; items: ContentItem[]; reload: () => void }) {
  const [type, setType] = useState<ContentType>('text')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const add = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true); setError(null)
    try {
      let file_path: string | null = null
      if (type === 'image' || type === 'pdf') {
        if (!file) throw new Error('Choose a file to upload.')
        file_path = await uploadContentFile(moduleId, file)
      }
      if (type === 'video' && !videoEmbedUrl(body)) throw new Error('Paste a YouTube, Vimeo, Loom or Google Drive video link.')
      const { error } = await supabase.from('content_items').insert({
        module_id: moduleId, type, title: title.trim() || (file?.name ?? type), body: type === 'image' || type === 'pdf' ? null : body, file_path, position: items.length,
      })
      if (error) throw error
      setTitle(''); setBody(''); setFile(null); reload()
    } catch (err) { setError((err as Error).message) } finally { setBusy(false) }
  }
  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir; if (j < 0 || j >= items.length) return
    await Promise.all([
      supabase.from('content_items').update({ position: j }).eq('id', items[i].id),
      supabase.from('content_items').update({ position: i }).eq('id', items[j].id),
    ]); reload()
  }
  const remove = async (it: ContentItem) => {
    if (!confirm(`Remove "${it.title}"?`)) return
    if (it.file_path) await supabase.storage.from('content').remove([it.file_path])
    await supabase.from('content_items').delete().eq('id', it.id); reload()
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
      <div className="space-y-3">
        {items.length === 0 && <div className="card border-dashed text-center text-ink/50">Nothing here yet. Add text, an image, a PDF or a video link from the panel.</div>}
        {items.map((it, i) => {
          const Icon = typeIcon[it.type]
          return (
            <div key={it.id} className="card">
              <div className="mb-3 flex items-center gap-2">
                <Icon size={16} className="text-ink/50" />
                <span className="flex-1 font-bold">{it.title}</span>
                <button className="btn-ghost !px-2" onClick={() => move(i, -1)} disabled={i === 0}><ArrowUp size={14} /></button>
                <button className="btn-ghost !px-2" onClick={() => move(i, 1)} disabled={i === items.length - 1}><ArrowDown size={14} /></button>
                <button className="btn-danger !px-2" onClick={() => remove(it)}><Trash2 size={14} /></button>
              </div>
              <ContentViewer item={it} compact />
            </div>
          )
        })}
      </div>
      <form onSubmit={add} className="card h-fit space-y-3 lg:sticky lg:top-20">
        <h3 className="font-bold">Add content</h3>
        <div className="grid grid-cols-4 gap-1 rounded-lg bg-ink/5 p-1">
          {(['text', 'image', 'pdf', 'video'] as ContentType[]).map((t) => {
            const Icon = typeIcon[t]
            return <button type="button" key={t} onClick={() => setType(t)} className={`flex flex-col items-center gap-1 rounded-md py-2 text-xs font-semibold capitalize ${type === t ? 'bg-white shadow-sm' : 'text-ink/50'}`}><Icon size={16} />{t}</button>
          })}
        </div>
        <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder={type === 'video' ? 'e.g. Intro lecture' : 'Optional'} /></div>
        {type === 'text' && <div><label className="label">Text</label><textarea className="input" rows={8} value={body} onChange={(e) => setBody(e.target.value)} required placeholder="Write the lesson text. Blank lines make paragraphs; lines starting with # become headings." /></div>}
        {type === 'video' && <div><label className="label">Video link</label><input className="input" value={body} onChange={(e) => setBody(e.target.value)} required placeholder="https://youtu.be/…  or Vimeo / Loom" /></div>}
        {(type === 'image' || type === 'pdf') && (
          <div><label className="label">{type === 'image' ? 'Image file' : 'PDF file'}</label>
            <input type="file" className="input" accept={type === 'image' ? 'image/*' : 'application/pdf'} onChange={(e) => setFile(e.target.files?.[0] ?? null)} required /></div>
        )}
        <ErrorBox error={error} />
        <button className="btn-accent w-full justify-center" disabled={busy}><Plus size={16} /> {busy ? 'Uploading…' : 'Add to module'}</button>
      </form>
    </div>
  )
}

/* ---------------- Quiz ---------------- */
function QuizTab({ moduleId, quiz, questions, reload }: { moduleId: string; quiz: Quiz | null; questions: QuizQuestion[]; reload: () => void }) {
  const [title, setTitle] = useState(quiz?.title ?? 'Quiz')
  const [passScore, setPassScore] = useState<string>(quiz?.pass_score?.toString() ?? '')
  const [saved, setSaved] = useState(false)
  useEffect(() => { setTitle(quiz?.title ?? 'Quiz'); setPassScore(quiz?.pass_score?.toString() ?? '') }, [quiz])

  const createQuiz = async () => { await supabase.from('quizzes').insert({ module_id: moduleId, title: 'Quiz' }); reload() }
  const deleteQuiz = async () => {
    if (!quiz || !confirm('Delete the quiz and all student attempts?')) return
    await supabase.from('quizzes').delete().eq('id', quiz.id); reload()
  }
  const saveMeta = async () => {
    if (!quiz) return
    await supabase.from('quizzes').update({ title, pass_score: passScore ? Number(passScore) : null }).eq('id', quiz.id)
    setSaved(true); setTimeout(() => setSaved(false), 1500); reload()
  }
  const addQuestion = async () => {
    if (!quiz) return
    await supabase.from('quiz_questions').insert({ quiz_id: quiz.id, question: '', options: ['', ''], correct_index: 0, position: questions.length }); reload()
  }

  if (!quiz) return (
    <div className="card border-dashed text-center">
      <p className="mb-3 text-ink/60">This module has no quiz. Quizzes are multiple-choice and auto-graded; results appear in Reports.</p>
      <button className="btn-accent" onClick={createQuiz}><Plus size={16} /> Add a quiz</button>
    </div>
  )
  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-end gap-3">
        <div className="flex-1 min-w-48"><label className="label">Quiz title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="w-40"><label className="label">Pass score (optional)</label><input className="input" type="number" min={0} value={passScore} onChange={(e) => setPassScore(e.target.value)} placeholder={`of ${questions.length}`} /></div>
        <button className="btn-primary" onClick={saveMeta}>{saved ? <Check size={16} /> : <Save size={16} />} Save</button>
        <button className="btn-danger" onClick={deleteQuiz}><Trash2 size={16} /> Delete quiz</button>
      </div>
      {questions.map((q, i) => <QuestionEditor key={q.id} q={q} index={i} reload={reload} />)}
      <button className="btn-ghost w-full justify-center" onClick={addQuestion}><Plus size={16} /> Add question</button>
    </div>
  )
}

function QuestionEditor({ q, index, reload }: { q: QuizQuestion; index: number; reload: () => void }) {
  const [question, setQuestion] = useState(q.question)
  const [options, setOptions] = useState<string[]>(q.options.length ? q.options : ['', ''])
  const [correct, setCorrect] = useState(q.correct_index)
  const [dirty, setDirty] = useState(false)
  const [busy, setBusy] = useState(false)

  const mark = () => setDirty(true)
  const save = async () => {
    setBusy(true)
    const opts = options.map((o) => o.trim()).filter(Boolean)
    await supabase.from('quiz_questions').update({ question: question.trim(), options: opts, correct_index: Math.min(correct, Math.max(opts.length - 1, 0)) }).eq('id', q.id)
    setBusy(false); setDirty(false); reload()
  }
  const remove = async () => { if (confirm('Delete this question?')) { await supabase.from('quiz_questions').delete().eq('id', q.id); reload() } }

  return (
    <div className="card space-y-3">
      <div className="flex items-center gap-2">
        <span className="badge bg-ink/5">Q{index + 1}</span>
        <input className="input flex-1 font-semibold" placeholder="Question text" value={question} onChange={(e) => { setQuestion(e.target.value); mark() }} />
        <button className="btn-danger !px-2" onClick={remove}><Trash2 size={14} /></button>
      </div>
      <div className="space-y-2 pl-2">
        {options.map((o, i) => (
          <div key={i} className="flex items-center gap-2">
            <input type="radio" name={`c-${q.id}`} checked={correct === i} onChange={() => { setCorrect(i); mark() }} title="Correct answer" className="accent-mint h-4 w-4" />
            <input className="input" placeholder={`Option ${i + 1}`} value={o} onChange={(e) => { const n = [...options]; n[i] = e.target.value; setOptions(n); mark() }} />
            <button type="button" className="btn-ghost !px-2" disabled={options.length <= 2} onClick={() => { setOptions(options.filter((_, j) => j !== i)); if (correct >= i && correct > 0) setCorrect(correct - 1); mark() }}><Trash2 size={13} /></button>
          </div>
        ))}
        <div className="flex items-center justify-between">
          <button type="button" className="text-sm font-semibold text-ink/60 hover:text-ink" onClick={() => { setOptions([...options, '']); mark() }}>+ option</button>
          <span className="text-xs text-ink/40">Select the radio next to the correct answer</span>
        </div>
      </div>
      {dirty && <div className="flex justify-end"><button className="btn-primary" onClick={save} disabled={busy}><Save size={14} /> Save question</button></div>}
    </div>
  )
}

/* ---------------- Homework ---------------- */
function HomeworkTab({ moduleId, hw, reload }: { moduleId: string; hw: Homework | null; reload: () => void }) {
  const [title, setTitle] = useState(hw?.title ?? 'Homework')
  const [instructions, setInstructions] = useState(hw?.instructions ?? '')
  const [allowFile, setAllowFile] = useState(hw?.allow_file ?? true)
  const [allowText, setAllowText] = useState(hw?.allow_text ?? true)
  const [saved, setSaved] = useState(false)
  useEffect(() => { setTitle(hw?.title ?? 'Homework'); setInstructions(hw?.instructions ?? ''); setAllowFile(hw?.allow_file ?? true); setAllowText(hw?.allow_text ?? true) }, [hw])

  const save = async (e: FormEvent) => {
    e.preventDefault()
    const row = { module_id: moduleId, title: title.trim() || 'Homework', instructions: instructions.trim() || null, allow_file: allowFile, allow_text: allowText }
    if (hw) await supabase.from('homework').update(row).eq('id', hw.id)
    else await supabase.from('homework').insert(row)
    setSaved(true); setTimeout(() => setSaved(false), 1500); reload()
  }
  const remove = async () => {
    if (!hw || !confirm('Delete homework and all student submissions?')) return
    await supabase.from('homework').delete().eq('id', hw.id); reload()
  }

  return (
    <form onSubmit={save} className="card max-w-2xl space-y-4">
      <div><label className="label">Title</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></div>
      <div><label className="label">Instructions</label><textarea className="input" rows={6} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="What should students hand in?" /></div>
      <div className="flex gap-6 text-sm">
        <label className="flex items-center gap-2"><input type="checkbox" checked={allowFile} onChange={(e) => setAllowFile(e.target.checked)} className="h-4 w-4 accent-ink" /> Allow file upload</label>
        <label className="flex items-center gap-2"><input type="checkbox" checked={allowText} onChange={(e) => setAllowText(e.target.checked)} className="h-4 w-4 accent-ink" /> Allow written answer</label>
      </div>
      <div className="flex justify-between">
        {hw ? <button type="button" className="btn-danger" onClick={remove}><Trash2 size={16} /> Delete homework</button> : <span />}
        <button className="btn-primary" disabled={!allowFile && !allowText}>{saved ? <Check size={16} /> : <Save size={16} />} {hw ? 'Save' : 'Create homework'}</button>
      </div>
    </form>
  )
}
