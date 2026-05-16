import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { ConfirmDialog } from '../../components/NurUI'

const EMPTY_FORM = { name: '', city: '', state: '', country: '', is_active: true }

export default function Centers() {
  const { t } = useTranslation()
  const [centers,    setCenters]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editingId,  setEditingId]  = useState(null)   // null = create mode
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [message,    setMessage]    = useState(null)   // { type, text }
  const [confirmCenter, setConfirmCenter] = useState(null)

  // ── load all centers (including inactive, staff view) ────────────────────
  const fetchCenters = useCallback(async () => {
    setLoading(true)
    try {
      // Staff-only: fetch all centers via detail API by getting the list with
      // all statuses. We reuse GET /centers/ which returns active only, but
      // the staff PATCH/DELETE endpoints can still manage inactive centers
      // retrieved via the table below (we store them from this fetch).
      const { data } = await client.get('/centers/')
      setCenters(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchCenters() }, [fetchCenters])

  // ── helpers ───────────────────────────────────────────────────────────────
  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setErrors({})
  }

  const startEdit = center => {
    setForm({
      name:      center.name,
      city:      center.city      || '',
      state:     center.state     || '',
      country:   center.country   || '',
      is_active: center.is_active,
    })
    setEditingId(center.id)
    setErrors({})
    setMessage(null)
  }

  // ── submit (create or update) ─────────────────────────────────────────────
  const handleSubmit = async e => {
    e.preventDefault()
    setErrors({})
    setMessage(null)
    setSubmitting(true)
    try {
      if (editingId) {
        await client.patch(`/centers/${editingId}/`, form)
        setMessage({ type: 'success', text: 'Center updated.' })
      } else {
        await client.post('/centers/', form)
        setMessage({ type: 'success', text: `Center "${form.name}" created.` })
      }
      resetForm()
      fetchCenters()
    } catch (err) {
      setErrors(err.response?.data || {})
    } finally {
      setSubmitting(false)
    }
  }

  // ── deactivate ────────────────────────────────────────────────────────────
  const handleDeactivate = center => setConfirmCenter(center)

  const doDeactivate = async () => {
    const center = confirmCenter
    setConfirmCenter(null)
    setMessage(null)
    try {
      await client.delete(`/centers/${center.id}/`)
      setMessage({ type: 'success', text: `Center "${center.name}" deactivated.` })
      fetchCenters()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to deactivate.' })
    }
  }

  // ── reactivate ────────────────────────────────────────────────────────────
  const handleReactivate = async center => {
    setMessage(null)
    try {
      await client.patch(`/centers/${center.id}/`, { is_active: true })
      setMessage({ type: 'success', text: `Center "${center.name}" reactivated.` })
      fetchCenters()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to reactivate.' })
    }
  }

  const field = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">{t('admin.centers.title')}</h1>
        <p className="page-subtitle">{t('admin.centers.subtitle')}</p>
      </div>

      {message && (
        <div className={`alert alert-${message.type}`} style={{ marginBottom: 20 }}>
          {message.text}
        </div>
      )}

      <div className="grid-2">

        {/* ── Create / Edit form ────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            {editingId ? t('admin.centers.editCenter') : t('admin.centers.addCenter')}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('admin.centers.name')} *</label>
                <input
                  className="form-control"
                  placeholder="e.g. Chicago Islamic Center"
                  value={form.name}
                  onChange={field('name')}
                  required
                />
                {errors.name && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.centers.city')}</label>
                <input className="form-control" placeholder="Chicago" value={form.city} onChange={field('city')} />
                {errors.city && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.city}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.centers.state')}</label>
                <input className="form-control" placeholder="IL" value={form.state} onChange={field('state')} />
                {errors.state && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.state}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.centers.country')}</label>
                <input className="form-control" placeholder="USA" value={form.country} onChange={field('country')} />
                {errors.country && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.country}</p>}
              </div>

              {editingId && (
                <div className="form-group">
                  <label className="form-label">{t('admin.centers.status')}</label>
                  <select
                    className="form-control"
                    value={form.is_active ? 'active' : 'inactive'}
                    onChange={e => setForm(f => ({ ...f, is_active: e.target.value === 'active' }))}
                  >
                    <option value="active">{t('admin.centers.active')}</option>
                    <option value="inactive">{t('admin.centers.inactive')}</option>
                  </select>
                </div>
              )}

              <div className="flex gap-8">
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting && <span className="spinner" />}
                  {submitting ? t('common.loading') : editingId ? t('common.save') : t('admin.centers.addCenter')}
                </button>
                {editingId && (
                  <button type="button" className="btn btn-outline" onClick={resetForm}>
                    {t('common.cancel')}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── Centers table ─────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header flex-between">
            All Centers
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
              {centers.length} total
            </span>
          </div>

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner spinner-dark" />
            </div>
          ) : centers.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🏢</div>
              <p className="empty-state-text">No centers yet. Create the first one.</p>
            </div>
          ) : (
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>{t('admin.centers.name')}</th>
                    <th>{t('admin.centers.city')}</th>
                    <th>{t('admin.centers.status')}</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {centers.map(c => (
                    <tr key={c.id}>
                      <td style={{ fontWeight: 600 }}>{c.name}</td>
                      <td className="text-sm text-muted">
                        {[c.city, c.state, c.country].filter(Boolean).join(', ') || '—'}
                      </td>
                      <td>
                        <span className={`badge ${c.is_active ? 'badge-approved' : 'badge-rejected'}`}>
                          {c.is_active ? t('admin.centers.active') : t('admin.centers.inactive')}
                        </span>
                      </td>
                      <td>
                        <div className="flex gap-8">
                          <button className="btn btn-outline btn-sm" onClick={() => startEdit(c)}>
                            {t('common.edit')}
                          </button>
                          {c.is_active ? (
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--danger)' }}
                              onClick={() => handleDeactivate(c)}>
                              Deactivate
                            </button>
                          ) : (
                            <button className="btn btn-outline btn-sm" style={{ color: 'var(--success)' }}
                              onClick={() => handleReactivate(c)}>
                              Reactivate
                            </button>
                          )}
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
      <ConfirmDialog
        open={!!confirmCenter}
        title="Deactivate Center"
        message={confirmCenter ? `Deactivate "${confirmCenter.name}"? It will no longer appear in invitation dropdowns.` : ''}
        danger
        onYes={doDeactivate}
        onNo={() => setConfirmCenter(null)}
        onCancel={() => setConfirmCenter(null)}
      />
    </Layout>
  )
}
