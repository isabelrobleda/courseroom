import { NavLink } from 'react-router-dom'
import { BookOpen, BarChart3, Inbox, LogOut, GraduationCap, Users } from 'lucide-react'
import { useAuth } from '../lib/auth'
import type { ReactNode } from 'react'

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-ink text-white' : 'text-ink/70 hover:bg-ink/5'}`

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to={isAdmin ? '/admin' : '/'} className="mr-4 flex items-center gap-2 font-extrabold tracking-tight">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-accent text-white"><GraduationCap size={18} /></span>
            Courseroom
          </NavLink>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {isAdmin ? (
              <>
                <NavLink to="/admin" end className={link}><BookOpen size={16} /> Courses</NavLink>
                <NavLink to="/admin/reports" className={link}><BarChart3 size={16} /> Reports</NavLink>
                <NavLink to="/admin/homework" className={link}><Inbox size={16} /> Homework</NavLink>
                <NavLink to="/admin/students" className={link}><Users size={16} /> Students</NavLink>
                <NavLink to="/" end className={link}><GraduationCap size={16} /> Student view</NavLink>
              </>
            ) : (
              <NavLink to="/" end className={link}><BookOpen size={16} /> My courses</NavLink>
            )}
          </nav>
          <div className="hidden text-right text-xs text-ink/60 sm:block">
            <div className="font-semibold text-ink">{profile?.full_name || profile?.email}</div>
            <div>{isAdmin ? 'Teacher' : 'Student'}</div>
          </div>
          <button onClick={signOut} className="btn-ghost" title="Sign out"><LogOut size={16} /></button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
