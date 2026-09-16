import { NavLink } from 'react-router-dom'
import { BookOpen, BarChart3, Inbox, LogOut, GraduationCap, Users, UserCircle } from 'lucide-react'
import { useAuth } from '../lib/auth'
import type { ReactNode } from 'react'

const link = ({ isActive }: { isActive: boolean }) =>
  `flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${isActive ? 'bg-accent text-white' : 'text-ink/70 hover:bg-accent-soft'}`

export default function Layout({ children }: { children: ReactNode }) {
  const { profile, signOut } = useAuth()
  const isAdmin = profile?.role === 'admin'
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-10 border-b border-ink/10 bg-paper/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to={isAdmin ? '/admin' : '/'} className="mr-4 flex items-center gap-2 font-extrabold tracking-tight">
            <img src="/teammeet.png" alt="Team Meet" className="h-9 w-9" />
            <span className="hidden sm:inline"><span className="text-accent">Team</span> <span className="text-mint">Meet</span></span>
          </NavLink>
          <nav className="flex flex-1 items-center gap-1 overflow-x-auto">
            {isAdmin ? (
              <>
                <NavLink to="/admin" end className={link}><BookOpen size={16} /> Cursos</NavLink>
                <NavLink to="/admin/reports" className={link}><BarChart3 size={16} /> Reportes</NavLink>
                <NavLink to="/admin/homework" className={link}><Inbox size={16} /> Tareas</NavLink>
                <NavLink to="/admin/students" className={link}><Users size={16} /> Alumnos</NavLink>
                <NavLink to="/" end className={link}><GraduationCap size={16} /> Vista de alumno</NavLink>
              </>
            ) : (
              <NavLink to="/" end className={link}><BookOpen size={16} /> Mis cursos</NavLink>
            )}
          </nav>
          <NavLink to="/cuenta" className="flex items-center gap-2 rounded-lg px-2 py-1 text-right text-xs text-ink/60 hover:bg-ink/5" title="Mi cuenta / cambiar contraseña">
            <div className="hidden sm:block">
              <div className="font-semibold text-ink">{profile?.full_name || profile?.email}</div>
              <div>{isAdmin ? 'Docente' : 'Alumno'}</div>
            </div>
            <UserCircle size={22} className="text-ink/50" />
          </NavLink>
          <button onClick={signOut} className="btn-ghost" title="Cerrar sesión"><LogOut size={16} /></button>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  )
}
