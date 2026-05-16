import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { PageHeader, ConfirmDialog } from '../../components/NurUI'

const ALL_ROLES = ['teacher', 'parent', 'center_admin', 'admin']

// Mirrors ROLE_PERMISSIONS in accounts/permissions.py
const ROLE_GROUPS = [
  {
    key:   'parent',
    label: 'Parent',
    color: '#6366f1',
    bg:    '#eef2ff',
    codenames: [
      'can_login',
      'can_view_students',
      'can_add_student',
      'can_view_content',
    ],
  },
  {
    key:   'teacher',
    label: 'Teacher',
    color: '#0891b2',
    bg:    '#ecfeff',
    codenames: [
      'can_login',
      'can_manage_content',
      'can_view_content',
    ],
  },
  {
    key:   'center_admin',
    label: 'Center Admin',
    color: '#d97706',
    bg:    '#fffbeb',
    codenames: [
      'can_login',
      'can_view_invitations',
      'can_create_invitation',
      'can_view_requests',
      'can_approve_request',
      'can_reject_request',
      'can_view_users',
      'can_edit_user',
      'can_delete_user',
      'can_manage_permissions',
      'can_view_student_requests',
      'can_approve_student_request',
      'can_reject_student_request',
      'can_view_content',
    ],
  },
]

// Checkbox that supports indeterminate state via a ref
function GroupPresetRow({ group, state, count, onToggle }) {
  const ref = useRef(null)

  useEffect(() => {
    if (!ref.current) return
    ref.current.checked       = state === 'checked'
    ref.current.indeterminate = state === 'indeterminate'
  }, [state])

  return (
    <label
      style={{
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
        border: `1.5px solid ${state !== 'unchecked' ? group.color : 'var(--gray-200)'}`,
        background: state !== 'unchecked' ? group.bg : 'var(--gray-50)',
        transition: 'border-color .15s, background .15s',
        userSelect: 'none',
      }}
    >
      <input
        ref={ref}
        type="checkbox"
        onChange={onToggle}
        style={{ width: 15, height: 15, accentColor: group.color, flexShrink: 0 }}
      />
      <div style={{ flex: 1 }}>
        <span style={{
          fontSize: 13, fontWeight: 600,
          color: state !== 'unchecked' ? group.color : 'var(--gray-700)',
        }}>
          {group.label}
        </span>
      </div>
      <span style={{
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 99,
        background: state !== 'unchecked' ? group.color : 'var(--gray-200)',
        color: state !== 'unchecked' ? '#fff' : 'var(--gray-500)',
      }}>
        {count} perms
      </span>
    </label>
  )
}

