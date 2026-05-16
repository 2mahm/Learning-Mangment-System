import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import { Icon, PageHeader } from '../../components/NurUI'

export default function StudentRequests() {
  const { t } = useTranslation()
  const { hasPerm } = useAuth()
  const [requests,   setRequests]   = useState([])
  const [loading,    setLoading]    = useState(true)
  const [statusTab,  setStatusTab]  = useState('pending')

  const [approveId,   setApproveId]   = useState(null)
  const [credentials, setCredentials] = useState({ grade: '' })
  const [approveErrs, setApproveErrs] = useState({})
  const [approving,   setApproving]   = useState(false)
  const [actionMsg,   setActionMsg]   = useState(null)
  const [grades,      setGrades]      = useState([])

  const fetchRequests = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await client.get(`/student-requests/?status=${statusTab}`)
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }, [statusTab])

  useEffect(() => { fetchRequests() }, [fetchRequests])

  useEffect(() => {
    client.get('/grades/').then(r => setGrades(r.data)).catch(() => {})
  }, [])

  const openApprove = (id, currentGrade) => {
    setApproveId(id)
    setCredentials({ grade: currentGrade || '' })
    setApproveErrs({})
  }

  const handleApprove = async e => {
    e.preventDefault()
    setApproveErrs({})
    setApproving(true)
    try {
      const { data } = await client.post(
        `/student-requests/${approveId}/approve/`,
        credentials,
      )
      setActionMsg({
        type: 'success',
        text: `${data.student.name} approved — username: "${data.student.username}"`,
      })
      setApproveId(null)
      fetchRequests()
    } catch (err) {
      setApproveErrs(err.response?.data || {})
    } finally {
      setApproving(false)
    }
  }

  const handleReject = async id => {
    if (!window.confirm('Reject this student request?')) return
    try {
      await client.post(`/student-requests/${id}/reject/`)
      setActionMsg({ type: 'success', text: 'Request rejected.' })
      fetchRequests()
    } catch {
      setActionMsg({ type: 'error', text: 'Failed to reject request.' })
    }
  }

  const canApprove = hasPerm('can_approve_student_request')
  const canReject  = hasPerm('can_reject_student_request')

  return (
    <Layout>
      <PageHeader
        title={t('admin.studentRequests.title')}
        subtitle={t('admin.studentRequests.subtitle')}
      />

      {actionMsg && (
        <div className={`alert alert-${actionMsg.type}`} style={{ marginBottom: 20, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{actionMsg.text}</span>
          <button
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, lineHeight: 1, color: 'inherit', opacity: .7 }}
            onClick={() => setActionMsg(null)}
          >×</button>
        </div>
      )}

      {/* Status tabs */}
      <div className="tabs" style={{ marginBottom: 20 }}>
        {['pending', 'approved', 'rejected'].map(s => (
          <button
            key={s}
            className={`tab${statusTab === s ? ' active' : ''}`}
            onClick={() => { setStatusTab(s); setApproveId(null); setActionMsg(null) }}
          >
            {t(`admin.registrationRequests.${s}`)}
          </button>
        ))}
      </div>

      <div className="card">
        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}><span className="spinner spinner-dark" /></div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon"><Icon name="academic" size={36} color="var(--ink-soft)" /></div>
            <p className="empty-state-text">No {statusTab} student requests</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>Grade</th>
                  <th>Parent</th>
                  <th>Submitted</th>
                  {statusTab === 'pending' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <>
                    <tr key={req.id}>
                      <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{req.name}</td>
                      <td>
                        <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary)' }}>
                          {req.grade_name || '—'}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{req.parent_name}</div>
                        <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>{req.parent_email}</div>
                      </td>
                      <td className="text-sm text-muted">
                        {new Date(req.created_at).toLocaleDateString()}
                      </td>
                      {statusTab === 'pending' && (
                        <td>
                          <div className="flex gap-8">
                            {canApprove && (
                              <button
                                className="btn btn-success btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                onClick={() => openApprove(approveId === req.id ? null : req.id, req.grade_name)}
                              >
                                <Icon name={approveId === req.id ? 'x' : 'check'} size={13} color="#fff" />
                                {approveId === req.id ? t('common.cancel') : t('admin.studentRequests.approve')}
                              </button>
                            )}
                            {canReject && (
                              <button
                                className="btn btn-danger btn-sm"
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                                onClick={() => handleReject(req.id)}
                              >
                                <Icon name="x" size={13} color="#fff" />
                                {t('admin.studentRequests.reject')}
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>

                    {approveId === req.id && (
                      <tr key={`${req.id}-form`}>
                        <td colSpan={5} style={{ background: 'var(--surface-2)', padding: '16px 20px' }}>
                          <form onSubmit={handleApprove}>
                            <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--ink-2)' }}>
                              Approve <strong style={{ color: 'var(--ink)' }}>{req.name}</strong> — username &amp; password will be auto-generated
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
                              <div>
                                <label className="form-label">{t('admin.grades.gradeName')} *</label>
                                <select
                                  className="form-control"
                                  value={credentials.grade}
                                  onChange={e => setCredentials(c => ({ ...c, grade: e.target.value }))}
                                  required
                                >
                                  <option value="">{t('admin.studentRequests.selectGrade')}</option>
                                  {grades.map(g => (
                                    <option key={g.id} value={g.name}>{g.name}</option>
                                  ))}
                                </select>
                              </div>
                              <button type="submit" className="btn btn-success" disabled={approving}
                                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                {approving && <span className="spinner" />}
                                {approving ? 'Approving…' : 'Confirm'}
                              </button>
                            </div>
                          </form>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
