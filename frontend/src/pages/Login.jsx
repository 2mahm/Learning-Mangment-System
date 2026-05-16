import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { useLanguage } from '../context/LanguageContext'
import client from '../api/client'

export default function Login() {
  const { login }  = useAuth()
  const navigate   = useNavigate()
  const { t } = useTranslation()
  const { toggleLanguage } = useLanguage()
  const [tab, setTab] = useState('user')

  const [userForm, setUserForm]     = useState({ email: '', password: '' })
  const [userError, setUserError]   = useState('')
  const [userLoading, setUserLoading] = useState(false)

  const handleUserSubmit = async e => {
    e.preventDefault()
    setUserError('')
    setUserLoading(true)
    try {
      await login(userForm.email, userForm.password)
      navigate('/')
    } catch (err) {
      setUserError(
        err.response?.data?.non_field_errors?.[0] ||
        t('login.invalidCredentials')
      )
    } finally {
      setUserLoading(false)
    }
  }

  const [stuForm, setStuForm]     = useState({ username: '', password: '' })
  const [stuError, setStuError]   = useState('')
  const [stuLoading, setStuLoading] = useState(false)

  const handleStudentSubmit = async e => {
    e.preventDefault()
    setStuError('')
    setStuLoading(true)
    try {
      const { data } = await client.post('/student-login/', stuForm)
      localStorage.setItem('lms_student', JSON.stringify(data))
      navigate('/student/content')
    } catch (err) {
      setStuError(err.response?.data?.error || t('login.invalidStudentCredentials'))
    } finally {
      setStuLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ position: 'relative' }}>

        {/* Language toggle */}
        <button
          onClick={toggleLanguage}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: '1px solid var(--line)',
            borderRadius: 6, padding: '4px 10px', fontSize: 12,
            cursor: 'pointer', color: 'var(--ink-soft)',
          }}
        >
          🌐 {t('common.langToggle')}
        </button>

        <div className="auth-logo">
          <img src="/logo.png" alt="LMS Logo" className="auth-logo-img" />
          <span className="auth-logo-text">LMS</span>
        </div>
        <h1 className="auth-title">{t('login.welcomeBack')}</h1>

        {/* Tabs */}
        <div className="tabs" style={{ marginBottom: 24 }}>
          <button
            className={`tab${tab === 'user' ? ' active' : ''}`}
            onClick={() => setTab('user')}
          >
            {t('login.staffParentTab')}
          </button>
          <button
            className={`tab${tab === 'student' ? ' active' : ''}`}
            onClick={() => setTab('student')}
          >
            {t('login.studentTab')}
          </button>
        </div>

        {/* User login form */}
        {tab === 'user' && (
          <>
            <p className="auth-subtitle" style={{ marginBottom: 20 }}>{t('login.signInWithEmail')}</p>
            {userError && <div className="alert alert-error">{userError}</div>}
            <form onSubmit={handleUserSubmit}>
              <div className="form-group">
                <label className="form-label">{t('login.emailAddress')}</label>
                <input
                  type="email"
                  className="form-control"
                  placeholder={t('login.emailPlaceholder')}
                  value={userForm.email}
                  onChange={e => setUserForm(f => ({ ...f, email: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('login.password')}</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={userForm.password}
                  onChange={e => setUserForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={userLoading}
                style={{ marginTop: 8 }}
              >
                {userLoading && <span className="spinner" />}
                {userLoading ? t('login.signingIn') : t('login.signIn')}
              </button>
            </form>
          </>
        )}

        {/* Student login form */}
        {tab === 'student' && (
          <>
            <p className="auth-subtitle" style={{ marginBottom: 20 }}>{t('login.signInWithUsername')}</p>
            {stuError && <div className="alert alert-error">{stuError}</div>}
            <form onSubmit={handleStudentSubmit}>
              <div className="form-group">
                <label className="form-label">{t('login.username')}</label>
                <input
                  className="form-control"
                  placeholder={t('login.usernamePlaceholder')}
                  value={stuForm.username}
                  onChange={e => setStuForm(f => ({ ...f, username: e.target.value }))}
                  required
                  autoFocus
                />
              </div>
              <div className="form-group">
                <label className="form-label">{t('login.password')}</label>
                <input
                  type="password"
                  className="form-control"
                  placeholder="••••••••"
                  value={stuForm.password}
                  onChange={e => setStuForm(f => ({ ...f, password: e.target.value }))}
                  required
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-full"
                disabled={stuLoading}
                style={{ marginTop: 8 }}
              >
                {stuLoading && <span className="spinner" />}
                {stuLoading ? t('login.signingIn') : t('login.signInAsStudent')}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
