import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from '../../components/Layout'
import { getParentPerformance } from '../../api/content'

const TYPE_LABELS = {
  radio: 'Multiple Choice',
  checkbox: 'Multiple Select',
  dropdown: 'Dropdown',
  text: 'Short Answer',
  matching: 'Matching',
}

function ScoreBadge({ percentage }) {
  const color =
    percentage >= 80 ? { bg: '#E1F5EE', text: '#085041', border: '#1D9E75' } :
    percentage >= 50 ? { bg: '#FFF7E6', text: '#7A4A00', border: '#F59E0B' } :
                       { bg: '#FFF0F0', text: '#7A1010', border: '#E53E3E' }
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 20, fontSize: 13,
      fontWeight: 700, border: `1.5px solid ${color.border}`,
      background: color.bg, color: color.text,
    }}>
      {percentage}%
    </span>
  )
}

function QuestionDetail({ q }) {
  const { t } = useTranslation()
  const isCorrect = q.is_correct
  const borderColor = isCorrect ? '#1D9E75' : '#E53E3E'
  const bgColor     = isCorrect ? '#F0FFF4' : '#FFF5F5'

  const renderAnswer = (val) => {
    if (!val && val !== 0) return <em style={{ color: 'var(--gray-400)' }}>no answer</em>
    if (typeof val === 'object') return JSON.stringify(val)
    return String(val)
  }

  return (
    <div style={{
      borderRadius: 8, border: `1px solid ${borderColor}`,
      background: bgColor, padding: '10px 14px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-800)', flex: 1 }}>
          {q.text}
        </span>
        <span style={{ fontSize: 12, color: isCorrect ? '#085041' : '#7A1010', fontWeight: 700, flexShrink: 0 }}>
          {isCorrect ? `✓ ${t('parent.performance.correct')}` : `✗ ${t('parent.performance.incorrect')}`}
        </span>
      </div>

      {q.type === 'matching' ? (
        <div style={{ marginTop: 6, fontSize: 13 }}>
          <span style={{ color: 'var(--gray-500)' }}>Score: </span>
          <strong>{q.correct_count ?? 0} / {(q.pairs ?? []).length}</strong> pairs correct
        </div>
      ) : (
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 13 }}>
            <span style={{ color: 'var(--gray-500)' }}>{t('parent.performance.yourAnswer')}: </span>
            <strong style={{ color: isCorrect ? '#085041' : '#7A1010' }}>{renderAnswer(q.student_answer)}</strong>
          </div>
          {!isCorrect && (
            <div style={{ fontSize: 13 }}>
              <span style={{ color: 'var(--gray-500)' }}>{t('parent.performance.correctAnswer')}: </span>
              <strong style={{ color: '#085041' }}>{renderAnswer(q.correct_answer)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function SubmissionCard({ sub }) {
  const [open, setOpen] = useState(false)

  return (
    <div style={{
      border: '1px solid var(--gray-200)', borderRadius: 10,
      marginBottom: 10, overflow: 'hidden',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '12px 16px', cursor: 'pointer',
          background: open ? 'var(--gray-50)' : '#fff',
          userSelect: 'none',
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--gray-900)',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sub.lesson_title}
            {sub.section_title && (
              <span style={{ fontWeight: 400, color: 'var(--gray-500)', marginLeft: 6 }}>
                — {sub.section_title}
              </span>
            )}
          </div>
          <div style={{ fontSize: 12, color: 'var(--gray-400)', marginTop: 2 }}>
            {sub.subject_group_title} &nbsp;·&nbsp;
            {new Date(sub.submitted_at).toLocaleDateString()}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-600)' }}>
            {sub.score}/{sub.total}
          </span>
          <ScoreBadge percentage={sub.percentage} />
          <span style={{ fontSize: 16, color: 'var(--gray-400)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '0 16px 14px', borderTop: '1px solid var(--gray-100)' }}>
          {sub.details && sub.details.length > 0 ? (
            <>
              <p style={{ fontSize: 12, color: 'var(--gray-400)', margin: '10px 0 8px' }}>
                Per-question breakdown
              </p>
              {sub.details.map((q, i) => (
                <QuestionDetail key={q.id ?? i} q={q} />
              ))}
            </>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--gray-400)', paddingTop: 10 }}>No details available.</p>
          )}
        </div>
      )}
    </div>
  )
}

function StudentPanel({ student }) {
  const [open, setOpen] = useState(true)

  return (
    <div style={{
      background: '#fff', borderRadius: 14, border: '1px solid var(--gray-200)',
      marginBottom: 20, overflow: 'hidden',
      boxShadow: '0 2px 8px rgba(0,0,0,.05)',
    }}>
      <div
        onClick={() => setOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 14,
          padding: '16px 20px', cursor: 'pointer', userSelect: 'none',
          background: 'var(--gray-50)',
        }}
      >
        <div style={{
          width: 40, height: 40, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 700, fontSize: 16, flexShrink: 0,
        }}>
          {student.name.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 16, color: 'var(--gray-900)' }}>{student.name}</div>
          {student.grade_name && (
            <div style={{ fontSize: 13, color: 'var(--gray-500)', marginTop: 2 }}>{student.grade_name}</div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <span style={{ fontSize: 13, color: 'var(--gray-500)' }}>
            {student.submissions.length} submission{student.submissions.length !== 1 ? 's' : ''}
          </span>
          <span style={{ fontSize: 18, color: 'var(--gray-400)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>›</span>
        </div>
      </div>

      {open && (
        <div style={{ padding: '16px 20px' }}>
          {student.submissions.length === 0 ? (
            <p style={{ color: 'var(--gray-400)', fontSize: 14, textAlign: 'center', padding: '16px 0' }}>
              No exercises submitted yet.
            </p>
          ) : (
            student.submissions.map(sub => (
              <SubmissionCard key={sub.id} sub={sub} />
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default function ParentPerformance() {
  const { t } = useTranslation()
  const [students, setStudents] = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState('')

  useEffect(() => {
    getParentPerformance()
      .then(res => setStudents(res.data))
      .catch(() => setError('Failed to load performance data.'))
      .finally(() => setLoading(false))
  }, [])

  return (
    <Layout>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '32px 24px' }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--gray-900)', marginBottom: 4 }}>
          {t('parent.performance.title')}
        </h1>
        <p style={{ color: 'var(--gray-500)', fontSize: 14, marginBottom: 28 }}>
          {t('parent.performance.subtitle')}
        </p>

        {loading && (
          <div style={{ textAlign: 'center', padding: 48 }}>
            <span className="spinner spinner-dark" style={{ width: 32, height: 32 }} />
          </div>
        )}

        {error && (
          <div className="alert alert-error">{error}</div>
        )}

        {!loading && !error && students.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--gray-400)', fontSize: 15 }}>
            No students found. Add a student from the My Students page.
          </div>
        )}

        {students.map(student => (
          <StudentPanel key={student.id} student={student} />
        ))}
      </div>
    </Layout>
  )
}
