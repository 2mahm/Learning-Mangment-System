import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from './context/AuthContext'
import { useTranslation } from 'react-i18next'
import ProtectedRoute from './components/ProtectedRoute'
import Login from './pages/Login'
import Register from './pages/Register'
import Centers from './pages/admin/Centers'
import Grades from './pages/admin/Grades'
import Invitations from './pages/admin/Invitations'
import RegistrationRequests from './pages/admin/RegistrationRequests'
import Users from './pages/admin/Users'
import UserProfile from './pages/admin/UserProfile'
import Students from './pages/parent/Students'
import ParentPerformance from './pages/parent/Performance'
import ParentAttendancePage from './pages/parent/AttendancePage'
import ProgressPage from './pages/parent/ProgressPage'
import TeacherDashboard from './pages/teacher/TeacherDashboard'
import TeacherAttendancePage from './pages/teacher/AttendancePage'
import SubjectGroups from './pages/teacher/SubjectGroups'
import SubjectGroupDetail from './pages/teacher/SubjectGroupDetail'
import LessonEditor from './pages/teacher/LessonEditor'
import ExercisePerformance from './pages/teacher/ExercisePerformance'
import StudentContent from './pages/student/StudentContent'
import StudentLesson from './pages/student/StudentLesson'
import StudentPortalContent from './pages/student/StudentPortalContent'
import StudentPortalLesson from './pages/student/StudentPortalLesson'
import StudentRequests from './pages/admin/StudentRequests'
import StudentDashboard from './pages/student/StudentDashboard'
import ProfilePage from './pages/ProfilePage'
import NotificationsPage from './pages/NotificationsPage'
import QuranPage from './pages/QuranPage'

// Maps the permission codename to a translation key for display
const PAGE_PERMS = [
  { perm: 'can_view_invitations', pageKey: 'nav.invitations'           },
  { perm: 'can_view_requests',    pageKey: 'nav.registrationRequests'  },
  { perm: 'can_view_users',       pageKey: 'nav.users'                 },
  { perm: 'can_view_students',    pageKey: 'nav.myStudents'            },
  { perm: 'can_view_content',     pageKey: 'nav.subjectGroups'         },
]

