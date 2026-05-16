import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { Icon, PageHeader } from '../../components/NurUI'

const TABS = ['pending', 'approved', 'rejected']

export default function RegistrationRequests() {
  const { t } = useTranslation()
  const [activeTab,     setActiveTab]     = useState('pending')
  const [requests,      setRequests]      = useState([])
  const [loading,       setLoading]       = useState(true)
  const [actionLoading, setActionLoading] = useState(null)
  const [message,       setMessage]       = useState(null)

  const fetchRequests = useCallback(async status => {
    setLoading(true)
    try {
      const { data } = await client.get(`/registration-requests/?status=${status}`)
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setMessage(null)
    fetchRequests(activeTab)
  }, [activeTab, fetchRequests])

  const handleAction = async (id, action) => {
    setActionLoading(id)
    setMessage(null)
    try {
      const { data } = await client.post(`/registration-requests/${id}/${action}/`)
      setMessage({ type: 'success', text: data.message })
      fetchRequests(activeTab)
    } catch (err) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Action failed. Please try again.',
      })
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <Layout>
      <PageHeader
        title={t('admin.registrationRequests.title')}
        subtitle={t('admin.registrationRequests.subtitle')}
      />

      {message && (
        <div className={`alert alert-${message.type}`}>{message.text}</div>
      )}

      <div className="card">
        <div style={{ padding: '0 24px' }}>
          <div className="tabs">
            {TABS.map(tab => (
              <button
                key={tab}
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {t(`admin.registrationRequests.${tab}`)}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ padding: 48, textAlign: 'center' }}>
            <span className="spinner spinner-dark" />
          </div>
        ) : requests.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <Icon name="clipboard" size={36} color="var(--ink-soft)" />
            </div>
            <p className="empty-state-text">No {activeTab} requests</p>
          </div>
        ) : (
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  {activeTab === 'pending' && <th>Actions</th>}
                </tr>
              </thead>
              <tbody>
                {requests.map(req => (
                  <tr key={req.id}>
                    <td style={{ fontWeight: 600, color: 'var(--ink)' }}>{req.name}</td>
                    <td className="text-sm">{req.email}</td>
                    <td>
                      <span className={`badge badge-${req.role}`}>{req.role}</span>
                    </td>
                    <td className="text-sm text-muted">
                      {new Date(req.created_at).toLocaleDateString()}
                    </td>
                    <td>
                      <span className={`badge badge-${req.status}`}>{req.status}</span>
                    </td>
                    {activeTab === 'pending' && (
                      <td>
                        <div className="flex gap-8">
                          <button
                            className="btn btn-success btn-sm"
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'approve')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            {actionLoading === req.id
                              ? <span className="spinner" style={{ width: 12, height: 12 }} />
                              : <Icon name="check" size={13} color="#fff" />}
                            {t('admin.registrationRequests.approve')}
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            disabled={actionLoading === req.id}
                            onClick={() => handleAction(req.id, 'reject')}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}
                          >
                            <Icon name="x" size={13} color="#fff" />
                            {t('admin.registrationRequests.reject')}
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </Layout>
  )
}
