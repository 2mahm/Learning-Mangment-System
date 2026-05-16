import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams, useNavigate } from 'react-router-dom'
import client from '../api/client'

function PasswordRules({ password, email }) {
  const rules = [
    { label: 'At least 12 characters',       ok: password.length >= 12 },
    { label: 'At least 2 numbers',            ok: (password.match(/\d/g) || []).length >= 2 },
    { label: 'At least 2 special characters', ok: (password.match(/[^a-zA-Z0-9]/g) || []).length >= 2 },
    { label: 'At least 1 uppercase letter',   ok: /[A-Z]/.test(password) },
    { label: 'Must not match your email',     ok: password.length > 0 && password !== email },
  ]
  return (
    <div style={{
      background: 'var(--gray-50, #f8f9fa)',
      border: '1px solid var(--gray-200, #e9ecef)',
      borderRadius: 6,
      padding: '8px 12px',
      marginTop: 6,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
    }}>
      {rules.map(rule => (
        <div key={rule.label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ fontSize: 13, color: rule.ok ? '#22c55e' : '#94a3b8', lineHeight: 1 }}>
            {rule.ok ? '✓' : '○'}
          </span>
          <span style={{ fontSize: 12, color: rule.ok ? '#166534' : '#64748b' }}>
            {rule.label}
          </span>
        </div>
      ))}
    </div>
  )
}

export default function Register() {
  const { t } = useTranslation()
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()

  // Capture the token once at mount — storing in state prevents the validation
  // effect from re-firing when sessionStorage is cleared after a successful submit.
  const [token] = useState(
    () => params.get('token') || sessionStorage.getItem('invite_token')
  )

  const [invitation,  setInvitation]  = useState(null)
  const [tokenError,  setTokenError]  = useState('')
  const [validating,  setValidating]  = useState(true)

  const [form, setForm] = useState({
    name: '', email: '', password: '', confirm_password: '',
  })
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState(false)

  // If token arrived via URL (email link), move it to sessionStorage and clean the URL
  useEffect(() => {
    const urlToken = params.get('token')
    if (urlToken) {
      sessionStorage.setItem('invite_token', urlToken)
      setParams({}, { replace: true })
    }
  }, [])

  // Step 1 – validate the token (runs once because token is in state)
  useEffect(() => {
    if (!token) {
      setTokenError('No invitation token found in the URL.')
      setValidating(false)
      return
    }
    client.get(`/register/?token=${token}`)
      .then(res => {
        setInvitation(res.data)
        if (res.data.restricted_email) {
          setForm(f => ({ ...f, email: res.data.restricted_email }))
        }
      })
      .catch(err => {
        setTokenError(
          err.response?.data?.error || 'Invalid or expired invitation token.'
        )
      })
      .finally(() => setValidating(false))
  }, [token])

  // Step 3 – redirect to login 3 seconds after successful submission
  useEffect(() => {
    if (!success) return
    const t = setTimeout(() => navigate('/login'), 3000)
    return () => clearTimeout(t)
  }, [success])

  // Step 2 – submit the registration form
  const handleSubmit = async e => {
    e.preventDefault()
    setErrors({})
    setSubmitting(true)
    try {
      await client.post('/register/', { ...form, token })
      sessionStorage.removeItem('invite_token')
      setSuccess(true)
    } catch (err) {
      setErrors(err.response?.data || {})
    } finally {
      setSubmitting(false)
    }
  }

  /* ── Loading ── */
  if (validating) return (
    <div className="auth-page">
      <div style={{ color: '#fff', fontSize: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span className="spinner" /> Validating invitation…
      </div>
    </div>
  )

  /* ── Invalid token ── */
  if (tokenError) return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><span className="auth-logo-text">LMS</span></div>
        <div className="alert alert-error" style={{ marginTop: 24 }}>
          <strong>Invalid Invitation</strong>
          <p style={{ marginTop: 4, fontSize: 13 }}>{tokenError}</p>
        </div>
      </div>
    </div>
  )

  /* ── Success ── */
  if (success) return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><span className="auth-logo-text">LMS</span></div>
        <div style={{ textAlign: 'center', marginTop: 24 }}>
          <div style={{ fontSize: 48 }}>✅</div>
          <h2 style={{ marginTop: 12, fontSize: 20, fontWeight: 700 }}>Registration Submitted!</h2>
          <p style={{ marginTop: 8, fontSize: 14, color: 'var(--gray-500)' }}>
            Your request is pending admin approval.<br />
            You will receive an email once your account is activated.
          </p>
          <p style={{ marginTop: 16, fontSize: 13, color: 'var(--gray-400)' }}>
            Redirecting to login page…
          </p>
        </div>
      </div>
    </div>
  )

  /* ── Registration form ── */
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo"><span className="auth-logo-text">LMS</span></div>
        <h1 className="auth-title">{t('register.title')}</h1>
        <p className="auth-subtitle" style={{ marginBottom: 8 }}>
          Registering as&nbsp;
          <span className={`badge badge-${invitation.role}`}>{invitation.role}</span>
        </p>
        {invitation.center_name && (
          <p className="auth-subtitle" style={{ marginBottom: 20, fontSize: 13 }}>
            Center:&nbsp;<strong>{invitation.center_name}</strong>
          </p>
        )}

        {errors.non_field_errors && (
          <div className="alert alert-error">{errors.non_field_errors}</div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('register.name')}</label>
            <input
              className="form-control"
              placeholder="John Doe"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              autoFocus
            />
            {errors.name && (
              <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.name}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.email')}</label>
            <input
              type="email"
              className="form-control"
              placeholder="you@example.com"
              value={form.email}
              disabled={!!invitation.restricted_email}
              onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
              required
            />
            {invitation.restricted_email && (
              <p className="form-hint">This invitation is locked to this email.</p>
            )}
            {errors.email && (
              <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.email}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.password')}</label>
            <input
              type="password"
              className="form-control"
              placeholder="Min. 12 chars, 2 numbers, 2 special chars, 1 uppercase"
              value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
              required
            />
            <PasswordRules password={form.password} email={form.email} />
            {errors.password && (
              <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.password}</p>
            )}
          </div>

          <div className="form-group">
            <label className="form-label">{t('register.confirmPassword')}</label>
            <input
              type="password"
              className="form-control"
              placeholder="Repeat your password"
              value={form.confirm_password}
              onChange={e => setForm(f => ({ ...f, confirm_password: e.target.value }))}
              required
            />
            {errors.confirm_password && (
              <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.confirm_password}</p>
            )}
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-full"
            disabled={submitting}
            style={{ marginTop: 8 }}
          >
            {submitting && <span className="spinner" />}
            {submitting ? t('register.creating') : t('register.submit')}
          </button>
        </form>
      </div>
    </div>
  )
}