function NoAccess() {
  const { user, logout, refreshUser } = useAuth()
  const { t } = useTranslation()
  const navigate   = useNavigate()
  const [refreshing, setRefreshing] = useState(false)
  const [refreshMsg, setRefreshMsg] = useState(null)

  const handleRefresh = async () => {
    setRefreshing(true)
    setRefreshMsg(null)
    try {
      await refreshUser()
      setRefreshMsg(t('noAccess.permRefreshed'))
      setTimeout(() => navigate('/'), 800)
    } catch {
      setRefreshMsg(t('noAccess.permRefreshFailed'))
    } finally {
      setRefreshing(false)
    }
  }

  const myPerms = user?.permissions ?? []

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center',
      justifyContent: 'center', background: 'var(--gray-50)', padding: 24,
    }}>
      <div style={{ width: '100%', maxWidth: 480 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
            {t('noAccess.title')}
          </h2>
          <p style={{ color: 'var(--gray-500)', fontSize: 13 }}>
            {t('noAccess.subtitle')}
          </p>
        </div>

        {/* Which permission unlocks which page */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">{t('noAccess.permissionMap')}</div>
          <div style={{ padding: '8px 0' }}>
            {PAGE_PERMS.map(({ perm, pageKey }) => {
              const have = myPerms.includes(perm)
              return (
                <div key={perm} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '8px 20px', borderBottom: '1px solid var(--gray-100)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--gray-800)' }}>{t(pageKey)}</div>
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', fontFamily: 'monospace' }}>{perm}</div>
                  </div>
                  <span className={`badge ${have ? 'badge-approved' : 'badge-rejected'}`}>
                    {have ? t('noAccess.granted') : t('noAccess.missing')}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* Current permissions list */}
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header flex-between">
            {t('noAccess.yourPermissions')}
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
              {t('noAccess.assigned', { n: myPerms.length })}
            </span>
          </div>
          <div style={{ padding: '12px 20px' }}>
            {myPerms.length === 0
              ? <p style={{ fontSize: 13, color: 'var(--gray-400)' }}>{t('noAccess.noPermissions')}</p>
              : myPerms.map(p => (
                  <span key={p} className="badge" style={{
                    background: 'var(--gray-100)', color: 'var(--gray-700)',
                    marginRight: 6, marginBottom: 6, fontFamily: 'monospace', fontSize: 11,
                  }}>{p}</span>
                ))
            }
          </div>
        </div>

        {refreshMsg && (
          <div className={`alert ${refreshMsg === t('noAccess.permRefreshFailed') ? 'alert-error' : 'alert-success'}`}
            style={{ marginBottom: 12 }}>
            {refreshMsg}
          </div>
        )}

        <div className="flex gap-8">
          <button className="btn btn-primary" style={{ flex: 1 }}
            onClick={handleRefresh} disabled={refreshing}>
            {refreshing && <span className="spinner" />}
            {refreshing ? t('noAccess.refreshing') : t('noAccess.refreshPermissions')}
          </button>
          <button className="btn btn-outline" style={{ flex: 1 }}
            onClick={() => { logout(); navigate('/login') }}>
            {t('common.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}

function RootRedirect() {
  const { user, loading, hasPerm } = useAuth()
  if (loading) return null
  if (!user) return <Navigate to="/login" replace />

  // Redirect to the first page the user is actually permitted to see.
  // Admin pages (invitations, requests, users) are restricted to is_staff or center_admin.
  const isAdminRole = user.is_staff || user.role === 'center_admin'
  if (isAdminRole && hasPerm('can_view_invitations'))               return <Navigate to="/admin/invitations"        replace />
  if (isAdminRole && hasPerm('can_view_requests'))                  return <Navigate to="/admin/requests"          replace />
  if (isAdminRole && hasPerm('can_view_users'))                     return <Navigate to="/admin/users"             replace />
  if (isAdminRole && hasPerm('can_view_student_requests'))          return <Navigate to="/admin/student-requests"  replace />
  if (user.role === 'parent'  && hasPerm('can_view_students'))      return <Navigate to="/parent/students"         replace />
  if (user.role === 'teacher')                                      return <Navigate to="/teacher"                 replace />
  return <Navigate to="/no-access" replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/"         element={<RootRedirect />} />
      <Route path="/login"      element={<Login />} />
<Route path="/register"   element={<Register />} />

      {/* Super admin only – center management */}
      <Route path="/admin/centers" element={
        <ProtectedRoute staffOnly><Centers /></ProtectedRoute>
      } />
      <Route path="/admin/grades" element={
        <ProtectedRoute staffOnly><Grades /></ProtectedRoute>
      } />

      {/* Admin-area pages – restricted to super admin (is_staff) and center_admin only */}
      <Route path="/admin/invitations" element={
        <ProtectedRoute adminOnly requirePerm="can_view_invitations"><Invitations /></ProtectedRoute>
      } />
      <Route path="/admin/requests" element={
        <ProtectedRoute adminOnly requirePerm="can_view_requests"><RegistrationRequests /></ProtectedRoute>
      } />
      <Route path="/admin/users" element={
        <ProtectedRoute adminOnly requirePerm="can_view_users"><Users /></ProtectedRoute>
      } />
      <Route path="/admin/users/:id" element={
        <ProtectedRoute adminOnly requirePerm="can_view_users"><UserProfile /></ProtectedRoute>
      } />

      {/* Role-based personal pages */}
      <Route path="/parent/students" element={
        <ProtectedRoute requireRole="parent" requirePerm="can_view_students"><Students /></ProtectedRoute>
      } />
      <Route path="/parent/performance" element={
        <ProtectedRoute requireRole="parent"><ParentPerformance /></ProtectedRoute>
      } />
      <Route path="/parent/progress" element={
        <ProtectedRoute requireRole="parent"><ProgressPage /></ProtectedRoute>
      } />
      <Route path="/parent/attendance" element={
        <ProtectedRoute requireRole="parent" requirePerm="can_view_attendance"><ParentAttendancePage /></ProtectedRoute>
      } />

      {/* Teacher */}
      <Route path="/teacher" element={
        <ProtectedRoute requireRole="teacher"><TeacherDashboard /></ProtectedRoute>
      } />
      <Route path="/teacher/subject-groups" element={
        <ProtectedRoute requireRole="teacher"><SubjectGroups /></ProtectedRoute>
      } />
      <Route path="/teacher/subject-groups/:groupId" element={
        <ProtectedRoute requireRole="teacher"><SubjectGroupDetail /></ProtectedRoute>
      } />
      {/* Lesson editor has its own full-screen layout — no Layout wrapper inside */}
      <Route path="/teacher/lessons/:lessonId/edit" element={
        <ProtectedRoute requireRole="teacher"><LessonEditor /></ProtectedRoute>
      } />
      <Route path="/teacher/lessons/performance" element={
        <ProtectedRoute requireRole="teacher"><ExercisePerformance /></ProtectedRoute>
      } />
      <Route path="/teacher/attendance" element={
        <ProtectedRoute requireRole="teacher" requirePerm="can_manage_attendance"><TeacherAttendancePage /></ProtectedRoute>
      } />

      {/* Student lesson viewer (full-screen, shared shell) */}
      <Route path="/content/lessons/:lessonId" element={
        <ProtectedRoute requirePerm="can_view_content"><StudentLesson /></ProtectedRoute>
      } />

      {/* Admin – student requests */}
      <Route path="/admin/student-requests" element={
        <ProtectedRoute adminOnly requirePerm="can_view_student_requests"><StudentRequests /></ProtectedRoute>
      } />

      {/* Student portal – no user auth, reads from localStorage */}
      <Route path="/student"          element={<StudentDashboard />} />
      <Route path="/student/content"  element={<StudentPortalContent />} />
      <Route path="/student/lesson" element={<StudentPortalLesson />} />

      {/* Quran explorer – available to all authenticated users */}
      <Route path="/quran" element={
        <ProtectedRoute><QuranPage /></ProtectedRoute>
      } />

      {/* Notifications – available to all authenticated users */}
      <Route path="/notifications" element={
        <ProtectedRoute><NotificationsPage /></ProtectedRoute>
      } />

      {/* Profile page – available to all authenticated users */}
      <Route path="/profile" element={
        <ProtectedRoute><ProfilePage /></ProtectedRoute>
      } />

      <Route path="/no-access" element={<NoAccess />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
