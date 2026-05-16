import { useEffect, useRef, useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import { useTranslation } from 'react-i18next'
import { Icon } from './NurUI'
import { getNotifications, markNotificationsRead, deleteNotification } from '../api/notifications'

function roleLabelFor(user, t) {
  if (user?.is_staff)                return t('nav.roleLabelAdmin')
  if (user?.role === 'center_admin') return t('nav.roleLabelCenterAdmin')
  if (user?.role === 'parent')       return t('nav.roleLabelParent')
  if (user?.role === 'teacher')      return t('nav.roleLabelTeacher')
  return user?.role ?? ''
}

function initials(name = '') {
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() || '?'
}

function timeAgo(isoString, t) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)    return t('common.justNow')
  if (diff < 3600)  return t('common.minutesAgo', { n: Math.floor(diff / 60) })
  if (diff < 86400) return t('common.hoursAgo',   { n: Math.floor(diff / 3600) })
  return t('common.daysAgo', { n: Math.floor(diff / 86400) })
}

function SideLink({ to, icon, label }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}
    >
      <Icon name={icon} size={16} color="currentColor" />
      {label}
    </NavLink>
  )
}

function LanguageToggleBtn() {
  const { toggleLanguage } = useLanguage()
  const { t } = useTranslation()
  return (
    <button
      onClick={toggleLanguage}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 10,
        padding: '9px 12px', borderRadius: 9, border: 'none', cursor: 'pointer',
        background: 'transparent', color: 'rgba(255,255,255,.5)',
        fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit',
        marginBottom: 4, transition: 'background .15s, color .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,.08)'; e.currentTarget.style.color = '#fff' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,.5)' }}
    >
      🌐 {t('common.langToggle')}
    </button>
  )
}

function NotificationBell() {
  const { t } = useTranslation()
  const [open, setOpen]               = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount] = useState(0)
  const panelRef = useRef(null)

  function load() {
    getNotifications()
      .then(res => {
        setNotifications(res.data.notifications)
        setUnreadCount(res.data.unread_count)
      })
      .catch(() => {})
  }

  useEffect(() => {
    load()
    const id = setInterval(load, 200000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    if (!open) return
    function handler(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  function handleMarkAllRead() {
    markNotificationsRead([]).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }).catch(() => {})
  }

  function handleDelete(id, e) {
    e.stopPropagation()
    deleteNotification(id).then(() => {
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id)
        if (removed && !removed.is_read) setUnreadCount(c => Math.max(0, c - 1))
        return prev.filter(n => n.id !== id)
      })
    }).catch(() => {})
  }

  function handleOpen(notif) {
    if (!notif.is_read) {
      markNotificationsRead([notif.id]).then(() => {
        setNotifications(prev => prev.map(n => n.id === notif.id ? { ...n, is_read: true } : n))
        setUnreadCount(c => Math.max(0, c - 1))
      }).catch(() => {})
    }
  }

  return (
    <div ref={panelRef} style={{ position: 'relative', padding: '0 12px 4px' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 8,
          background: open ? 'rgba(255,255,255,0.08)' : 'transparent',
          border: 'none', borderRadius: 8, padding: '8px 10px',
          color: 'var(--gray-300)', cursor: 'pointer', fontSize: 13, fontWeight: 500,
          position: 'relative',
        }}
      >
        <Icon name="bell" size={16} color="currentColor" />
        {t('common.notifications')}
        {unreadCount > 0 && (
          <span style={{
            marginLeft: 'auto', background: 'var(--rose)', color: '#fff',
            borderRadius: 10, fontSize: 11, fontWeight: 700,
            padding: '1px 6px', lineHeight: 1.5,
          }}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', left: 12, right: 12, top: '100%', zIndex: 200,
          background: 'var(--gray-900)', border: '1px solid var(--gray-700)',
          borderRadius: 10, boxShadow: 'var(--shadow-md)',
          maxHeight: 340, display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '10px 12px 8px', borderBottom: '1px solid var(--gray-700)',
          }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-200)' }}>
              {t('common.notifications')}
            </span>
            {unreadCount > 0 && (
              <button onClick={handleMarkAllRead} style={{
                background: 'none', border: 'none', color: 'var(--primary)',
                fontSize: 11, cursor: 'pointer', padding: 0,
              }}>
                {t('common.markAllRead')}
              </button>
            )}
          </div>

          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: 16, textAlign: 'center', color: 'var(--gray-500)', fontSize: 12 }}>
                {t('common.noNotifications')}
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => handleOpen(n)}
                style={{
                  padding: '9px 12px',
                  borderBottom: '1px solid var(--gray-800)',
                  background: n.is_read ? 'transparent' : 'rgba(99,102,241,0.07)',
                  cursor: 'default',
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                }}
              >
                {!n.is_read && (
                  <div style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--primary)', marginTop: 5, flexShrink: 0,
                  }} />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--gray-100)', marginBottom: 2 }}>
                    {n.title}
                  </div>
                  {n.message && (
                    <div style={{ fontSize: 11, color: 'var(--gray-400)', lineHeight: 1.4 }}>
                      {n.message}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--gray-600)', marginTop: 3 }}>
                    {timeAgo(n.created_at, t)}
                  </div>
                </div>
                <button
                  onClick={e => handleDelete(n.id, e)}
                  style={{
                    background: 'none', border: 'none', color: 'var(--gray-600)',
                    cursor: 'pointer', padding: '0 2px', fontSize: 13, lineHeight: 1,
                    flexShrink: 0,
                  }}
                  title="Dismiss"
                >
                  ×
                </button>
              </div>
            ))}
          </div>

          <NavLink
            to="/notifications"
            onClick={() => setOpen(false)}
            style={{
              display: 'block', textAlign: 'center', padding: '8px 12px',
              fontSize: 11, color: 'var(--primary)', borderTop: '1px solid var(--gray-700)',
              textDecoration: 'none',
            }}
          >
            {t('common.seeAll')}
          </NavLink>
        </div>
      )}
    </div>
  )
}

