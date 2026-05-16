import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import { getPublishedLessons, getPublishedSubjectGroups } from '../../api/content'

const TRACK_LABELS = { arabic: 'Arabic', quran: 'Quran', culture: 'Culture' }
const TRACK_COLORS = {
  arabic:  { background: 'var(--primary-light)', color: 'var(--primary-dark)' },
  quran:   { background: 'var(--success-light)', color: '#065f46' },
  culture: { background: '#ede9fe',              color: '#5b21b6' },
}
const TRACKS = ['arabic', 'quran', 'culture']

export default function StudentContent() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [groups,      setGroups]      = useState([])
  const [expanded,    setExpanded]    = useState({})   // groupId → lessons[] | null
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState('')
  const [loadingGroup, setLoadingGroup] = useState(null)

  useEffect(() => {
    getPublishedSubjectGroups()
      .then(res => setGroups(res.data))
      .catch(() => setError(t('student.portal.failedLoad')))
      .finally(() => setLoading(false))
  }, [t])

  const toggleGroup = async (group) => {
    if (expanded[group.id] !== undefined) {
      // collapse
      setExpanded(e => { const n = { ...e }; delete n[group.id]; return n })
      return
    }
    setLoadingGroup(group.id)
    try {
      const res = await getPublishedLessons(group.id)
      setExpanded(e => ({ ...e, [group.id]: res.data }))
    } catch {
      setError(t('student.portal.failedLoadLessons'))
    } finally {
      setLoadingGroup(null)
    }
  }

  const byTrack = TRACKS.reduce((acc, t) => {
    acc[t] = groups.filter(g => g.subject_track === t)
    return acc
  }, {})

  return (
    <Layout>
      <div className="page-header">
        <h1 className="page-title">Content Library</h1>
        <p className="page-subtitle">
          Browse your lessons by subject. Click a group to see its lessons.
        </p>
      </div>

      {error && <div className="alert alert-error mb-16">{error}</div>}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 80 }}>
          <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
        </div>
      ) : groups.length === 0 ? (
        <div className="card">
          <div className="empty-state">
            <div className="empty-state-icon">📚</div>
            <p className="empty-state-text">No published content available yet.</p>
          </div>
        </div>
      ) : (
        TRACKS.map(track => {
          const trackGroups = byTrack[track]
          if (!trackGroups.length) return null
          return (
            <div key={track} style={{ marginBottom: 32 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
                <span className="badge" style={TRACK_COLORS[track]}>
                  {TRACK_LABELS[track]}
                </span>
                <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
                  {trackGroups.length} group{trackGroups.length !== 1 ? 's' : ''}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {trackGroups.map(group => (
                  <div key={group.id} className="card">
                    {/* Group header */}
                    <div
                      style={{
                        display: 'flex', alignItems: 'center', gap: 12,
                        padding: '14px 20px', cursor: 'pointer',
                        borderBottom: expanded[group.id] ? '1px solid var(--gray-200)' : 'none',
                      }}
                      onClick={() => toggleGroup(group)}
                    >
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--gray-900)' }}>
                          {group.title}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--gray-500)', marginTop: 2 }}>
                          by {group.teacher_name} &nbsp;·&nbsp;
                          {group.published_lesson_count} lesson{group.published_lesson_count !== 1 ? 's' : ''}
                        </div>
                      </div>

                      {loadingGroup === group.id
                        ? <span className="spinner spinner-dark" />
                        : <span style={{ color: 'var(--gray-400)', fontSize: 18 }}>
                            {expanded[group.id] !== undefined ? '▲' : '▼'}
                          </span>
                      }
                    </div>

                    {/* Lessons list */}
                    {expanded[group.id] && (
                      <div>
                        {expanded[group.id].length === 0 ? (
                          <div style={{ padding: '16px 20px', color: 'var(--gray-500)', fontSize: 13 }}>
                            No published lessons yet.
                          </div>
                        ) : (
                          expanded[group.id].map((lesson, idx) => (
                            <div
                              key={lesson.id}
                              style={{
                                display: 'flex', alignItems: 'center', gap: 12,
                                padding: '12px 20px',
                                borderBottom: idx < expanded[group.id].length - 1
                                  ? '1px solid var(--gray-100)' : 'none',
                                cursor: 'pointer',
                              }}
                              onClick={() => navigate(`/content/lessons/${lesson.id}`)}
                            >
                              <span style={{
                                width: 24, height: 24, borderRadius: '50%',
                                background: 'var(--primary-light)', color: 'var(--primary-dark)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                                fontSize: 11, fontWeight: 700, flexShrink: 0,
                              }}>
                                {idx + 1}
                              </span>
                              <span style={{ fontWeight: 500, fontSize: 14, flex: 1 }}>
                                {lesson.title}
                              </span>
                              <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>Open →</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })
      )}
    </Layout>
  )
}
