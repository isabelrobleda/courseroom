import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../lib/auth'
import type { Profile } from '../../lib/types'
import { downloadCsv, toCsv } from '../../lib/csv'
import { Empty, PageTitle, fmtDate } from '../../components/ui'

export default function AdminStudents() {
  const { profile: me } = useAuth()
  const [people, setPeople] = useState<Profile[]>([])
  const load = () => supabase.from('profiles').select('*').order('created_at').then(({ data }) => setPeople((data ?? []) as Profile[]))
  useEffect(() => { load() }, [])

  const setRole = async (p: Profile, role: Profile['role']) => {
    if (p.id === me?.id) return
    if (role === 'admin' && !confirm(`Make ${p.email} a teacher? They will see all reports and can edit courses.`)) return
    await supabase.from('profiles').update({ role }).eq('id', p.id); load()
  }
  const exportCsv = () => downloadCsv('students.csv', toCsv(people.map((p) => ({ name: p.full_name ?? '', email: p.email, role: p.role, joined: p.created_at }))))

  return (
    <>
      <PageTitle title="Students" subtitle="Everyone who has created an account." actions={<button className="btn-ghost" onClick={exportCsv}><Download size={16} /> CSV</button>} />
      {people.length === 0 && <Empty>Nobody yet.</Empty>}
      <div className="card overflow-x-auto !p-0">
        <table className="w-full text-sm">
          <thead className="bg-ink/5 text-left text-xs uppercase tracking-wide text-ink/60"><tr><th className="px-4 py-3">Name</th><th className="px-4 py-3">Email</th><th className="px-4 py-3">Joined</th><th className="px-4 py-3">Role</th></tr></thead>
          <tbody>
            {people.map((p) => (
              <tr key={p.id} className="border-t border-ink/5">
                <td className="px-4 py-2 font-semibold">{p.full_name}</td>
                <td className="px-4 py-2">{p.email}</td>
                <td className="px-4 py-2 text-ink/60">{fmtDate(p.created_at)}</td>
                <td className="px-4 py-2">
                  <select className="input !w-auto !py-1" value={p.role} disabled={p.id === me?.id} onChange={(e) => setRole(p, e.target.value as Profile['role'])}>
                    <option value="student">Student</option><option value="admin">Teacher</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}
