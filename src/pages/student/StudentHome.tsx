import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Course } from '../../lib/types'
import { Empty, PageTitle } from '../../components/ui'

export default function StudentHome() {
  const { profile, session } = useAuth()
  const [courses, setCourses] = useState<(Course & { total: number; done: number })[]>([])

  useEffect(() => {
    (async () => {
      const { data: cs } = await supabase.from('courses').select('*').eq('published', true).order('created_at')
      const { data: mods } = await supabase.from('modules').select('id, course_id').eq('published', true)
      const { data: views } = await supabase.from('module_views').select('module_id').eq('user_id', session!.user.id)
      const seen = new Set((views ?? []).map((v) => v.module_id))
      setCourses(((cs ?? []) as Course[]).map((c) => {
        const ms = (mods ?? []).filter((m) => m.course_id === c.id)
        return { ...c, total: ms.length, done: ms.filter((m) => seen.has(m.id)).length }
      }))
    })()
  }, [session])

  return (
    <>
      <PageTitle title={`Hi, ${profile?.full_name?.split(' ')[0] || 'there'} 👋`} subtitle="Pick a course to continue learning." />
      {courses.length === 0 && <Empty>No courses are published yet.</Empty>}
      <div className="grid gap-4 sm:grid-cols-2">
        {courses.map((c) => {
          const pct = c.total ? Math.round((c.done / c.total) * 100) : 0
          return (
            <Link key={c.id} to={`/course/${c.id}`} className="card group flex flex-col gap-3 transition hover:-translate-y-0.5 hover:shadow-md">
              <h2 className="text-xl font-bold">{c.title}</h2>
              <p className="text-sm text-ink/60">{c.description}</p>
              <div className="mt-auto">
                <div className="mb-1 flex justify-between text-xs font-semibold text-ink/60"><span>{c.done}/{c.total} modules</span><span>{pct}%</span></div>
                <div className="h-2 overflow-hidden rounded-full bg-ink/5"><div className="h-full rounded-full bg-mint transition-all" style={{ width: `${pct}%` }} /></div>
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-semibold text-accent">Continue <ChevronRight size={16} /></span>
            </Link>
          )
        })}
      </div>
    </>
  )
}
