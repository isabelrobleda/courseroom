import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import Layout from './components/Layout'
import Login from './pages/Login'
import StudentHome from './pages/student/StudentHome'
import StudentCourse from './pages/student/StudentCourse'
import StudentModule from './pages/student/StudentModule'
import AdminCourses from './pages/admin/AdminCourses'
import AdminCourse from './pages/admin/AdminCourse'
import AdminModule from './pages/admin/AdminModule'
import AdminReports from './pages/admin/AdminReports'
import AdminHomework from './pages/admin/AdminHomework'
import AdminStudents from './pages/admin/AdminStudents'

function Splash() {
  return <div className="grid min-h-screen place-items-center text-ink/50">Cargando…</div>
}

export default function App() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash />
  if (!session) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    )
  }
  const isAdmin = profile?.role === 'admin'
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<StudentHome />} />
        <Route path="/course/:courseId" element={<StudentCourse />} />
        <Route path="/module/:moduleId" element={<StudentModule />} />
        {isAdmin && (
          <>
            <Route path="/admin" element={<AdminCourses />} />
            <Route path="/admin/course/:courseId" element={<AdminCourse />} />
            <Route path="/admin/module/:moduleId" element={<AdminModule />} />
            <Route path="/admin/reports" element={<AdminReports />} />
            <Route path="/admin/homework" element={<AdminHomework />} />
            <Route path="/admin/students" element={<AdminStudents />} />
          </>
        )}
        <Route path="*" element={<Navigate to={isAdmin ? '/admin' : '/'} replace />} />
      </Routes>
    </Layout>
  )
}
