import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { getPublishedLesson } from '../../api/content'
import { submitExercise, getMyResult } from '../../api/exercises'

// ── Exercise viewer ────────────────────────────────────────────────────────────

function ExerciseViewer({ section }) {
  const contentBody = section.content_body
  const sectionId   = section.id

  const [answers,   setAnswers]   = useState({})
  const [result,    setResult]    = useState(null)
  const [loading,   setLoading]   = useState(true)
  const [submitting,setSubmitting]= useState(false)
  const [error,     setError]     = useState('')

  const questions = contentBody?.questions || []

  // Check if student already attempted this exercise
  useEffect(() => {
    setLoading(true)
    getMyResult(sectionId)
      .then(res => {
        if (res.data.attempted) setResult(res.data)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [sectionId])

  const setAnswer = (qId, value) => {
    setAnswers(prev => ({ ...prev, [qId]: value }))
  }

  const setMatchingAnswer = (qId, pairId, value) => {
    setAnswers(prev => ({
      ...prev,
      [qId]: { ...(prev[qId] || {}), [pairId]: value },
    }))
  }

  const handleSubmit = async () => {
    setError('')
    setSubmitting(true)
    try {
      const res = await submitExercise(sectionId, answers)
      setResult(res.data)
    } catch {
      setError('Submission failed. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRetry = () => {
    setResult(null)
    setAnswers({})
    setError('')
  }

  if (loading) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <span className="spinner spinner-dark" style={{ width: 28, height: 28 }} />
      </div>
    )
  }

  const detailMap = result
    ? Object.fromEntries((result.details || []).map(d => [d.id, d]))
    : {}

  const pct   = result ? (result.percentage ?? Math.round((result.score / result.total) * 100)) : null
  const color = pct != null ? (pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626') : null
  const bg    = pct != null ? (pct >= 70 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2') : null

  return (
    <div style={{
      border: '1px solid var(--gray-200)', borderRadius: 14,
      padding: '24px', background: '#fff',
    }}>
      {result && (
        <div style={{ textAlign: 'center', padding: '16px', background: bg, color, borderRadius: 10, marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>
            {pct >= 70 ? '🌟' : pct >= 40 ? '👍' : '📚'}
          </div>
          <div style={{ fontSize: 26, fontWeight: 800 }}>{result.score} / {result.total}</div>
          <div style={{ fontSize: 15, fontWeight: 600, marginTop: 2 }}>{pct}%</div>
        </div>
      )}

      {contentBody?.title && (
        <h3 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 700, color: 'var(--gray-900)' }}>
          {contentBody.title}
        </h3>
      )}
      {contentBody?.description && (
        <p style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--gray-500)' }}>
          {contentBody.description}
        </p>
      )}

      {questions.map((q, idx) => (
        <QuestionView
          key={q.id}
          question={q}
          index={idx}
          answer={answers[q.id]}
          onAnswer={val => setAnswer(q.id, val)}
          onMatchingAnswer={(pairId, val) => setMatchingAnswer(q.id, pairId, val)}
          detail={detailMap[q.id]}
          readonly={!!result}
        />
      ))}

      {error && (
        <div style={{ padding: '8px 12px', background: '#fee2e2', color: '#991b1b',
                      borderRadius: 8, fontSize: 13, marginBottom: 12 }}>
          {error}
        </div>
      )}

      {!result && (
        <button
          className="btn btn-primary"
          style={{ marginTop: 8, width: '100%', padding: '12px' }}
          onClick={handleSubmit}
          disabled={submitting}
        >
          {submitting
            ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Submitting…</>
            : 'Submit Answers'}
        </button>
      )}

      {result && (
        <button
          className="btn btn-outline"
          style={{ marginTop: 8, width: '100%' }}
          onClick={handleRetry}
        >
          Try Again
        </button>
      )}
    </div>
  )
}

// ── Single question renderer ───────────────────────────────────────────────────

function QuestionView({ question: q, index, answer, onAnswer, onMatchingAnswer, detail, readonly }) {
  const correct = detail?.is_correct
  const resultBorder = correct === true ? '#a7f3d0' : correct === false ? '#fca5a5' : 'var(--gray-100)'
  const resultBg     = correct === true ? '#f0fdf4' : correct === false ? '#fff5f5' : 'transparent'

  return (
    <div style={{
      marginBottom: 16, padding: '16px',
      borderRadius: 12,
      border: `1.5px solid ${detail ? resultBorder : 'var(--gray-100)'}`,
      background: detail ? resultBg : 'transparent',
    }}>
      {/* Question header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
        <p style={{ margin: '0 0 10px', fontWeight: 600, fontSize: 15, color: 'var(--gray-900)', flex: 1 }}>
          <span style={{ color: 'var(--primary)', marginRight: 6 }}>{index + 1}.</span>
          {q.text}
        </p>
        {detail && (
          <span style={{ fontSize: 20, flexShrink: 0 }}>
            {correct === true ? '✅' : correct === false ? '❌' : '—'}
          </span>
        )}
      </div>

      {/* Hint — always visible while solving */}
      {!detail && q.hint && (
        <div style={{
          padding: '8px 14px', background: '#fefce8',
          border: '1px solid #fde68a', borderRadius: 8,
          fontSize: 13, color: '#92400e', marginBottom: 10,
        }}>
          💡 {q.hint}
        </div>
      )}

      {/* Image */}
      {q.image && (
        <img
          src={q.image}
          alt="question"
          style={{ maxWidth: '100%', maxHeight: 200, borderRadius: 8, marginBottom: 10,
                   objectFit: 'contain', border: '1px solid var(--gray-200)' }}
        />
      )}

      {/* Answer input by type */}
      {q.type === 'multiple_choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, opacity: readonly ? 0.85 : 1 }}>
          {(q.choices || []).map((choice, ci) => {
            const isSelected = answer === choice
            const isCorrectChoice = detail && detail.correct_answer === choice
            const isWrongSelected = detail && isSelected && !correct
            const choiceColor =
              isCorrectChoice ? '#059669' :
              isWrongSelected ? '#dc2626' :
              isSelected ? 'var(--primary, #7c3aed)' : 'var(--gray-200)'
            const choiceBg =
              isCorrectChoice ? '#f0fdf4' :
              isWrongSelected ? '#fff5f5' :
              isSelected ? 'var(--primary-light, #ede9fe)' : '#fff'
            return (
              <label
                key={ci}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 14px', borderRadius: 10,
                  cursor: readonly ? 'default' : 'pointer',
                  border: `2px solid ${choiceColor}`,
                  background: choiceBg,
                  transition: 'all .15s',
                }}
              >
                <input
                  type="radio"
                  name={q.id}
                  value={choice}
                  checked={isSelected}
                  onChange={() => !readonly && onAnswer(choice)}
                  style={{ display: 'none' }}
                  disabled={readonly}
                />
                <span style={{
                  width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
                  border: `2px solid ${choiceColor}`,
                  background: isSelected ? choiceColor : 'transparent',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  {isSelected && <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#fff' }} />}
                </span>
                <span style={{ fontSize: 14, color: 'var(--gray-800)', flex: 1 }}>{choice}</span>
                {isCorrectChoice && <span style={{ fontSize: 13, color: '#059669', fontWeight: 600 }}>✓ Correct</span>}
              </label>
            )
          })}
        </div>
      )}

      {q.type === 'true_false' && (
        <div style={{ display: 'flex', gap: 12 }}>
          {['true', 'false'].map(val => {
            const isSelected = answer === val
            const isCorrectVal = detail && detail.correct_answer === val
            const isWrongSelected = detail && isSelected && !correct
            const btnColor =
              isCorrectVal ? '#059669' :
              isWrongSelected ? '#dc2626' :
              isSelected ? 'var(--primary, #7c3aed)' : 'var(--gray-200)'
            const btnBg =
              isCorrectVal ? '#f0fdf4' :
              isWrongSelected ? '#fff5f5' :
              isSelected ? 'var(--primary-light, #ede9fe)' : '#fff'
            return (
              <button
                key={val}
                type="button"
                onClick={() => !readonly && onAnswer(val)}
                disabled={readonly}
                style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontWeight: 600, fontSize: 14,
                  border: `2px solid ${btnColor}`,
                  background: btnBg,
                  color: btnColor,
                  cursor: readonly ? 'default' : 'pointer',
                  transition: 'all .15s',
                }}
              >
                {val === 'true' ? '✓ True' : '✗ False'}
                {isCorrectVal && detail && <span style={{ marginLeft: 6, fontSize: 12 }}>✓</span>}
              </button>
            )
          })}
        </div>
      )}

      {q.type === 'text' && (
        <input
          className="form-control"
          value={answer || ''}
          onChange={e => !readonly && onAnswer(e.target.value)}
          readOnly={readonly}
          placeholder="Type your answer…"
          style={detail && !correct ? { borderColor: '#fca5a5', background: '#fff5f5' } : {}}
        />
      )}

      {q.type === 'matching' && (
        <MatchingInput
          lefts={(q.pairs || []).map(p => ({ id: p.id, text: p.left }))}
          options={(q.pairs || []).map(p => p.right)}
          answer={answer || {}}
          onAnswer={(pairId, val) => !readonly && onMatchingAnswer(pairId, val)}
        />
      )}

      {/* Inline result feedback */}
      {detail && (
        <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--gray-100)' }}>
          {detail.type === 'matching' ? (
            <MatchingResult detail={detail} />
          ) : (
            <>
              {correct === false && detail.correct_answer != null && typeof detail.correct_answer !== 'object' && (
                <p style={{ margin: '0 0 4px', fontSize: 13, color: '#059669' }}>
                  Correct answer: <strong>{detail.correct_answer}</strong>
                </p>
              )}
            </>
          )}
          {q.hint && (
            <div style={{
              marginTop: 6, padding: '7px 12px', background: '#fefce8',
              border: '1px solid #fde68a', borderRadius: 8,
              fontSize: 13, color: '#92400e',
            }}>
              💡 {q.hint}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Matching input ─────────────────────────────────────────────────────────────

function MatchingInput({ lefts, options, answer, onAnswer }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {lefts.map(item => (
        <div
          key={item.id}
          style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', gap: 12,
          }}
        >
          <div style={{
            padding: '10px 14px', borderRadius: 10,
            background: 'var(--gray-50)', border: '1px solid var(--gray-200)',
            fontSize: 14, fontWeight: 600, color: 'var(--gray-800)',
          }}>
            {item.text}
          </div>
          <span style={{ color: 'var(--gray-400)', fontSize: 18 }}>→</span>
          <select
            className="form-control"
            value={answer[item.id] || ''}
            onChange={e => onAnswer(item.id, e.target.value)}
            style={{ cursor: 'pointer' }}
          >
            <option value="">— choose —</option>
            {options.map((opt, i) => (
              <option key={i} value={opt}>{opt}</option>
            ))}
          </select>
        </div>
      ))}
    </div>
  )
}

// ── Results view ──────────────────────────────────────────────────────────────

function ResultView({ result, questions, onRetry }) {
  const pct = result.percentage ?? Math.round((result.score / result.total) * 100)
  const color = pct >= 70 ? '#059669' : pct >= 40 ? '#d97706' : '#dc2626'
  const bg    = pct >= 70 ? '#d1fae5' : pct >= 40 ? '#fef3c7' : '#fee2e2'

  return (
    <div style={{ border: '1px solid var(--gray-200)', borderRadius: 14, overflow: 'hidden' }}>

      {/* Score banner */}
      <div style={{
        padding: '24px', textAlign: 'center',
        background: bg, color,
      }}>
        <div style={{ fontSize: 40, marginBottom: 6 }}>
          {pct >= 70 ? '🌟' : pct >= 40 ? '👍' : '📚'}
        </div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>{result.score} / {result.total}</div>
        <div style={{ fontSize: 16, fontWeight: 600, marginTop: 2 }}>{pct}%</div>
      </div>

      {/* Per-question breakdown */}
      {result.details?.length > 0 && (
        <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {result.details.map((d, i) => (
            <QuestionResult key={d.id} detail={d} index={i} />
          ))}
        </div>
      )}

      <div style={{ padding: '0 20px 20px' }}>
        <button
          className="btn btn-outline"
          style={{ width: '100%' }}
          onClick={onRetry}
        >
          Try Again
        </button>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

// Prevent "Objects are not valid as React child" when student_answer is a dict
// (matching questions) that somehow reaches the non-matching render branch.
function safeAnswer(val) {
  if (val == null || typeof val === 'object') return '(no answer)'
  return String(val) || '(no answer)'
}

// ── Per-question result row ────────────────────────────────────────────────────

function QuestionResult({ detail, index }) {
  const correct = detail.is_correct === true
  const neutral = detail.is_correct === null

  return (
    <div style={{
      padding: '12px 14px', borderRadius: 10,
      border: `1px solid ${neutral ? 'var(--gray-200)' : correct ? '#a7f3d0' : '#fca5a5'}`,
      background: neutral ? 'var(--gray-50)' : correct ? '#f0fdf4' : '#fff5f5',
    }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 16, flexShrink: 0 }}>
          {neutral ? '—' : correct ? '✅' : '❌'}
        </span>
        <div style={{ flex: 1 }}>
          <p style={{ margin: '0 0 4px', fontSize: 14, fontWeight: 600, color: 'var(--gray-900)' }}>
            {index + 1}. {detail.text}
          </p>

          {detail.type === 'matching' ? (
            <MatchingResult detail={detail} />
          ) : (
            <>
              <p style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--gray-600)' }}>
                Your answer: <strong>{safeAnswer(detail.student_answer)}</strong>
              </p>
              {!correct && detail.correct_answer != null && typeof detail.correct_answer !== 'object' && (
                <p style={{ margin: '2px 0 0', fontSize: 13, color: '#059669' }}>
                  Correct answer: <strong>{detail.correct_answer}</strong>
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function MatchingResult({ detail }) {
  const pairs         = detail.pairs || []
  const studentMap    = detail.student_answer || {}
  const correctMap    = detail.correct_answer || {}

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
      {pairs.map(pair => {
        const studentVal = studentMap[pair.id] || '(no answer)'
        const isRight    = studentVal === correctMap[pair.id]
        return (
          <div key={pair.id} style={{ fontSize: 13, display: 'flex', gap: 6, alignItems: 'center' }}>
            <span>{isRight ? '✅' : '❌'}</span>
            <strong>{pair.left}</strong>
            <span style={{ color: 'var(--gray-400)' }}>→</span>
            <span style={{ color: isRight ? '#059669' : '#dc2626' }}>{studentVal}</span>
            {!isRight && (
              <span style={{ color: '#059669', marginLeft: 4 }}>
                (should be: <strong>{correctMap[pair.id]}</strong>)
              </span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ── Recursive section renderer ────────────────────────────────────────────────

function SectionView({ section }) {
  const headingStyle = {
    0: { fontSize: 24, fontWeight: 800, lineHeight: 1.3 },
    1: { fontSize: 20, fontWeight: 700, lineHeight: 1.3 },
    2: { fontSize: 16, fontWeight: 700, lineHeight: 1.4 },
  }[Math.min(section.depth, 2)]

  return (
    <div style={{ marginBottom: 28 }}>
      {section.title && (
        <div style={{
          ...headingStyle,
          color: 'var(--gray-900)',
          marginBottom: section.type === 'title' ? 4 : 12,
        }}>
          {section.title}
        </div>
      )}

      {section.type === 'content' && section.content_body?.html && (
        <div
          className="lesson-prose"
          style={{ fontSize: 16, lineHeight: 1.8 }}
          dangerouslySetInnerHTML={{ __html: section.content_body.html }}
        />
      )}

      {section.type === 'exercise' && section.content_body && (
        <ExerciseViewer key={section.id} section={section} />
      )}

      {section.children?.map(child => (
        <SectionView key={child.id} section={child} />
      ))}
    </div>
  )
}

// ── Nav button ────────────────────────────────────────────────────────────────

function NavBtn({ onClick, disabled, children, primary }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 28px', borderRadius: 14,
        fontSize: 16, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer',
        border: 'none', transition: 'opacity .15s, transform .1s',
        background: disabled
          ? 'var(--gray-100)'
          : primary ? 'var(--primary)' : 'var(--gray-150, #e5e7eb)',
        color: disabled ? 'var(--gray-300)' : primary ? '#fff' : 'var(--gray-800)',
        boxShadow: disabled ? 'none' : primary ? '0 4px 14px rgba(0,0,0,.15)' : '0 2px 6px rgba(0,0,0,.08)',
        opacity: disabled ? .5 : 1,
      }}
    >
      {children}
    </button>
  )
}

// ── Progress dots ─────────────────────────────────────────────────────────────

function ProgressDots({ flat, idx, goTo }) {
  if (flat.length <= 1) return null

  if (flat.length <= 12) {
    return (
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {flat.map((s, i) => (
          <div
            key={s.id}
            onClick={() => goTo(s.id)}
            title={s.title || `Part ${i + 1}`}
            style={{
              width:  i === idx ? 16 : 10,
              height: i === idx ? 16 : 10,
              borderRadius: '50%',
              background: i === idx
                ? 'var(--primary)'
                : i < idx ? 'var(--primary-light, #bfdbfe)' : 'var(--gray-200)',
              cursor: 'pointer',
              transition: 'all .2s',
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    )
  }

  return (
    <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--gray-500)' }}>
      {idx + 1} / {flat.length}
    </span>
  )
}

// ── Main StudentLesson ────────────────────────────────────────────────────────

export default function StudentLesson() {
  const { lessonId } = useParams()
  const navigate     = useNavigate()
  const panelRef     = useRef(null)

  const [lesson,   setLesson]   = useState(null)
  const [selected, setSelected] = useState(null)
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState('')
  const [tocOpen,  setTocOpen]  = useState(true)

  useEffect(() => {
    getPublishedLesson(lessonId)
      .then(res => {
        setLesson(res.data)
        if (res.data.sections?.length > 0) setSelected(res.data.sections[0].id)
      })
      .catch(() => setError('Lesson not found or not available.'))
      .finally(() => setLoading(false))
  }, [lessonId])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <span className="spinner spinner-dark" style={{ width: 40, height: 40 }} />
    </div>
  )

  if (error) return (
    <div style={{ padding: 40 }}>
      <div className="alert alert-error">{error}</div>
      <button className="btn btn-outline" onClick={() => navigate('/content')}>← Back</button>
    </div>
  )

  const flat    = flattenSections(lesson?.sections || [])
  const idx     = flat.findIndex(s => s.id === selected)
  const current = flat[idx] ?? null
  const hasPrev = idx > 0
  const hasNext = idx < flat.length - 1

  const goTo = (id) => {
    setSelected(id)
    panelRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="editor-shell">
      {/* ── Top bar ── */}
      <div className="editor-topbar">
        <button className="btn btn-outline btn-sm" onClick={() => navigate('/content')}>
          ← Back
        </button>

        <button
          className="btn btn-outline btn-sm"
          style={{ marginLeft: 8, minWidth: 36 }}
          onClick={() => setTocOpen(o => !o)}
          title={tocOpen ? 'Hide contents panel' : 'Show contents panel'}
        >
          {tocOpen ? '◀' : '▶'}
        </button>

        <h2 style={{
          flex: 1, fontSize: 17, fontWeight: 700, color: 'var(--gray-900)',
          marginLeft: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {lesson?.title}
        </h2>

        {flat.length > 0 && (
          <span style={{ fontSize: 13, color: 'var(--gray-400)', whiteSpace: 'nowrap', marginRight: 4 }}>
            {idx + 1} / {flat.length}
          </span>
        )}
      </div>

      {/* ── Body ── */}
      <div className="editor-body">

        {/* TOC sidebar */}
        {tocOpen && (
          <div className="editor-toc">
            <div className="toc-header">
              <span style={{ fontWeight: 600, fontSize: 13, color: 'var(--gray-700)' }}>
                Contents
              </span>
            </div>
            <div className="toc-scroll">
              {flat.map((s, i) => (
                <div
                  key={s.id}
                  className={`toc-item${selected === s.id ? ' active' : ''}`}
                  style={{ paddingLeft: 10 + s.depth * 16, cursor: 'pointer' }}
                  onClick={() => goTo(s.id)}
                >
                  <span style={{
                    fontSize: 11, color: 'var(--gray-400)',
                    marginRight: 6, minWidth: 18, display: 'inline-block', textAlign: 'right',
                  }}>
                    {i + 1}
                  </span>
                  <span className="toc-item-title" style={{ fontSize: 13 }}>
                    {s.title || <em style={{ color: 'var(--gray-400)' }}>untitled</em>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Content panel */}
        <div
          className="editor-panel"
          ref={panelRef}
          style={{ overflowY: 'auto' }}
        >
          {current ? (
            <div key={current.id} style={{ maxWidth: 720, margin: '0 auto' }}>

              <SectionView section={current} />

              {/* ── Navigation bar ── */}
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                marginTop: 48, paddingTop: 24,
                borderTop: '2px solid var(--gray-100)',
                gap: 12,
              }}>
                <NavBtn onClick={() => hasPrev && goTo(flat[idx - 1].id)} disabled={!hasPrev}>
                  ◀ Previous
                </NavBtn>

                <ProgressDots flat={flat} idx={idx} goTo={goTo} />

                {hasNext ? (
                  <NavBtn onClick={() => goTo(flat[idx + 1].id)} primary>
                    Next ▶
                  </NavBtn>
                ) : (
                  <NavBtn onClick={() => navigate('/content')} primary>
                    Finish! 🎉
                  </NavBtn>
                )}
              </div>

            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-state-icon">📖</div>
              <p className="empty-state-text">Select a section from the left.</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function flattenSections(sections) {
  const result = []
  const visit = (items, depth = 0) => {
    items.forEach(s => {
      result.push({ ...s, children: [], depth }) // ← بيمسح children من الـ flat
      if (s.children?.length) visit(s.children, depth + 1)
    })
  }
  visit(sections)
  return result
}