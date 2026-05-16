import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import studentClient from '../../api/studentClient'
import './kiddo-theme.css'
import { TRACK_CONFIG, KiddoIcon, KSpinner } from './kiddo-components'

export default function StudentPortalContent() {
  const navigate = useNavigate()
  const { t } = useTranslation()

  const [student,      setStudent]      = useState(null)
  const [groups,       setGroups]       = useState([])
  const [expanded,     setExpanded]     = useState({})
  const [loading,      setLoading]      = useState(true)
  const [error,        setError]        = useState('')
  const [loadingGroup, setLoadingGroup] = useState(null)

  useEffect(() => {
    const stored = localStorage.getItem('lms_student')
    if (!stored) { navigate('/login', { replace: true }); return }
    setStudent(JSON.parse(stored))

    studentClient.get('/content/published/subject-groups/')
      .then(res => setGroups(res.data))
      .catch(() => setError(t('student.portal.failedLoad')))
      .finally(() => setLoading(false))
  }, [navigate, t])

  const toggleGroup = async (group) => {
    if (expanded[group.id] !== undefined) {
      setExpanded(e => { const n = { ...e }; delete n[group.id]; return n })
      return
    }
    setLoadingGroup(group.id)
    try {
      const res = await studentClient.get(
        `/content/published/subject-groups/${group.id}/lessons/`,
      )
      setExpanded(e => ({ ...e, [group.id]: res.data }))
    } catch {
      setError(t('student.portal.failedLoadLessons'))
    } finally {
      setLoadingGroup(null)
    }
  }

  if (!student) return null

  return (
    <div className="kiddo-wrap">

      {/* Top bar */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 50,
        background: 'var(--k-primary)',
        padding: '12px 16px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: '0 4px 0 var(--k-primary-d)',
      }}>
        <button
          onClick={() => navigate('/student')}
          style={{
            width: 38, height: 38, borderRadius: 12, border: 'none',
            background: 'rgba(255,255,255,.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', flexShrink: 0,
          }}
        >
          <KiddoIcon name="chevronL" size={22} color="#fff" />
        </button>
        <div style={{
          fontFamily: 'var(--k-display-font)', fontSize: 20,
          color: '#fff', fontWeight: 700,
        }}>
          All Subjects
        </div>
      </div>

      {/* Content */}
      <div style={{ padding: '16px 16px 40px' }}>

        {error && (
          <div style={{
            background: '#fee2e2', color: '#991b1b',
            padding: '12px 16px', borderRadius: 16, marginBottom: 14,
            fontWeight: 600, fontSize: 14,
          }}>
            {error}
          </div>
        )}

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
            <KSpinner size={36} />
          </div>
        ) : groups.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 0' }}>
            <div style={{ fontSize: 52, marginBottom: 12 }}>📚</div>
            <div style={{
              fontFamily: 'var(--k-display-font)', color: 'var(--k-ink)',
              fontSize: 18,
            }}>
              No content yet!
            </div>
            <div style={{ color: 'var(--k-ink-soft)', fontSize: 14, marginTop: 6 }}>
              Check back soon.
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {groups.map(g => {
              const tc     = TRACK_CONFIG[g.subject_track] || TRACK_CONFIG.arabic
              const isOpen = expanded[g.id] !== undefined
              const isLoadingThis = loadingGroup === g.id

              return (
                <div key={g.id}>
                  {/* Group card */}
                  <div
                    onClick={() => toggleGroup(g)}
                    style={{
                      background: tc.color,
                      borderRadius: isOpen ? '22px 22px 0 0' : 22,
                      padding: '14px 16px',
                      display: 'flex', alignItems: 'center', gap: 14,
                      cursor: 'pointer',
                      boxShadow: isOpen ? 'none' : '0 6px 0 rgba(0,0,0,.12)',
                      transition: 'border-radius .2s',
                    }}
                  >
                    {/* Emoji icon */}
                    <div style={{
                      width: 50, height: 50, borderRadius: 14,
                      background: 'rgba(255,255,255,.25)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--k-display-font)', fontWeight: 800, fontSize: 22,
                      flexShrink: 0,
                    }}>
                      {tc.emoji}
                    </div>

                    {/* Title */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontFamily: 'var(--k-display-font)', fontSize: 17,
                        color: '#fff', fontWeight: 700,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {g.title}
                      </div>
                      <div style={{ fontSize: 12, color: 'rgba(255,255,255,.8)', marginTop: 2 }}>
                        {g.published_lesson_count} lesson{g.published_lesson_count !== 1 ? 's' : ''}
                        {g.teacher_name && ` · ${g.teacher_name}`}
                      </div>
                    </div>

                    {/* Expand indicator */}
                    {isLoadingThis ? (
                      <div style={{
                        width: 20, height: 20,
                        border: '2px solid rgba(255,255,255,.4)',
                        borderTopColor: '#fff', borderRadius: '50%',
                        animation: 'k-spin 1s linear infinite',
                        flexShrink: 0,
                      }} />
                    ) : (
                      <div style={{
                        width: 32, height: 32, borderRadius: '50%',
                        background: 'rgba(255,255,255,.25)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0,
                        transform: isOpen ? 'rotate(90deg)' : 'none',
                        transition: 'transform .2s',
                      }}>
                        <KiddoIcon name="chevron" size={18} color="#fff" />
                      </div>
                    )}
                  </div>

                  {/* Lessons list */}
                  {isOpen && expanded[g.id] && (
                    <div style={{
                      background: 'var(--k-surface)',
                      borderRadius: '0 0 22px 22px',
                      boxShadow: '0 6px 0 rgba(0,0,0,.08)',
                      overflow: 'hidden',
                    }}>
                      {expanded[g.id].length === 0 ? (
                        <div style={{
                          padding: '20px 16px',
                          textAlign: 'center', color: 'var(--k-ink-soft)',
                          fontFamily: 'var(--k-display-font)', fontSize: 14,
                        }}>
                          No lessons yet.
                        </div>
                      ) : (
                        expanded[g.id].map((lesson, idx) => (
                          <div
                            key={lesson.id}
                            onClick={() => navigate('/student/lesson', { state: { lessonId: lesson.id } })}
                            style={{
                              display: 'flex', alignItems: 'center', gap: 12,
                              padding: '14px 16px',
                              borderBottom: idx < expanded[g.id].length - 1
                                ? '1px solid rgba(0,0,0,.06)' : 'none',
                              cursor: 'pointer',
                            }}
                          >
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: tc.color,
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              color: '#fff', fontWeight: 800, fontSize: 14,
                              flexShrink: 0,
                            }}>
                              {idx + 1}
                            </div>
                            <span style={{
                              fontFamily: 'var(--k-display-font)', fontSize: 15,
                              color: 'var(--k-ink)', flex: 1, lineHeight: 1.3,
                            }}>
                              {lesson.title}
                            </span>
                            <KiddoIcon name="chevron" size={18} color="var(--k-ink-soft)" />
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