export default function Layout({ children }) {
  const { user, hasPerm, logout } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()

  const isAdminRole = user?.is_staff || user?.role === 'center_admin'

  const handleLogout = () => { logout(); navigate('/login') }

  return (
    <div className="app-layout">
      <aside className="sidebar">

        {/* Logo */}
        <div className="sidebar-logo">
          <img src="/logo.png" alt="LMS Logo" className="sidebar-logo-mark" style={{ objectFit: 'contain', background: 'transparent', borderRadius: 10 }} />
          <div>
            <div className="sidebar-logo-text">LMS</div>
            <div className="sidebar-logo-sub">Learning Management</div>
          </div>
        </div>

        {/* User */}
        <div className="sidebar-user">
          <div className="sidebar-avatar">{initials(user?.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div className="sidebar-user-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {user?.name}
            </div>
            <div className="sidebar-user-role">{roleLabelFor(user, t)}</div>
          </div>
        </div>

        {/* Notification Bell */}
        <NotificationBell />

        {/* Nav */}
        <nav className="sidebar-nav">

          {/* Admin section */}
          {isAdminRole && (
            <>
              {user?.is_staff && (
                <div className="sidebar-nav-section">{t('nav.management')}</div>
              )}
              {user?.is_staff && (
                <SideLink to="/admin/centers" icon="building" label={t('nav.centers')} />
              )}
              {user?.is_staff && (
                <SideLink to="/admin/grades" icon="academic" label={t('nav.grades')} />
              )}
              {hasPerm('can_view_invitations') && (
                <SideLink to="/admin/invitations" icon="mail" label={t('nav.invitations')} />
              )}
              {hasPerm('can_view_requests') && (
                <SideLink to="/admin/requests" icon="clipboard" label={t('nav.registrationRequests')} />
              )}
              {hasPerm('can_view_users') && (
                <SideLink to="/admin/users" icon="users" label={t('nav.users')} />
              )}
              {hasPerm('can_view_student_requests') && (
                <SideLink to="/admin/student-requests" icon="academic" label={t('nav.studentRequests')} />
              )}
            </>
          )}

          {/* Parent section */}
          {user?.role === 'parent' && (
            <>
              <div className="sidebar-nav-section">{t('nav.myAccount')}</div>
              {hasPerm('can_view_students') && (
                <SideLink to="/parent/students" icon="users" label={t('nav.myStudents')} />
              )}
              <SideLink to="/parent/performance" icon="star" label={t('nav.performance')} />
              <SideLink to="/parent/progress" icon="academic" label={t('nav.progress')} />
              {hasPerm('can_view_attendance') && (
                <SideLink to="/parent/attendance" icon="clipboard" label={t('nav.attendance')} />
              )}
            </>
          )}

          {/* Teacher section */}
          {user?.role === 'teacher' && (
            <>
              <div className="sidebar-nav-section">{t('nav.teaching')}</div>
              {hasPerm('can_manage_content') && (
                <SideLink to="/teacher" icon="dashboard" label={t('nav.dashboard')} />
              )}
              {hasPerm('can_manage_content') && (
                <SideLink to="/teacher/subject-groups" icon="book" label={t('nav.subjectGroups')} />
              )}
              {hasPerm('can_manage_attendance') && (
                <SideLink to="/teacher/attendance" icon="clipboard" label={t('nav.attendance')} />
              )}
            </>
          )}
        </nav>

        {/* Quran – available to all */}
        <div style={{ padding: '0 12px 0' }}>
          <SideLink to="/quran" icon="book" label={t('nav.quran')} />
        </div>

        {/* My Profile (all users) */}
        <div style={{ padding: '0 12px 8px' }}>
          <SideLink to="/profile" icon="user" label={t('nav.myProfile')} />
        </div>

        {/* Language toggle + Logout */}
        <div className="sidebar-logout">
          <div style={{ padding: '0 12px 4px' }}>
            <LanguageToggleBtn />
          </div>
          <button className="sidebar-logout-btn" onClick={handleLogout}>
            <Icon name="logout" size={16} color="currentColor" />
            {t('common.signOut')}
          </button>
        </div>

      </aside>

      <main className="main-content">{children}</main>
    </div>
  )
}
