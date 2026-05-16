import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/NurUI'
import { getNotifications, markNotificationsRead, deleteNotification } from '../api/notifications'

const TYPE_ICONS = {
  request_approved:    '✓',
  request_rejected:    '✗',
  student_approved:    '★',
  lesson_published:    '📖',
  attendance_recorded: '📋',
}

const TYPE_COLOR = {
  request_approved:    'var(--emerald)',
  request_rejected:    'var(--rose)',
  student_approved:    'var(--teal)',
  lesson_published:    'var(--primary)',
  attendance_recorded: 'var(--amber)',
}

function timeAgo(isoString) {
  const diff = Math.floor((Date.now() - new Date(isoString)) / 1000)
  if (diff < 60)    return 'just now'
  if (diff < 3600)  return `${Math.floor(diff / 60)} minutes ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)} hours ago`
  return `${Math.floor(diff / 86400)} days ago`
}

export default function NotificationsPage() {
  const { t } = useTranslation()
  const [notifications, setNotifications] = useState([])
  const [unreadCount, setUnreadCount]     = useState(0)
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState('')
  const [filter, setFilter]               = useState('all')

  useEffect(() => {
    getNotifications()
      .then(res => {
        setNotifications(res.data.notifications)
        setUnreadCount(res.data.unread_count)
      })
      .catch(() => setError('Failed to load notifications.'))
      .finally(() => setLoading(false))
  }, [])

  function handleMarkAllRead() {
    markNotificationsRead([]).then(() => {
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })))
      setUnreadCount(0)
    }).catch(() => {})
  }

  function handleMarkRead(id) {
    markNotificationsRead([id]).then(() => {
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n))
      setUnreadCount(c => Math.max(0, c - 1))
    }).catch(() => {})
  }

  function handleDelete(id) {
    deleteNotification(id).then(() => {
      setNotifications(prev => {
        const removed = prev.find(n => n.id === id)
        if (removed && !removed.is_read) setUnreadCount(c => Math.max(0, c - 1))
        return prev.filter(n => n.id !== id)
      })
    }).catch(() => {})
  }

  const visible = filter === 'unread'
    ? notifications.filter(n => !n.is_read)
    : notifications

  return (
    <div style={{ maxWidth: 700, margin: '0 auto' }}>
      <PageHeader
        title={t('notifications.title')}
        subtitle={t('notifications.subtitle')}
        actions={
          unreadCount > 0
            ? <button className="btn btn-outline btn-sm" onClick={handleMarkAllRead}>{t('notifications.markAllRead')}</button>
            : null
        }
      />

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'unread'].map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
              border: '1px solid',
              borderColor: filter === f ? 'var(--primary)' : 'var(--gray-200)',
              background: filter === f ? 'var(--primary)' : 'transparent',
              color: filter === f ? '#fff' : 'var(--ink-soft)',
              cursor: 'pointer',
            }}
          >
            {f === 'all' ? `${t('notifications.filterAll')} (${notifications.length})` : `${t('notifications.filterUnread')} (${unreadCount})`}
          </button>
        ))}
      </div>

      {loading && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loading && !error && visible.length === 0 && (
        <div style={{
          textAlign: 'center', padding: '60px 0', color: 'var(--ink-soft)',
        }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🔔</div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            {filter === 'unread' ? t('notifications.noNotifications') : t('notifications.noNotifications')}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {visible.map(n => (
          <div
            key={n.id}
            className="card"
            style={{
              padding: '14px 16px',
              borderLeft: `3px solid ${TYPE_COLOR[n.type] || 'var(--primary)'}`,
              opacity: n.is_read ? 0.75 : 1,
              display: 'flex', gap: 12, alignItems: 'flex-start',
            }}
          >
            <div style={{
              width: 34, height: 34, borderRadius: 8, flexShrink: 0,
              background: `${TYPE_COLOR[n.type] || 'var(--primary)'}20`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16,
            }}>
              {TYPE_ICONS[n.type] || '🔔'}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                <span style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                  {n.title}
                </span>
                {!n.is_read && (
                  <span style={{
                    width: 7, height: 7, borderRadius: '50%',
                    background: 'var(--primary)', display: 'inline-block',
                  }} />
                )}
              </div>
              {n.message && (
                <div style={{ fontSize: 13, color: 'var(--ink-soft)', marginBottom: 4 }}>
                  {n.message}
                </div>
              )}
              <div style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                {timeAgo(n.created_at)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
              {!n.is_read && (
                <button
                  onClick={() => handleMarkRead(n.id)}
                  className="btn btn-outline btn-sm"
                  style={{ fontSize: 11, padding: '3px 10px' }}
                >
                  Mark read
                </button>
              )}
              <button
                onClick={() => handleDelete(n.id)}
                style={{
                  background: 'none', border: 'none', color: 'var(--gray-400)',
                  cursor: 'pointer', padding: '3px 6px', borderRadius: 4,
                  fontSize: 16, lineHeight: 1,
                }}
                title="Dismiss"
              >
                ×
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
