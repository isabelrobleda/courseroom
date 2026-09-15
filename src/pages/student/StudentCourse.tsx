import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CheckCircle2, Circle, ClipboardList, FileUp } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Course, Module } from '../../lib/types'
import { PageTitle } from '../../components/ui'

interface Row extends Module { read: boolean; hasQuiz: boolean; quizScore: string | null; hasHw: boolean; hwDone: boolean }

export default function StudentCourse() {
  const { courseId } = useParams()
  const { session } = useAuth()
  const [course, setCourse] = useState<Course | null>(null)
  const [rows, setRows] = useState<Row[]>([])

  useEffect(() => {
    (async () => {
      const uid = session!.user.id
      const { data: c } = await supabase.from('courses').select('*').eq('id', courseId).single()
      setCourse(c as Course)
      const { data: mods } = await supabase.from('modules').select('*').eq('course_id', courseId).eq('published', true).order('position')
      const ids = (mods ?? []).map((m) => m.id)
      const [{ data: views }, { data: quizzes }, { data: hws }] = await Promise.all([
        supabase.from('module_views').select('module_id').eq('user_id', uid).in('module_id', ids),
        supabase.from('quizzes').select('id, module_id').in('module_id', ids),
        supabase.from('homework').select('id, module_id').in('module_id', ids),
      ])
      const [{ data: attempts }, { data: subs }] = await Promise.all([
        supabase.from('quiz_attempts').select('quiz_id, score, total').eq('user_id', uid),
        supabase.from('homework_submissions').select('homework_id').eq('user_id', uid),
      ])
      const seen = new Set((views ?? []).map((v) => v.module_id))
      const doneHw = new Set((subs ?? []).map((s) => s.homework_id))
      setRows(((mods ?? []) as Module[]).map((m) => {
        const q = (quizzes ?? []).find((x) => x.module_id === m.id)
        const h = (hws ?? []).find((x) => x.module_id === m.id)
        const best = q ? (attempts ?? []).filter((a) => a.quiz_id === q.id).sort((a, b) => b.score - a.score)[0] : null
        return { ...m, read: seen.has(m.id), hasQuiz: !!q, quizScore: best ? `${best.score}/${best.total}` : null, hasHw: !!h, hwDone: h ? doneHw.has(h.id) : false }
      }))
    })()
  }, [courseId, session])

  if (!course) return null
  return (
    <>
      <div className="mb-2 text-sm text-ink/50"><Link to="/" className="hover:underline">My courses</Link> / {course.title}</div>
      <PageTitle title={course.title} subtitle={course.description} />
      <ol className="space-y-2">
        {rows.map((m, i) => (
          <li key={m.id}>
            <Link to={`/module/${m.id}`} className="card flex items-center gap-4 !py-4 transition hover:shadow-md">
              {m.read ? <CheckCircle2 className="shrink-0 text-mint" /> : <Circle className="shrink-0 text-ink/20" />}
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold uppercase tracking-wide text-ink/40">Module {i + 1}</div>
                <div className="font-bold">{m.title}</div>
                {m.description && <div className="truncate text-sm text-ink/60">{m.description}</div>}
              </div>
              <div className="flex shrink-0 gap-2 text-xs font-semibold">
                {m.hasQuiz && <span className={`badge gap-1 ${m.quizScore ? 'bg-mint-soft text-mint' : 'bg-ink/5 text-ink/50'}`}><ClipboardList size={12} /> {m.quizScore ?? 'Quiz'}</span>}
                {m.hasHw && <span className={`badge gap-1 ${m.hwDone ? 'bg-mint-soft text-mint' : 'bg-accent-soft text-accent'}`}><FileUp size={12} /> {m.hwDone ? 'Handed in' : 'Homework'}</span>}
              </div>
            </Link>
          </li>
        ))}
      </ol>
    </>
  )
}