export default function UserProfile() {
  const { t } = useTranslation()
  const { id }    = useParams()
  const navigate  = useNavigate()

  // ── Data ──────────────────────────────────────────────────────────────────
  const [user,        setUser]        = useState(null)
  const [allPerms,    setAllPerms]    = useState([])  // all available permissions
  const [loading,     setLoading]     = useState(true)

  // ── Teacher centers ───────────────────────────────────────────────────────
  const [allCenters,      setAllCenters]      = useState([])
  const [teacherCenterIds, setTeacherCenterIds] = useState(new Set())
  const [savingCenters,   setSavingCenters]   = useState(false)
  const [centersMsg,      setCentersMsg]      = useState(null)

  // ── Profile edit form ─────────────────────────────────────────────────────
  const [form,         setForm]        = useState({ name: '', email: '', role: '', is_active: true, is_staff: false })
  const [formErrors,   setFormErrors]  = useState({})
  const [savingForm,   setSavingForm]  = useState(false)
  const [formMsg,      setFormMsg]     = useState(null)

  // ── Permissions ───────────────────────────────────────────────────────────
  const [checkedIds,   setCheckedIds]  = useState(new Set())
  const [savingPerms,  setSavingPerms] = useState(false)
  const [permsMsg,     setPermsMsg]    = useState(null)

  // ── Confirm dialog ────────────────────────────────────────────────────────
  const [confirmAction, setConfirmAction] = useState(null)  // 'profile' | 'perms' | 'centers'

  const CONFIRM_CONFIG = {
    profile: { title: 'Save Profile',           message: "Save changes to this user's profile?" },
    perms:   { title: 'Save Permissions',        message: 'Save the updated permission set for this user?' },
    centers: { title: 'Save Center Assignments', message: 'Save the updated center assignments for this teacher?' },
  }

  // ── Load ──────────────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: u }, { data: perms }, { data: centers }] = await Promise.all([
        client.get(`/users/${id}/`),
        client.get('/permissions/'),
        client.get('/centers/'),
      ])
      setUser(u)
      setForm({
        name:      u.name,
        email:     u.email,
        role:      u.role,
        is_active: u.is_active,
        is_staff:  u.is_staff,
      })
      setCheckedIds(new Set(u.permission_ids))
      setAllPerms(perms)
      setAllCenters(centers)
      // If teacher, load their current center assignments
      if (u.role === 'teacher') {
        const { data: teacherCenters } = await client.get(`/users/${id}/centers/`)
        setTeacherCenterIds(new Set(teacherCenters.map(c => c.id)))
      }
    } catch {
      navigate('/admin/users')
    } finally {
      setLoading(false)
    }
  }, [id, navigate])

  useEffect(() => { load() }, [load])

  // ── Save profile ──────────────────────────────────────────────────────────
  const handleSaveProfile = e => { e.preventDefault(); setConfirmAction('profile') }

  const doSaveProfile = async () => {
    setFormErrors({})
    setFormMsg(null)
    setSavingForm(true)
    try {
      const { data } = await client.patch(`/users/${id}/`, form)
      setUser(data)
      setFormMsg({ type: 'success', text: 'Profile updated successfully.' })
    } catch (err) {
      if (err.response?.data?.error) {
        setFormMsg({ type: 'error', text: err.response.data.error })
      } else {
        setFormErrors(err.response?.data || {})
      }
    } finally {
      setSavingForm(false)
    }
  }

  // ── Toggle permission checkbox ─────────────────────────────────────────────
  const togglePerm = id => {
    setCheckedIds(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  // ── Role group helpers ────────────────────────────────────────────────────
  const groupIds = group =>
    allPerms.filter(p => group.codenames.includes(p.codename)).map(p => p.id)

  const groupState = group => {
    const ids = groupIds(group)
    if (ids.length === 0) return 'unchecked'
    const checkedCount = ids.filter(id => checkedIds.has(id)).length
    if (checkedCount === 0) return 'unchecked'
    if (checkedCount === ids.length) return 'checked'
    return 'indeterminate'
  }

  const toggleGroup = group => {
    const ids = groupIds(group)
    const state = groupState(group)
    setCheckedIds(prev => {
      const next = new Set(prev)
      if (state === 'checked') {
        ids.forEach(id => next.delete(id))
      } else {
        ids.forEach(id => next.add(id))
      }
      return next
    })
  }

  // ── Save permissions ──────────────────────────────────────────────────────
  const handleSavePerms = () => setConfirmAction('perms')

  const doSavePerms = async () => {
    setPermsMsg(null)
    setSavingPerms(true)
    try {
      await client.put(`/users/${id}/permissions/`, {
        permission_ids: [...checkedIds],
      })
      setPermsMsg({ type: 'success', text: 'Permissions saved successfully.' })
    } catch (err) {
      setPermsMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save permissions.' })
    } finally {
      setSavingPerms(false)
    }
  }

  // ── Save teacher centers ──────────────────────────────────────────────────
  const handleSaveCenters = () => setConfirmAction('centers')

  const doSaveCenters = async () => {
    setCentersMsg(null)
    setSavingCenters(true)
    try {
      await client.put(`/users/${id}/centers/`, { center_ids: [...teacherCenterIds] })
      setCentersMsg({ type: 'success', text: 'Center assignments saved.' })
    } catch (err) {
      setCentersMsg({ type: 'error', text: err.response?.data?.error || 'Failed to save centers.' })
    } finally {
      setSavingCenters(false)
    }
  }

  const handleConfirmYes = () => {
    const action = confirmAction
    setConfirmAction(null)
    if (action === 'profile') doSaveProfile()
    if (action === 'perms')   doSavePerms()
    if (action === 'centers') doSaveCenters()
  }

  const toggleTeacherCenter = centerId => {
    setTeacherCenterIds(prev => {
      const next = new Set(prev)
      next.has(centerId) ? next.delete(centerId) : next.add(centerId)
      return next
    })
  }

  // ── Group permissions by model (Access Control pinned first) ─────────────────
  const grouped = allPerms.reduce((acc, p) => {
    if (!acc[p.model_name]) acc[p.model_name] = []
    acc[p.model_name].push(p)
    return acc
  }, {})
  const groupedEntries = Object.entries(grouped).sort(([a], [b]) => {
    if (a === 'Access Control') return -1
    if (b === 'Access Control') return 1
    return a.localeCompare(b)
  })

  // ── Render ────────────────────────────────────────────────────────────────
  if (loading) return (
    <Layout>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
        <span className="spinner spinner-dark" />
      </div>
    </Layout>
  )

  return (
    <Layout>
      <PageHeader
        title={user.name}
        subtitle={user.email}
        back="Back to Users"
        onBack={() => navigate('/admin/users')}
      />

      <div className="grid-2">

        {/* ── Edit profile card ── */}
        <div className="card">
          <div className="card-header">{t('admin.userProfile.title')}</div>
          <div className="card-body">
            {formMsg && <div className={`alert alert-${formMsg.type}`}>{formMsg.text}</div>}

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                {formErrors.name && <p className="form-hint" style={{ color: 'var(--rose)' }}>{formErrors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Email address</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
                {formErrors.email && <p className="form-hint" style={{ color: 'var(--rose)' }}>{formErrors.email}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">Role</label>
                <select
                  className="form-control"
                  value={form.role}
                  onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                >
                  {ALL_ROLES.map(r => (
                    <option key={r} value={r}>
                      {r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </option>
                  ))}
                </select>
              </div>

              {/* Toggles row */}
              <div style={{ display: 'flex', gap: 24, marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Active</span>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 14 }}>
                  <input
                    type="checkbox"
                    checked={form.is_staff}
                    onChange={e => setForm(f => ({ ...f, is_staff: e.target.checked }))}
                    style={{ width: 16, height: 16 }}
                  />
                  <span>Staff / Admin access</span>
                </label>
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={savingForm}>
                {savingForm && <span className="spinner" />}
                {savingForm ? t('common.loading') : t('common.save')}
              </button>
            </form>
          </div>
        </div>

        {/* ── Permissions card ── */}
        <div className="card">
          <div className="card-header flex-between">
            {t('admin.userProfile.permissions')}
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
              {checkedIds.size} assigned
            </span>
          </div>
          <div className="card-body">
            {permsMsg && <div className={`alert alert-${permsMsg.type}`}>{permsMsg.text}</div>}

            {/* ── Role Presets ── */}
            <div style={{ marginBottom: 20 }}>
              <div style={{
                fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                letterSpacing: '.06em', color: 'var(--gray-500)',
                marginBottom: 10, paddingBottom: 6,
                borderBottom: '1px solid var(--gray-100)',
              }}>
                Role Presets
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ROLE_GROUPS.map(group => {
                  const state = groupState(group)
                  return (
                    <GroupPresetRow
                      key={group.key}
                      group={group}
                      state={state}
                      count={groupIds(group).length}
                      onToggle={() => toggleGroup(group)}
                    />
                  )
                })}
              </div>
            </div>

            {groupedEntries.length === 0 ? (
              <p className="text-muted text-sm">No permissions available.</p>
            ) : (
              groupedEntries.map(([model, perms]) => (
                <div key={model} style={{ marginBottom: 20 }}>
                  {/* Model header */}
                  <div style={{
                    fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                    letterSpacing: '.06em', color: 'var(--gray-500)',
                    marginBottom: 8, paddingBottom: 6,
                    borderBottom: '1px solid var(--gray-100)',
                  }}>
                    {model}
                  </div>

                  {/* Permission checkboxes */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 12px' }}>
                    {perms.map(p => (
                      <label
                        key={p.id}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 8,
                          cursor: 'pointer', fontSize: 13,
                          color: checkedIds.has(p.id) ? 'var(--primary-dark)' : 'var(--gray-700)',
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={checkedIds.has(p.id)}
                          onChange={() => togglePerm(p.id)}
                          style={{ width: 14, height: 14, accentColor: 'var(--primary)' }}
                        />
                        {p.codename.replace(/_/g, ' ')}
                      </label>
                    ))}
                  </div>
                </div>
              ))
            )}

            {/* Quick-select buttons */}
            <div className="flex gap-8" style={{ marginTop: 16, marginBottom: 20, flexWrap: 'wrap' }}>
              <button className="btn btn-outline btn-sm"
                onClick={() => setCheckedIds(new Set(allPerms.map(p => p.id)))}>
                Select All
              </button>
              <button className="btn btn-outline btn-sm"
                onClick={() => setCheckedIds(new Set())}>
                Clear All
              </button>
            </div>

            <button
              className="btn btn-primary btn-full"
              disabled={savingPerms}
              onClick={handleSavePerms}
            >
              {savingPerms && <span className="spinner" />}
              {savingPerms ? t('common.loading') : t('admin.userProfile.savePermissions')}
            </button>
          </div>
        </div>

      </div>

      {/* ── Teacher center assignments ── */}
      {user.role === 'teacher' && (
        <div className="card" style={{ marginTop: 24 }}>
          <div className="card-header flex-between">
            Center Assignments
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
              {teacherCenterIds.size} assigned
            </span>
          </div>
          <div className="card-body">
            {centersMsg && (
              <div className={`alert alert-${centersMsg.type}`} style={{ marginBottom: 16 }}>
                {centersMsg.text}
              </div>
            )}

            {allCenters.length === 0 ? (
              <p className="text-muted text-sm">No active centers exist yet. Create centers first.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginBottom: 20 }}>
                {allCenters.map(c => (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 14px', borderRadius: 8, cursor: 'pointer',
                      border: `1.5px solid ${teacherCenterIds.has(c.id) ? 'var(--primary)' : 'var(--gray-200)'}`,
                      background: teacherCenterIds.has(c.id) ? 'var(--primary-light)' : 'var(--gray-50)',
                      transition: 'border-color .15s, background .15s',
                      userSelect: 'none',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={teacherCenterIds.has(c.id)}
                      onChange={() => toggleTeacherCenter(c.id)}
                      style={{ width: 15, height: 15, accentColor: 'var(--primary)', flexShrink: 0 }}
                    />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: teacherCenterIds.has(c.id) ? 'var(--primary-dark)' : 'var(--gray-800)' }}>
                        {c.name}
                      </div>
                      {(c.city || c.state) && (
                        <div style={{ fontSize: 11, color: 'var(--gray-500)' }}>
                          {[c.city, c.state].filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary"
              disabled={savingCenters || allCenters.length === 0}
              onClick={handleSaveCenters}
            >
              {savingCenters && <span className="spinner" />}
              {savingCenters ? t('common.loading') : t('common.save')}
            </button>
          </div>
        </div>
      )}

      {confirmAction && (
        <ConfirmDialog
          open
          title={CONFIRM_CONFIG[confirmAction].title}
          message={CONFIRM_CONFIG[confirmAction].message}
          onYes={handleConfirmYes}
          onNo={() => setConfirmAction(null)}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </Layout>
  )
}
