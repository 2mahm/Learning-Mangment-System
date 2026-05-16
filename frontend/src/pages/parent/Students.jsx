import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { Avatar, Icon, PageHeader, StatCard } from '../../components/NurUI'

function CredentialCard({ student, idx }) {
  const { t } = useTranslation()
  const [copied,       setCopied]       = useState(null)
  const [showPwForm,   setShowPwForm]   = useState(false)
  const [pwForm,       setPwForm]       = useState({ new_password: '', confirm_password: '' })
  const [pwErrors,     setPwErrors]     = useState({})
  const [pwMsg,        setPwMsg]        = useState(null)
  const [savingPw,     setSavingPw]     = useState(false)

  const copy = (text, field) => {
    navigator.clipboard.writeText(text)
    setCopied(field)
    setTimeout(() => setCopied(null), 1800)
  }

  const handleChangePassword = async e => {
    e.preventDefault()
    setPwErrors({})
    setPwMsg(null)
    setSavingPw(true)
    try {
      const { data } = await client.post(`/students/${student.id}/change-password/`, pwForm)
      setPwMsg({ type: 'success', text: data.message })
      setPwForm({ new_password: '', confirm_password: '' })
      setTimeout(() => { setPwMsg(null); setShowPwForm(false) }, 2500)
    } catch (err) {
      setPwErrors(err.response?.data || {})
    } finally {
      setSavingPw(false)
    }
  }

  const accentColor = `hsl(${(idx * 67) % 360}, 60%, 55%)`

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ height: 3, background: accentColor }} />
      <div style={{ padding: '16px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
          <Avatar name={student.name} size={40} />
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{student.name}</div>
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)', marginTop: 3 }}>
              {student.grade}
            </span>
          </div>
        </div>

        {/* Username row */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 10,
        }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', color: 'var(--ink-soft)', marginBottom: 2 }}>
              {t('parent.students.username')}
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>
              {student.username}
            </div>
          </div>
          <button
            onClick={() => copy(student.username, 'user')}
            style={{
              display: 'flex', alignItems: 'center', gap: 5, padding: '5px 10px',
              borderRadius: 6, cursor: 'pointer', fontFamily: 'inherit',
              background: copied === 'user' ? 'var(--emerald-l)' : 'var(--surface)',
              color: copied === 'user' ? 'var(--emerald)' : 'var(--ink-soft)',
              fontSize: 12, fontWeight: 600, transition: 'all .15s',
              border: '1.5px solid var(--line)',
            }}
          >
            <Icon name={copied === 'user' ? 'check' : 'copy'} size={13} color="currentColor" />
            {copied === 'user' ? 'Copied!' : 'Copy'}
          </button>
        </div>

        {/* Change password toggle */}
        <button
          onClick={() => { setShowPwForm(v => !v); setPwErrors({}); setPwMsg(null) }}
          style={{
            width: '100%', padding: '7px 12px', borderRadius: 7, cursor: 'pointer',
            fontFamily: 'inherit', fontSize: 12, fontWeight: 600,
            border: `1.5px solid ${showPwForm ? accentColor : 'var(--line)'}`,
            background: showPwForm ? 'var(--primary-light)' : 'var(--surface)',
            color: showPwForm ? 'var(--primary-dark)' : 'var(--ink-soft)',
            transition: 'all .15s',
          }}
        >
          {showPwForm ? t('common.cancel') : t('parent.students.changePassword')}
        </button>

        {/* Inline change-password form */}
        {showPwForm && (
          <form onSubmit={handleChangePassword} style={{ marginTop: 12 }}>
            {pwMsg && <div className={`alert alert-${pwMsg.type}`} style={{ marginBottom: 8, fontSize: 12 }}>{pwMsg.text}</div>}

            <div className="form-group" style={{ marginBottom: 8 }}>
              <label className="form-label" style={{ fontSize: 12 }}>{t('parent.students.newPassword')}</label>
              <input
                type="password"
                className="form-control"
                style={{ fontSize: 13 }}
                value={pwForm.new_password}
                onChange={e => setPwForm(f => ({ ...f, new_password: e.target.value }))}
                autoComplete="new-password"
                required
              />
              {pwErrors.new_password && (
                <p className="form-hint" style={{ color: 'var(--rose)', fontSize: 11 }}>{pwErrors.new_password}</p>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 10 }}>
              <label className="form-label" style={{ fontSize: 12 }}>{t('parent.students.confirmPassword')}</label>
              <input
                type="password"
                className="form-control"
                style={{ fontSize: 13 }}
                value={pwForm.confirm_password}
                onChange={e => setPwForm(f => ({ ...f, confirm_password: e.target.value }))}
                autoComplete="new-password"
                required
              />
              {pwErrors.confirm_password && (
                <p className="form-hint" style={{ color: 'var(--rose)', fontSize: 11 }}>{pwErrors.confirm_password}</p>
              )}
            </div>

            <button type="submit" className="btn btn-primary btn-full" disabled={savingPw} style={{ fontSize: 12 }}>
              {savingPw && <span className="spinner" />}
              {savingPw ? t('common.loading') : t('parent.students.savePassword')}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}

export default function Students() {
  const { t } = useTranslation()
  const [students,  setStudents]  = useState([])
  const [requests,  setRequests]  = useState([])
  const [loading,   setLoading]   = useState(true)

  const [form,       setForm]       = useState({ name: '', grade: '' })
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [success,    setSuccess]    = useState('')
  const [grades,     setGrades]     = useState([])

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const [{ data: s }, { data: r }, { data: g }] = await Promise.all([
        client.get('/students/'),
        client.get('/student-requests/'),
        client.get('/grades/'),
      ])
      setStudents(s)
      setRequests(r)
      setGrades(g)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchAll() }, [fetchAll])

  const handleSubmit = async e => {
    e.preventDefault()
    setErrors({})
    setSuccess('')
    setSubmitting(true)
    try {
      await client.post('/student-requests/', form)
      setSuccess(`Request for "${form.name}" submitted. Waiting for admin approval.`)
      setForm({ name: '', grade: '' })
      fetchAll()
    } catch (err) {
      setErrors(err.response?.data || {})
    } finally {
      setSubmitting(false)
    }
  }

  const pending  = requests.filter(r => r.status === 'pending')
  const rejected = requests.filter(r => r.status === 'rejected')

  return (
    <Layout>
      <PageHeader
        title={t('parent.students.title')}
        subtitle={t('parent.students.subtitle')}
      />

      {/* Stats */}
      <div className="stats-row">
        <StatCard icon="users"   label="Approved Students" value={students.length}  tone="emerald" />
        <StatCard icon="bell"    label="Pending Requests"  value={pending.length}   tone="amber"   />
        <StatCard icon="x"       label="Rejected"          value={rejected.length}  tone="rose"    />
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>

        {/* Add student form */}
        <div className="card">
          <div className="card-header">Request to Add a Student</div>
          <div className="card-body">
            {success && <div className="alert alert-success">{success}</div>}
            <div style={{
              background: 'var(--primary-light)', border: '1px solid #c7d2fe',
              borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: 13,
              color: 'var(--primary-dark)', lineHeight: 1.5,
            }}>
              After approval the admin will assign a username and password for your student to log in.
            </div>
            {!loading && grades.length === 0 ? (
              <div style={{
                background: 'var(--rose-l, #fff1f2)', border: '1px solid #fecdd3',
                borderRadius: 8, padding: '12px 14px', fontSize: 13,
                color: 'var(--rose, #e11d48)', lineHeight: 1.5,
              }}>
                No grades have been set up for your center yet. Please contact the admin before adding a student.
              </div>
            ) : (
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Student Name *</label>
                <input
                  className="form-control"
                  placeholder="Sara Doe"
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                />
                {errors.name && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.name}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Grade *</label>
                <select
                  className="form-control"
                  value={form.grade}
                  onChange={e => setForm(f => ({ ...f, grade: e.target.value }))}
                  required
                >
                  <option value="">— Select a grade —</option>
                  {grades.map(g => (
                    <option key={g.id} value={g.name}>{g.name}</option>
                  ))}
                </select>
                {errors.grade && <p className="form-hint" style={{ color: 'var(--rose)' }}>{errors.grade}</p>}
              </div>
              <button type="submit" className="btn btn-primary btn-full" disabled={submitting}>
                {submitting && <span className="spinner" />}
                {submitting ? 'Submitting…' : 'Submit Request'}
              </button>
            </form>
            )}
          </div>
        </div>

        {/* My requests */}
        <div className="card">
          <div className="card-header">
            My Requests
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
              {requests.length}
            </span>
          </div>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-dark" /></div>
          ) : requests.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon"><Icon name="clipboard" size={32} color="var(--ink-soft)" /></div>
              <p className="empty-state-text">No requests yet</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead><tr><th>Name</th><th>Grade</th><th>Status</th><th>Date</th></tr></thead>
                <tbody>
                  {requests.map(r => (
                    <tr key={r.id}>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{r.name}</td>
                      <td>{r.grade}</td>
                      <td>
                        <span className={`badge badge-${r.status}`}>{r.status}</span>
                      </td>
                      <td className="text-sm text-muted">
                        {new Date(r.created_at).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Approved students — credential cards */}
      <div style={{ marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--ink)' }}>
          Approved Students
          <span className="badge" style={{ background: 'var(--emerald-l)', color: 'var(--emerald)', marginLeft: 8 }}>
            {students.length}
          </span>
        </h2>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center' }}><span className="spinner spinner-dark" /></div>
      ) : students.length === 0 ? (
        <div className="card">
          <div style={{ padding: '48px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: .5 }}>🎒</div>
            <p style={{ color: 'var(--ink-soft)', fontSize: 15 }}>No approved students yet</p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
          {students.map((s, i) => (
            <CredentialCard key={s.id} student={s} idx={i} />
          ))}
        </div>
      )}
    </Layout>
  )
}
