import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../components/Layout'
import client from '../api/client'
import { useAuth } from '../context/AuthContext'
import { Avatar, PageHeader } from '../components/NurUI'

export default function ProfilePage() {
  const { t } = useTranslation()
  const { user, refreshUser } = useAuth()

  const [form, setForm] = useState({
    name:  user?.name  ?? '',
    email: user?.email ?? '',
  })
  const [formErrors,  setFormErrors]  = useState({})
  const [formMsg,     setFormMsg]     = useState(null)
  const [savingForm,  setSavingForm]  = useState(false)

  const [pwForm, setPwForm] = useState({
    current_password:  '',
    new_password:      '',
    confirm_password:  '',
  })
  const [pwErrors,  setPwErrors]  = useState({})
  const [pwMsg,     setPwMsg]     = useState(null)
  const [savingPw,  setSavingPw]  = useState(false)

  const handleSaveProfile = async e => {
    e.preventDefault()
    setFormErrors({})
    setFormMsg(null)
    setSavingForm(true)
    try {
      await client.patch('/me/', { name: form.name, email: form.email })
      await refreshUser()
      setFormMsg({ type: 'success', text: t('profile.profileUpdated') })
    } catch (err) {
      setFormErrors(err.response?.data || {})
    } finally {
      setSavingForm(false)
    }
  }

  const handleChangePassword = async e => {
    e.preventDefault()
    setPwErrors({})
    setPwMsg(null)
    setSavingPw(true)
    try {
      await client.patch('/me/', pwForm)
      setPwMsg({ type: 'success', text: t('profile.passwordChanged') })
      setPwForm({ current_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      setPwErrors(err.response?.data || {})
    } finally {
      setSavingPw(false)
    }
  }

  function roleLabel(u) {
    if (u?.is_staff)                return 'Administrator'
    if (u?.role === 'center_admin') return 'Center Admin'
    if (u?.role === 'parent')       return 'Parent'
    if (u?.role === 'teacher')      return 'Teacher'
    return u?.role ?? ''
  }

  return (
    <Layout>
      <PageHeader title={t('profile.title')} subtitle={t('profile.subtitle')} />

      <div className="grid-2">

        {/* ── Profile info card ── */}
        <div className="card">
          <div className="card-header">{t('profile.accountInfo')}</div>
          <div className="card-body">

            {/* Avatar + role badge */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
              <Avatar name={user?.name} size={56} />
              <div>
                <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>{user?.name}</div>
                <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)', marginTop: 4 }}>
                  {roleLabel(user)}
                </span>
              </div>
            </div>

            {formMsg && <div className={`alert alert-${formMsg.type}`}>{formMsg.text}</div>}

            <form onSubmit={handleSaveProfile}>
              <div className="form-group">
                <label className="form-label">{t('profile.name')}</label>
                <input
                  className="form-control"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                {formErrors.name && <p className="form-hint" style={{ color: 'var(--rose)' }}>{formErrors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('profile.email')}</label>
                <input
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  required
                />
                {formErrors.email && <p className="form-hint" style={{ color: 'var(--rose)' }}>{formErrors.email}</p>}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={savingForm}>
                {savingForm && <span className="spinner" />}
                {savingForm ? t('profile.saving') : t('profile.saveProfile')}
              </button>
            </form>
          </div>
        </div>

        {/* ── Change password card ── */}
        <div className="card">
          <div className="card-header">{t('profile.changePasswordTitle')}</div>
          <div className="card-body">
            {pwMsg && <div className={`alert alert-${pwMsg.type}`}>{pwMsg.text}</div>}

            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label className="form-label">{t('profile.currentPassword')}</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.current_password}
                  onChange={e => setPwForm(f => ({ ...f, current_password: e.target.value }))}
                  autoComplete="current-password"
                  required
                />
                {pwErrors.current_password && (
                  <p className="form-hint" style={{ color: 'var(--rose)' }}>{pwErrors.current_password}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t('profile.newPassword')}</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.new_password}
                  onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                {pwErrors.new_password && (
                  <p className="form-hint" style={{ color: 'var(--rose)' }}>{pwErrors.new_password}</p>
                )}
              </div>

              <div className="form-group">
                <label className="form-label">{t('profile.confirmPassword')}</label>
                <input
                  type="password"
                  className="form-control"
                  value={pwForm.confirm_password}
                  onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                  autoComplete="new-password"
                  required
                />
                {pwErrors.confirm_password && (
                  <p className="form-hint" style={{ color: 'var(--rose)' }}>{pwErrors.confirm_password}</p>
                )}
              </div>

              <button type="submit" className="btn btn-primary btn-full" disabled={savingPw}>
                {savingPw && <span className="spinner" />}
                {savingPw ? t('profile.saving') : t('profile.changePassword')}
              </button>
            </form>
          </div>
        </div>

      </div>
    </Layout>
  )
}
