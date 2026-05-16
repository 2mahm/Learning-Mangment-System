import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import client from '../../api/client'
import { useAuth } from '../../context/AuthContext'
import {
  createSubjectGroup,
  deleteSubjectGroup,
  getGrades,
  getSubjectGroups,
} from '../../api/content'

const TRACK_COLORS = {
  arabic:  { background: 'var(--primary-light)', color: 'var(--primary-dark)' },
  quran:   { background: 'var(--success-light)', color: '#065f46' },
  culture: { background: '#ede9fe',              color: '#5b21b6' },
}

const EMPTY_FORM = { title: '', subject_track: 'arabic', description: '', centers: [], target_grades: [] }

export default function SubjectGroups() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t }    = useTranslation()

  const TRACK_LABELS = {
    arabic:  t('teacher.subjectGroups.tracks.arabic'),
    quran:   t('teacher.subjectGroups.tracks.quran'),
    culture: t('teacher.subjectGroups.tracks.culture'),
  }
  const [groups, setGroups]           = useState([])
  const [loading, setLoading]         = useState(true)
  const [showForm, setShowForm]       = useState(false)
  const [form, setForm]               = useState(EMPTY_FORM)
  const [saving, setSaving]           = useState(false)
  const [error, setError]             = useState('')
  const [formErrors, setFormErrors]   = useState({})
  const [deletingId, setDeletingId]   = useState(null)
  const [myCenters, setMyCenters]     = useState([])
  // Grade objects: { id, name, center, center_name }
  const [availableGrades, setAvailableGrades] = useState([])

  const load = async () => {
    try {
      const res = await getSubjectGroups()
      setGroups(res.data)
    } catch {
      setError('Failed to load subject groups.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Load centers this teacher is assigned to
  useEffect(() => {
    if (!user?.id) return
    client.get(`/users/${user.id}/centers/`).then(res => {
      setMyCenters(res.data)
      if (res.data.length === 1) {
        setForm(f => ({ ...f, centers: [res.data[0].id] }))
      }
    })
  }, [user?.id])

  // Load grades from teacher's centers (returns grade objects)
  useEffect(() => {
    getGrades().then(res => setAvailableGrades(res.data)).catch(() => {})
  }, [])

  // Filter grades to only those belonging to currently selected centers
  const gradesForSelectedCenters = form.centers.length
    ? availableGrades.filter(g => form.centers.includes(g.center))
    : availableGrades

  const handleCreate = async (e) => {
    e.preventDefault()
    setError('')
    setFormErrors({})
    setSaving(true)
    try {
      await createSubjectGroup(form)
      setForm({ ...EMPTY_FORM, centers: myCenters.length === 1 ? [myCenters[0].id] : [], target_grades: [] })
      setShowForm(false)
      load()
    } catch (err) {
      const data = err.response?.data || {}
      if (typeof data === 'object' && !Array.isArray(data)) {
        setFormErrors(data)
      } else {
        setError(data?.title?.[0] || 'Failed to create subject group.')
      }
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject group? All its lessons will also be deleted.')) return
    setDeletingId(id)
    try {
      await deleteSubjectGroup(id)
      setGroups(g => g.filter(x => x.id !== id))
    } catch {
      setError('Failed to delete.')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <Layout>
      <div className="flex-between page-header">
        <div>
          <h1 className="page-title">{t('teacher.subjectGroups.title')}</h1>
          <p className="page-subtitle">{t('teacher.subjectGroups.subtitle')}</p>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(s => !s)}>
          {showForm ? t('common.cancel') : `+ ${t('teacher.subjectGroups.createGroup')}`}
        </button>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {/* Create form */}
      {showForm && (
        <div className="card mb-16" style={{ marginBottom: 24 }}>
          <div className="card-header">New Subject Group</div>
          <div className="card-body">
            <form onSubmit={handleCreate}>
              <div className="grid-2" style={{ gap: 16 }}>
                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input
                    className="form-control"
                    placeholder="e.g. Quran Recitation Beginners"
                    value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    required
                  />
                  {formErrors.title && <p className="form-hint" style={{ color: 'var(--danger)' }}>{formErrors.title}</p>}
                </div>
                <div className="form-group">
                  <label className="form-label">Subject Track *</label>
                  <select
                    className="form-control"
                    value={form.subject_track}
                    onChange={e => setForm(f => ({ ...f, subject_track: e.target.value }))}
                  >
                    <option value="arabic">{t('teacher.subjectGroups.tracks.arabic')}</option>
                    <option value="quran">{t('teacher.subjectGroups.tracks.quran')}</option>
                    <option value="culture">{t('teacher.subjectGroups.tracks.culture')}</option>
                  </select>
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Centers *</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', padding: '8px 0' }}>
                  {myCenters.map(c => (
                    <label key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={form.centers.includes(c.id)}
                        onChange={e => {
                          const id = c.id
                          setForm(f => ({
                            ...f,
                            centers: e.target.checked
                              ? [...f.centers, id]
                              : f.centers.filter(x => x !== id),
                            // drop grades that no longer belong to selected centers
                            target_grades: e.target.checked
                              ? f.target_grades
                              : f.target_grades.filter(gid =>
                                  availableGrades.some(g => g.id === gid && f.centers.filter(c2 => c2 !== id).includes(g.center))
                                ),
                          }))
                        }}
                      />
                      {c.name}
                    </label>
                  ))}
                </div>
                {formErrors.centers && <p className="form-hint" style={{ color: 'var(--danger)' }}>{formErrors.centers}</p>}
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea
                  className="form-control"
                  rows={2}
                  placeholder="Brief overview of this book or course"
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                />
              </div>
              {gradesForSelectedCenters.length > 0 && (
                <div className="form-group">
                  <label className="form-label">
                    Target Grades{' '}
                    <span style={{ fontWeight: 400, color: 'var(--gray-500)' }}>(optional — leave blank for all students)</span>
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px 24px', padding: '8px 0' }}>
                    {gradesForSelectedCenters.map(grade => (
                      <label key={grade.id} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: 14 }}>
                        <input
                          type="checkbox"
                          checked={form.target_grades.includes(grade.id)}
                          onChange={e => {
                            setForm(f => ({
                              ...f,
                              target_grades: e.target.checked
                                ? [...f.target_grades, grade.id]
                                : f.target_grades.filter(id => id !== grade.id),
                            }))
                          }}
                        />
                        {grade.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <div className="flex-end gap-8">
                <button type="button" className="btn btn-outline" onClick={() => setShowForm(false)}>
                  {t('common.cancel')}
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? <><span className="spinner" /> {t('common.loading')}</> : t('teacher.subjectGroups.createGroup')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Groups grid */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 60 }}>
          <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p className="empty-state-text">
              {t('teacher.subjectGroups.noGroups')}
            </p>
          </div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
          {groups.map(group => (
            <div key={group.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
              <div className="card-body" style={{ flex: 1 }}>
                <div className="flex-between" style={{ marginBottom: 10 }}>
                  <span
                    className="badge"
                    style={TRACK_COLORS[group.subject_track]}
                  >
                    {TRACK_LABELS[group.subject_track]}
                  </span>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                    onClick={() => handleDelete(group.id)}
                    disabled={deletingId === group.id}
                  >
                    {t('common.delete')}
                  </button>
                </div>

                <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--gray-900)', marginBottom: 6 }}>
                  {group.title}
                </h3>
                {group.description && (
                  <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {group.description}
                  </p>
                )}

                <div className="flex gap-12" style={{ fontSize: 12, color: 'var(--gray-500)', marginBottom: 16 }}>
                  <span>📖 {group.lesson_count} lesson{group.lesson_count !== 1 ? 's' : ''}</span>
                  <span>📎 {group.file_count} file{group.file_count !== 1 ? 's' : ''}</span>
                  {group.center_names?.length > 0 && <span>🏢 {group.center_names.join(', ')}</span>}
                  {group.target_grade_details?.length > 0 && (
                    <span>🎓 {group.target_grade_details.map(g => g.name).join(', ')}</span>
                  )}
                </div>

                <button
                  className="btn btn-primary btn-full"
                  onClick={() => navigate(`/teacher/subject-groups/${group.id}`)}
                >
                  Open →
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </Layout>
  )
}
