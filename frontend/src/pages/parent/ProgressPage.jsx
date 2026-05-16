import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { PageHeader, StatCard } from '../../components/NurUI'
import { getStudentProgress } from '../../api/content'
import client from '../../api/client'

const TRACK_COLOR = {
  quran:   'var(--emerald)',
  arabic:  'var(--teal)',
  culture: 'var(--violet)',
}

function ScoreBadge({ score }) {
  const { t } = useTranslation()
  if (score === null || score === undefined) {
    return <span style={{ fontSize: 12, color: 'var(--gray-400)' }}>{t('parent.progress.noAttempts')}</span>
  }
  const color = score >= 70 ? 'var(--emerald)' : score >= 50 ? 'var(--amber)' : 'var(--rose)'
  return (
    <span style={{
      display: 'inline-block', padding: '2px 9px', borderRadius: 10,
      fontSize: 12, fontWeight: 600,
      background: `${color}20`, color,
    }}>
      {score}%
    </span>
  )
}

function ProgressBar({ pct, color }) {
  return (
    <div style={{ height: 7, background: 'var(--gray-100)', borderRadius: 4, overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${Math.min(pct, 100)}%`,
        background: color || (pct >= 70 ? 'var(--emerald)' : pct >= 40 ? 'var(--amber)' : 'var(--rose)'),
        borderRadius: 4, transition: 'width 0.5s',
      }} />
    </div>
  )
}

function GroupAccordion({ group }) {
  const [open, setOpen] = useState(false)
  const color = TRACK_COLOR[group.subject_track] || 'var(--primary)'

  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden', marginBottom: 10 }}>
      {/* Header row */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '14px 18px', cursor: 'pointer',
        }}
      >
        <div style={{
          width: 10, height: 10, borderRadius: '50%',
          background: color, flexShrink: 0,
        }} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)', marginBottom: 4 }}>
            {group.title}
          </div>
          <ProgressBar pct={group.completion_pct} color={color} />
        </div>
        <div style={{ textAlign: 'right', marginRight: 8 }}>
          <div style={{ fontSize: 18, fontWeight: 700, color }}>
            {group.completion_pct}%
          </div>
          <div style={{ fontSize: 11, color: 'var(--ink-soft)' }}>
            {group.lessons_completed}/{group.lessons_total} lessons
          </div>
        </div>
        {group.avg_score !== null && (
          <ScoreBadge score={group.avg_score} />
        )}
        <div style={{ color: 'var(--ink-soft)', fontSize: 16, lineHeight: 1, marginLeft: 4 }}>
          {open ? '▲' : '▼'}
        </div>
      </div>

      {/* Lesson rows */}
      {open && (
        <div style={{ borderTop: '1px solid var(--gray-100)' }}>
          {group.lessons.map((lesson, idx) => (
            <div
              key={lesson.id}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 18px 10px 28px',
                borderBottom: idx < group.lessons.length - 1 ? '1px solid var(--gray-100)' : 'none',
                background: '#fff',
              }}
            >
              {/* Completion indicator */}
              {!lesson.has_exercises ? (
                <div style={{ width: 18, height: 18, flexShrink: 0 }} />
              ) : lesson.completed ? (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  background: 'var(--emerald)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, flexShrink: 0,
                }}>✓</div>
              ) : (
                <div style={{
                  width: 18, height: 18, borderRadius: '50%',
                  border: '2px solid var(--gray-200)', flexShrink: 0,
                }} />
              )}
              <div style={{ flex: 1, fontSize: 13, color: 'var(--ink)' }}>
                {lesson.title}
              </div>
              {lesson.has_exercises ? (
                <ScoreBadge score={lesson.score} />
              ) : (
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>No exercises</span>
              )}
              {lesson.submitted_at && (
                <span style={{ fontSize: 11, color: 'var(--gray-400)' }}>
                  {new Date(lesson.submitted_at).toLocaleDateString()}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function ProgressPage() {
  const { t } = useTranslation()
  const [students,       setStudents]       = useState([])
  const [selectedId,     setSelectedId]     = useState(null)
  const [progress,       setProgress]       = useState(null)
  const [loadingStudents, setLoadingStudents] = useState(true)
  const [loadingProgress, setLoadingProgress] = useState(false)
  const [error,          setError]          = useState('')

  // Load parent's students
  useEffect(() => {
    client.get('/students/')
      .then(res => {
        setStudents(res.data)
        if (res.data.length > 0) setSelectedId(res.data[0].id)
      })
      .catch(() => setError('Failed to load students.'))
      .finally(() => setLoadingStudents(false))
  }, [])

  // Load progress when selected student changes
  useEffect(() => {
    if (!selectedId) return
    setLoadingProgress(true)
    setProgress(null)
    getStudentProgress(selectedId)
      .then(res => setProgress(res.data))
      .catch(() => setError('Failed to load progress data.'))
      .finally(() => setLoadingProgress(false))
  }, [selectedId])

  const p = progress

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      <PageHeader title={t('parent.progress.title')} subtitle={t('parent.progress.subtitle')} />

      {loadingStudents && <div className="spinner" />}
      {error && <div className="alert alert-error">{error}</div>}

      {!loadingStudents && students.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--ink-soft)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📚</div>
          <div>No students added yet.</div>
        </div>
      )}

      {students.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
          {students.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              style={{
                padding: '7px 18px', borderRadius: 20, fontSize: 13, fontWeight: 500,
                border: '1px solid',
                borderColor: selectedId === s.id ? 'var(--primary)' : 'var(--gray-200)',
                background: selectedId === s.id ? 'var(--primary)' : 'transparent',
                color: selectedId === s.id ? '#fff' : 'var(--ink-soft)',
                cursor: 'pointer',
              }}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      {loadingProgress && <div className="spinner" />}

      {p && (
        <>
          {/* Overall stats */}
          <div className="stats-row" style={{ marginBottom: 28 }}>
            <StatCard
              icon="book"
              value={`${p.overall.lessons_completed}/${p.overall.lessons_total}`}
              label="Lessons Completed"
              tone="primary"
            />
            <StatCard
              icon="check"
              value={`${p.overall.completion_pct}%`}
              label="Completion Rate"
              tone={p.overall.completion_pct >= 70 ? 'emerald' : p.overall.completion_pct >= 40 ? 'amber' : 'rose'}
            />
            <StatCard
              icon="star"
              value={p.overall.avg_score !== null ? `${p.overall.avg_score}%` : '—'}
              label="Avg Score"
              tone={
                p.overall.avg_score === null ? 'primary'
                : p.overall.avg_score >= 70 ? 'emerald'
                : p.overall.avg_score >= 50 ? 'amber' : 'rose'
              }
            />
            <StatCard
              icon="academic"
              value={p.subject_groups.length}
              label="Active Subjects"
              tone="teal"
            />
          </div>

          {/* Overall progress bar */}
          <div style={{ marginBottom: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 13 }}>
              <span style={{ fontWeight: 500, color: 'var(--ink)' }}>Overall Progress</span>
              <span style={{ color: 'var(--ink-soft)' }}>{p.overall.completion_pct}%</span>
            </div>
            <ProgressBar pct={p.overall.completion_pct} />
          </div>

          {/* Subject group accordions */}
          {p.subject_groups.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ink-soft)' }}>
              No published lessons available yet.
            </div>
          ) : (
            p.subject_groups.map(group => (
              <GroupAccordion key={group.id} group={group} />
            ))
          )}
        </>
      )}
    </div>
  )
}
