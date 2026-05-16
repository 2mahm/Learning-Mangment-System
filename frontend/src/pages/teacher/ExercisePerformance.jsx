import { useEffect, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { getExerciseResults, getExerciseStats } from '../../api/exercises'

const TH = {
  padding: '9px 14px', background: 'var(--gray-50)',
  borderBottom: '2px solid var(--gray-200)', textAlign: 'left',
  whiteSpace: 'nowrap', fontSize: 13, fontWeight: 700,
}
const TD = {
  padding: '9px 14px', borderBottom: '1px solid var(--gray-100)',
  verticalAlign: 'middle', fontSize: 14,
}

function ScoreBadge({ r }) {
  if (!r) return <span style={{ color: 'var(--gray-300)', fontSize: 13 }}>—</span>
  const bg    = r.percentage >= 70 ? '#d1fae5' : r.percentage >= 40 ? '#fef3c7' : '#fee2e2'
  const color = r.percentage >= 70 ? '#065f46' : r.percentage >= 40 ? '#92400e' : '#991b1b'
  return (
    <span style={{ padding: '3px 11px', borderRadius: 20, fontWeight: 700,
                   fontSize: 13, background: bg, color }}>
      {r.percentage}%
    </span>
  )
}

function DetailModal({ sectionId, title, onClose }) {
  const [data, setData] = useState(null)

  useEffect(() => {
    getExerciseResults(sectionId).then(res => setData(res.data))
  }, [sectionId])

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.4)',
               zIndex: 1000, display: 'flex', alignItems: 'center',
               justifyContent: 'center', padding: 24 }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{ maxWidth: 560, width: '100%', maxHeight: '80vh', overflow: 'auto' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="card-header"
             style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontWeight: 700 }}>{title}</span>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer',
                     fontSize: 22, color: 'var(--gray-400)', lineHeight: 1 }}
          >×</button>
        </div>
        {!data ? (
          <div style={{ padding: 32, textAlign: 'center' }}>
            <span className="spinner spinner-dark" />
          </div>
        ) : (
          <div style={{ padding: 16 }}>
            <p style={{ fontSize: 13, color: 'var(--gray-500)', marginBottom: 12 }}>
              {data.total_students} student(s) attempted
            </p>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={TH}>Student</th>
                  <th style={TH}>Grade</th>
                  <th style={TH}>Score</th>
                  <th style={TH}>Date</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.filter(s => s.is_latest).map(s => (
                  <tr key={s.id}>
                    <td style={TD}>{s.student_name}</td>
                    <td style={TD}>{s.student_grade}</td>
                    <td style={TD}><ScoreBadge r={s} /></td>
                    <td style={TD}>{new Date(s.submitted_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExercisePerformance() {
  const { state }      = useLocation()
  const lessonId       = state?.lessonId
  const navigate       = useNavigate()
  const { t }          = useTranslation()
  const [data,         setData]     = useState(null)
  const [loading,      setLoading]  = useState(true)
  const [error,        setError]    = useState('')
  const [detailId,     setDetailId] = useState(null)

  useEffect(() => {
    if (!lessonId) { navigate('/teacher/subject-groups', { replace: true }); return }
    getExerciseStats(lessonId)
      .then(res => setData(res.data))
      .catch(err => setError(err.response?.data?.error || 'Failed to load.'))
      .finally(() => setLoading(false))
  }, [lessonId, navigate])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
      <span className="spinner spinner-dark" style={{ width: 36, height: 36 }} />
    </div>
  )

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 28 }}>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <button className="btn btn-outline btn-sm" onClick={() => navigate(-1)}>← {t('common.back')}</button>
        <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--gray-900)', margin: 0 }}>
          {data?.lesson_title || t('teacher.exercisePerformance.title')}
        </h2>
      </div>

      {error && (
        <div style={{ padding: 16, background: '#fee2e2', color: '#991b1b',
                      borderRadius: 10, marginBottom: 20 }}>{error}</div>
      )}

      {data?.exercises.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <p>No exercises in this lesson yet.</p>
        </div>
      ) : data?.students.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: 'var(--gray-400)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📊</div>
          <p>No students have attempted any exercises yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', background: '#fff', borderRadius: 12,
                      border: '1px solid var(--gray-200)',
                      boxShadow: '0 2px 8px rgba(0,0,0,.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={TH}>Student</th>
                <th style={{ ...TH, width: 72 }}>Grade</th>
                {data.exercises.map(ex => (
                  <th
                    key={ex.id}
                    style={{ ...TH, textAlign: 'center', cursor: 'pointer',
                             color: 'var(--primary)', maxWidth: 140 }}
                    title={ex.title}
                    onClick={() => setDetailId(ex.id)}
                  >
                    {ex.title.length > 16 ? ex.title.slice(0, 14) + '…' : ex.title}
                    <div style={{ fontSize: 10, fontWeight: 400, color: 'var(--gray-400)',
                                  marginTop: 2 }}>
                      click for details
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.students.map((s, i) => (
                <tr key={i}>
                  <td style={{ ...TD, fontWeight: 600 }}>{s.name}</td>
                  <td style={{ ...TD, textAlign: 'center', color: 'var(--gray-500)' }}>
                    {s.grade}
                  </td>
                  {s.results.map((r, j) => (
                    <td key={j} style={{ ...TD, textAlign: 'center' }}>
                      <ScoreBadge r={r} />
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {detailId && (
        <DetailModal
          sectionId={detailId}
          title={data.exercises.find(e => e.id === detailId)?.title || 'Exercise Details'}
          onClose={() => setDetailId(null)}
        />
      )}

    </div>
  )
}
