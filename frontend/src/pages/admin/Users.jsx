import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { Avatar, Icon, PageHeader, StatCard, ConfirmDialog } from '../../components/NurUI'

const ROLE_BADGE = {
  admin:        { bg: '#fef3c7', color: '#92400e' },
  center_admin: { bg: 'var(--amber-l)',  color: 'var(--amber)'  },
  teacher:      { bg: 'var(--primary-light)', color: 'var(--primary)' },
  parent:       { bg: 'var(--violet-l)', color: 'var(--violet)' },
}

export default function Users() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [tab,          setTab]         = useState('active')
  const [users,        setUsers]        = useState([])
  const [deletedUsers, setDeletedUsers] = useState([])
  const [loading,      setLoading]      = useState(true)
  const [search,       setSearch]       = useState('')
  const [roleFilter,   setRoleFilter]   = useState('all')
  const [deleting,     setDeleting]     = useState(null)
  const [message,      setMessage]      = useState(null)
  const [confirmTarget, setConfirmTarget] = useState(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    try {
      const [active, deleted] = await Promise.all([
        client.get('/users/'),
        client.get('/users/deleted/'),
      ])
      setUsers(active.data)
      setDeletedUsers(deleted.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchUsers() }, [fetchUsers])

  const handleDelete = user => setConfirmTarget(user)

  const doDelete = async () => {
    const user = confirmTarget
    setConfirmTarget(null)
    setDeleting(user.id)
    setMessage(null)
    try {
      await client.delete(`/users/${user.id}/`)
      setMessage({ type: 'success', text: `User "${user.name}" deleted.` })
      fetchUsers()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Delete failed.' })
    } finally {
      setDeleting(null)
    }
  }

  const list = tab === 'active' ? users : deletedUsers

  const visible = list.filter(u => {
    const matchRole   = roleFilter === 'all' || u.role === roleFilter
    const matchSearch = !search ||
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase())
    return matchRole && matchSearch
  })

  const countFor = role => role === 'all' ? users.length : users.filter(u => u.role === role).length

  return (
    <Layout>
      <PageHeader
        title={t('admin.users.title')}
        subtitle={t('admin.users.subtitle')}
      />

      {/* Stats */}
      <div className="stats-row">
        <StatCard icon="users"   label={t('admin.users.totalUsers')}    value={countFor('all')}          tone="primary" />
        <StatCard icon="academic" label={t('admin.users.teachers')}      value={countFor('teacher')}      tone="teal"    />
        <StatCard icon="user"    label={t('admin.users.parents')}        value={countFor('parent')}       tone="violet"  />
        <StatCard icon="shield"  label={t('admin.users.centerAdmins')}  value={countFor('center_admin')} tone="amber"   />
      </div>

      {message && <div className={`alert alert-${message.type}`}>{message.text}</div>}

      <div className="card">
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 0, borderBottom: '1px solid var(--line)' }}>
          {[
            { key: 'active',  label: t('admin.users.activeUsers'),  count: users.length },
            { key: 'deleted', label: t('admin.users.deletedUsers'), count: deletedUsers.length },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => { setTab(t.key); setSearch(''); setRoleFilter('all') }}
              style={{
                padding: '12px 20px',
                fontSize: 13,
                fontWeight: 600,
                fontFamily: 'inherit',
                cursor: 'pointer',
                border: 'none',
                borderBottom: tab === t.key ? '2px solid var(--primary)' : '2px solid transparent',
                background: 'transparent',
                color: tab === t.key ? 'var(--primary)' : 'var(--ink-soft)',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                transition: 'color .15s',
              }}
            >
              {t.label}
              <span style={{
                background: tab === t.key ? 'var(--primary)' : 'var(--surface-2)',
                color: tab === t.key ? '#fff' : 'var(--ink-soft)',
                borderRadius: 99,
                fontSize: 11,
                fontWeight: 700,
                padding: '1px 7px',
              }}>
                {t.count}
              </span>
            </button>
          ))}
        </div>

        {/* Filters */}
        <div className="card-body" style={{ paddingBottom: 0, borderBottom: '1px solid var(--line)', display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: 200, maxWidth: 340 }}>
            <div style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)' }}>
              <Icon name="search" size={15} color="var(--ink-soft)" />
            </div>
            <input
              className="form-control"
              style={{ paddingLeft: 32 }}
              placeholder={t('admin.users.searchPlaceholder')}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {['all', 'teacher', 'parent', 'center_admin', 'admin'].map(r => (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                style={{
                  padding: '5px 12px', borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  border: 'none', fontFamily: 'inherit',
                  background: roleFilter === r ? 'var(--primary)' : 'var(--surface-2)',
                  color: roleFilter === r ? '#fff' : 'var(--ink-soft)',
                  transition: 'background .15s, color .15s',
                }}
              >
                {r === 'all' ? 'All' : r.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><span className="spinner spinner-dark" /></div>
        ) : visible.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="users" size={36} color="var(--ink-soft)" /></div>
            <p className="empty-state-text">{tab === 'deleted' ? 'No deleted users' : 'No users found'}</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>{t('admin.users.title')}</th>
                  <th>{t('admin.invitations.role')}</th>
                  <th>{t('admin.centers.status')}</th>
                  <th></th>
                  {tab === 'active' && <th></th>}
                </tr>
              </thead>
              <tbody>
                {visible.map(u => {
                  const rb = ROLE_BADGE[u.role] || { bg: 'var(--surface-2)', color: 'var(--ink-soft)' }
                  return (
                    <tr key={u.id} style={tab === 'deleted' ? { opacity: 0.6 } : {}}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <Avatar name={u.name} size={34} />
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 14, textDecoration: tab === 'deleted' ? 'line-through' : 'none' }}>{u.name}</div>
                            <div style={{ fontSize: 12, color: 'var(--ink-soft)' }}>{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="badge" style={{ background: rb.bg, color: rb.color }}>
                          {u.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td>
                        {tab === 'deleted'
                          ? <span className="badge badge-rejected">Deleted</span>
                          : <span className={`badge ${u.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                              {u.is_active ? 'Active' : 'Inactive'}
                            </span>
                        }
                      </td>
                      <td>
                        {u.is_staff
                          ? <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}>Admin</span>
                          : <span className="text-muted text-sm">—</span>}
                      </td>
                      {tab === 'active' && (
                        <td>
                          <div className="flex gap-8">
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => navigate(`/admin/users/${u.id}`)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              <Icon name="edit" size={13} color="currentColor" /> {t('common.edit')}
                            </button>
                            <button
                              className="btn btn-danger btn-sm"
                              disabled={deleting === u.id}
                              onClick={() => handleDelete(u)}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              {deleting === u.id
                                ? <span className="spinner" style={{ width: 12, height: 12 }} />
                                : <Icon name="trash" size={13} color="#fff" />}
                              {t('common.delete')}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <ConfirmDialog
        open={!!confirmTarget}
        title="Delete User"
        message={confirmTarget ? `Delete "${confirmTarget.name}" (${confirmTarget.email})? This cannot be undone.` : ''}
        danger
        onYes={doDelete}
        onNo={() => setConfirmTarget(null)}
        onCancel={() => setConfirmTarget(null)}
      />
    </Layout>
  )
}
