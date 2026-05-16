import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

/**
 * Props:
 *   requirePerm   – permission codename; redirects to / if user lacks it
 *   requireRole   – exact role string match (for teacher/parent personal pages)
 *   adminOnly     – requires is_staff (super admin) OR center_admin role
 *   staffOnly     – requires is_staff (super admin) only
 */
export default function ProtectedRoute({ children, requirePerm, requireRole, adminOnly, staffOnly }) {
  const { user, loading, hasPerm } = useAuth()

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <span className="spinner spinner-dark" />
    </div>
  )

  if (!user) return <Navigate to="/login" replace />

  if (staffOnly && !user.is_staff)
    return <Navigate to="/" replace />

  if (adminOnly && !user.is_staff && user.role !== 'center_admin')
    return <Navigate to="/" replace />

  if (requirePerm && !hasPerm(requirePerm))
    return <Navigate to="/" replace />

  if (requireRole && user.role !== requireRole)
    return <Navigate to="/" replace />

  return children
}
