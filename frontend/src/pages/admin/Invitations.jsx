import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Icon, PageHeader } from '../../components/NurUI'

function defaultExpiry() {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d.toISOString().slice(0, 16)
}

function groupByModel(perms) {
  return perms.reduce((acc, p) => {
    if (!acc[p.model_name]) acc[p.model_name] = []
    acc[p.model_name].push(p)
    return acc
  }, {})
}

export default function Invitations() {
  const { t } = useTranslation()
  const { user } = useAuth()

  const [invitations,  setInvitations]  = useState([])
  const [listLoading,  setListLoading]  = useState(true)
  const [centers,       setCenters]       = useState([])

  const [form, setForm] = useState({ role: 'teacher', email: '', expires_at: defaultExpiry(), center_id: '' })
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [newInvite,  setNewInvite]  = useState(null)
  const [copied,     setCopied]     = useState(false)

  const [allPerms,      setAllPerms]      = useState([])
  const [permsLoading,  setPermsLoading]  = useState(false)
  const [selectedPerms, setSelectedPerms] = useState(new Set())

  useEffect(() => {
    client.get('/centers/').then(res => {
      setCenters(res.data)
      if (!user?.is_staff && res.data.length > 0) {
        setForm(f => ({ ...f, center_id: String(res.data[0].id) }))
      }
    })
  }, [user])

  const fetchInvitations = useCallback(async () => {
    try {
      const { data } = await client.get('/invitations/')
      setInvitations(data)
    } finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => { fetchInvitations() }, [fetchInvitations])

  useEffect(() => {
    if (form.role === 'center_admin' && allPerms.length === 0) {
      setPermsLoading(true)
      client.get('/permissions/')
        .then(res => setAllPerms(res.data))
        .finally(() => setPermsLoading(false))
    }
    if (form.role !== 'center_admin') setSelectedPerms(new Set())
  }, [form.role])   // eslint-disable-line

  const togglePerm = id => {
    setSelectedPerms(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setErrors({})
    setNewInvite(null)
    setSubmitting(true)
    try {
      const payload = {
        role:       form.role,
        expires_at: new Date(form.expires_at).toISOString(),
        center:     form.center_id,
        ...(form.email ? { email: form.email } : {}),
        ...(form.role === 'center_admin' && selectedPerms.size > 0
          ? { permission_ids: [...selectedPerms] }
          : {}),
      }
      const { data } = await client.post('/invitations/', payload)
      setNewInvite(data)
      setForm(f => ({ role: 'teacher', email: '', expires_at: defaultExpiry(), center_id: user?.is_staff ? '' : f.center_id }))
      setSelectedPerms(new Set())
      fetchInvitations()
    } catch (err) {
      setErrors(err.response?.data || {})
    } finally {
      setSubmitting(false)
    }
  }

  const registrationLink = token => `${window.location.origin}/register?token=${token}`

  const handleCopy = link => {
    navigator.clipboard.writeText(link)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDelete = async id => {
    if (!window.confirm('Delete this invitation? This cannot be undone.')) return
    await client.delete(`/invitations/${id}/`)
    setInvitations(prev => prev.filter(inv => inv.id !== id))
  }

  const grouped = groupByModel(allPerms)
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Access Control') return -1
    if (b === 'Access Control') return 1
    return a.localeCompare(b)
  })

  return (
    <Layout>
      <PageHeader
        title={t('admin.invitations.title')}
        subtitle={t('admin.invitations.subtitle')}
      />

      <div className="grid-2">

        {/* ── Create form ── */}
        <div className="card">
          <div className="card-header">
            {t('admin.invitations.createInvitation')}
          </div>
          <div className="card-body">

            {newInvite && (
              <div className="alert alert-success" style={{ marginBottom: 20 }}>
                <div style={{ width: '100%' }}>
                  <strong>Invitation created!</strong>
                  <div style={{ fontSize: 12, color: 'var(--ink-soft)', marginTop: 10, marginBottom: 2 }}>Invitation link:</div>
                  <div className="token-box">{newInvite.invite_link}</div>
                  {newInvite.permission_count > 0 && (
                    <p style={{ marginTop: 6, fontSize: 13 }}>
                      ✅ <strong>{newInvite.permission_count}</strong> permissions will be auto-assigned.
                    </p>
                  )}
                  <button className="btn btn-outline btn-sm" style={{ marginTop: 8 }}
                    onClick={() => handleCopy(newInvite.invite_link)}>
                    {copied ? t('admin.invitations.copied') : t('admin.invitations.copyLink')}
                  </button>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('admin.invitations.role')} *</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  <option value="teacher">Teacher</option>
                  <option value="parent">Parent</option>
                  <option value="center_admin">Center Admin</option>
                </select>
                {errors.role && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.role}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Center *</label>
                {user?.is_staff ? (
                  <select
                    className="form-control"
                    value={form.center_id}
                    onChange={e => setForm(f => ({ ...f, center_id: e.target.value }))}
                    required
                  >
                    <option value="">Select a center…</option>
                    {centers.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="form-control"
                    value={centers.find(c => String(c.id) === String(form.center_id))?.name || '—'}
                    disabled
                  />
                )}
                {errors.center && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.center}</p>}
              </div>

              {form.role === 'center_admin' && (
                <div className="form-group">
                  <label className="form-label">
                    Pre-assign Permissions
                    <span className="text-muted" style={{ marginLeft: 6, fontWeight: 400, fontSize: 12 }}>
                      (auto-applied on approval)
                    </span>
                  </label>

                  {permsLoading ? (
                    <div style={{ padding: '12px 0' }}>
                      <span className="spinner spinner-dark" />
                    </div>
                  ) : (
                    <div style={{
                      border: '1.5px solid var(--line)',
                      borderRadius: 'var(--radius)',
                      padding: '12px 16px',
                      background: 'var(--surface-2)',
                      maxHeight: 300,
                      overflowY: 'auto',
                    }}>
                      <div className="flex gap-8" style={{ marginBottom: 10 }}>
                        <button type="button" className="btn btn-outline btn-sm"
                          onClick={() => setSelectedPerms(new Set(allPerms.map(p => p.id)))}>
                          Select All
                        </button>
                        <button type="button" className="btn btn-outline btn-sm"
                          onClick={() => setSelectedPerms(new Set())}>
                          Clear
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--ink-soft)', alignSelf: 'center' }}>
                          {selectedPerms.size} selected
                        </span>
                      </div>

                      {groupedEntries.map(([model, perms]) => (
                        <div key={model} style={{ marginBottom: 14 }}>
                          <div style={{
                            fontSize: 11, fontWeight: 700, textTransform: 'uppercase',
                            letterSpacing: '.06em', color: 'var(--ink-soft)',
                            marginBottom: 6, paddingBottom: 4,
                            borderBottom: '1px solid var(--line)',
                          }}>
                            {model}
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px 10px' }}>
                            {perms.map(p => (
                              <label key={p.id} style={{
                                display: 'flex', alignItems: 'center', gap: 7,
                                cursor: 'pointer', fontSize: 12,
                                color: selectedPerms.has(p.id) ? 'var(--primary)' : 'var(--ink-2)',
                              }}>
                                <input
                                  type="checkbox"
                                  checked={selectedPerms.has(p.id)}
                                  onChange={() => togglePerm(p.id)}
                                  style={{ width: 13, height: 13, accentColor: 'var(--primary)' }}
                                />
                                {p.codename.replace(/_/g, ' ')}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}

                      {allPerms.length === 0 && (
                        <p className="text-muted text-sm">No permissions available.</p>
                      )}
                    </div>
                  )}

                  {errors.permission_ids && (
                    <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.permission_ids}</p>
                  )}
                </div>
              )}

              <div className="form-group">
                <label className="form-label">
                  Restrict to Email <span className="text-muted">(optional)</span>
                </label>
                <input
                  type="email"
                  className="form-control"
                  placeholder="john@example.com"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                />
                <p className="form-hint">Leave blank to allow any email address.</p>
                {errors.email && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.invitations.expiresAt')} *</label>
                <input
                  type="datetime-local"
                  className="form-control"
                  value={form.expires_at}
                  onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                  required
                />
                {errors.expires_at && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.expires_at}</p>}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                {submitting && <span className="spinner" />}
                {submitting ? t('common.loading') : t('admin.invitations.createInvitation')}
              </button>
            </form>
          </div>
        </div>

        {/* ── Invitations list ── */}
        <div className="card">
          <div className="card-header">
            All Invitations
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {invitations.length}
            </span>
          </div>

          {listLoading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner spinner-dark" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">
                <Icon name="mail" size={36} color="var(--ink-soft)" />
              </div>
              <p className="empty-state-text">No invitations yet</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('admin.invitations.role')}</th>
                    <th>{t('admin.grades.center')}</th>
                    <th>{t('admin.invitations.email')}</th>
                    <th>{t('admin.invitations.expiresAt')}</th>
                    <th>{t('admin.centers.status')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {invitations.map(inv => (
                    <tr key={inv.id}>
                      <td>
                        <span className={`badge badge-${inv.role}`}>
                          {inv.role.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="text-sm">
                        {inv.center_name || <span className="text-muted">—</span>}
                      </td>
                      <td className="text-sm">
                        {inv.email || <span className="text-muted">Any</span>}
                      </td>
                      <td className="text-sm">
                        {new Date(inv.expires_at).toLocaleDateString()}
                      </td>
                      <td>
                        <span className={`badge ${inv.is_used ? 'badge-used' : 'badge-active'}`}>
                          {inv.is_used ? 'Used' : 'Active'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'inline-flex', gap: 6 }}>
                          {!inv.is_used && (
                            <button
                              className="btn btn-outline btn-sm"
                              onClick={() => handleCopy(registrationLink(inv.token))}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                            >
                              <Icon name="copy" size={13} color="currentColor" />
                              {t('admin.invitations.copyLink')}
                            </button>
                          )}
                          <button
                            className="btn btn-outline btn-sm"
                            onClick={() => handleDelete(inv.id)}
                            disabled={inv.is_used}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5, color: 'var(--rose)', opacity: inv.is_used ? 0.4 : 1, cursor: inv.is_used ? 'not-allowed' : 'pointer' }}
                          >
                            <Icon name="trash" size={13} color="currentColor" />
                            {t('common.delete')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </Layout>
  )
}
