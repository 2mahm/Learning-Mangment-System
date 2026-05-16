import { useState, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { ConfirmDialog } from '../../components/NurUI'

const EMPTY_FORM = { name: '', center: '', sort_order: 0 }

export default function Grades() {
  const { t } = useTranslation()
  const [grades,     setGrades]     = useState([])
  const [centers,    setCenters]    = useState([])
  const [loading,    setLoading]    = useState(true)
  const [form,       setForm]       = useState(EMPTY_FORM)
  const [editingId,  setEditingId]  = useState(null)
  const [errors,     setErrors]     = useState({})
  const [submitting, setSubmitting] = useState(false)
  const [message,    setMessage]    = useState(null)
  const [filterCenter, setFilterCenter] = useState('')
  const [confirmGrade, setConfirmGrade] = useState(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [gradesRes, centersRes] = await Promise.all([
        client.get('/grades/'),
        client.get('/centers/'),
      ])
      setGrades(gradesRes.data)
      setCenters(centersRes.data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const resetForm = () => {
    setForm(EMPTY_FORM)
    setEditingId(null)
    setErrors({})
  }

  const startEdit = grade => {
    setForm({ name: grade.name, center: grade.center, sort_order: grade.sort_order })
    setEditingId(grade.id)
    setErrors({})
    setMessage(null)
  }

  const handleSubmit = async e => {
    e.preventDefault()
    setErrors({})
    setMessage(null)
    setSubmitting(true)
    try {
      if (editingId) {
        await client.patch(`/grades/${editingId}/`, form)
        setMessage({ type: 'success', text: 'Grade updated.' })
      } else {
        await client.post('/grades/', form)
        setMessage({ type: 'success', text: `Grade "${form.name}" created.` })
      }
      resetForm()
      fetchData()
    } catch (err) {
      setErrors(err.response?.data || {})
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = grade => setConfirmGrade(grade)

  const doDelete = async () => {
    const grade = confirmGrade
    setConfirmGrade(null)
    setMessage(null)
    try {
      await client.delete(`/grades/${grade.id}/`)
      setMessage({ type: 'success', text: `Grade "${grade.name}" deleted.` })
      fetchData()
    } catch (err) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Failed to delete.' })
    }
  }

  const field = key => e => setForm(f => ({ ...f, [key]: e.target.value }))

  const displayedGrades = filterCenter
    ? grades.filter(g => String(g.center) === filterCenter)
    : grades

  // Group grades by center name for display
  const grouped = displayedGrades.reduce((acc, g) => {
    const key = g.center_name || `Center #${g.center}`
    if (!acc[key]) acc[key] = []
    acc[key].push(g)
    return acc
  }, {})

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">{t('admin.grades.title')}</h1>
        <p className="page-subtitle">{t('admin.grades.subtitle')}</p>
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
            {editingId ? t('admin.grades.editGrade') : t('admin.grades.addGrade')}
          </div>
          <div className="card-body">
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">{t('admin.grades.center')} *</label>
                <select
                  className="form-control"
                  value={form.center}
                  onChange={field('center')}
                  required
                  disabled={!!editingId}
                >
                  <option value="">Select a center…</option>
                  {centers.filter(c => c.is_active).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
                {errors.center && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.center}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.grades.gradeName')} *</label>
                <input
                  className="form-control"
                  placeholder="e.g. Grade 1, Level A, Beginners"
                  value={form.name}
                  onChange={field('name')}
                  required
                />
                {errors.name && <p className="form-hint" style={{ color: 'var(--danger)' }}>{errors.name}</p>}
              </div>

              <div className="form-group">
                <label className="form-label">{t('admin.grades.sortOrder')}</label>
                <input
                  className="form-control"
                  type="number"
                  min="0"
                  value={form.sort_order}
                  onChange={e => setForm(f => ({ ...f, sort_order: parseInt(e.target.value) || 0 }))}
                />
              </div>

              {errors.non_field_errors && (
                <p className="form-hint" style={{ color: 'var(--danger)', marginBottom: 8 }}>{errors.non_field_errors}</p>
              )}

              <div className="flex gap-8">
                <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={submitting}>
                  {submitting && <span className="spinner" />}
                  {submitting ? t('common.loading') : editingId ? t('common.save') : t('admin.grades.addGrade')}
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

        {/* ── Grades list ───────────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header flex-between">
            <span>All Grades</span>
            <span className="badge" style={{ background: 'var(--primary-light)', color: 'var(--primary-dark)' }}>
              {grades.length} total
            </span>
          </div>

          {centers.length > 1 && (
            <div style={{ padding: '8px 20px', borderBottom: '1px solid var(--border)' }}>
              <select
                className="form-control"
                value={filterCenter}
                onChange={e => setFilterCenter(e.target.value)}
                style={{ fontSize: 13 }}
              >
                <option value="">{t('admin.grades.filterByCenter')}</option>
                {centers.map(c => (
                  <option key={c.id} value={String(c.id)}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}>
              <span className="spinner spinner-dark" />
            </div>
          ) : displayedGrades.length === 0 ? (
            <div className="empty-state">
              <div className="empty-state-icon">🎓</div>
              <p className="empty-state-text">No grades yet. Add the first one.</p>
            </div>
          ) : (
            <div style={{ padding: '8px 0' }}>
              {Object.entries(grouped).map(([centerName, centerGrades]) => (
                <div key={centerName}>
                  <div style={{
                    padding: '6px 20px',
                    fontSize: 11,
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    color: 'var(--gray-500)',
                    background: 'var(--gray-50)',
                    borderTop: '1px solid var(--border)',
                    borderBottom: '1px solid var(--border)',
                  }}>
                    {centerName}
                  </div>
                  {centerGrades.map(g => (
                    <div key={g.id} style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '10px 20px',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      <div>
                        <span style={{ fontWeight: 600 }}>{g.name}</span>
                        {g.sort_order > 0 && (
                          <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--gray-400)' }}>
                            order: {g.sort_order}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-8">
                        <button className="btn btn-outline btn-sm" onClick={() => startEdit(g)}>
                          {t('common.edit')}
                        </button>
                        <button
                          className="btn btn-outline btn-sm"
                          style={{ color: 'var(--danger)' }}
                          onClick={() => handleDelete(g)}
                        >
                          {t('common.delete')}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      <ConfirmDialog
        open={!!confirmGrade}
        title="Delete Grade"
        message={confirmGrade ? `Delete "${confirmGrade.name}" from ${confirmGrade.center_name}? This will remove it from all lessons and subject groups.` : ''}
        danger
        onYes={doDelete}
        onNo={() => setConfirmGrade(null)}
        onCancel={() => setConfirmGrade(null)}
      />
    </Layout>
  )
}
