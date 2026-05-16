import client from './client'
import studentClient from './studentClient'

// Teacher: all submissions for one exercise section (latest per student flagged)
export const getExerciseResults = (sectionId) =>
  client.get(`/content/sections/${sectionId}/results/`)

// Teacher: student × exercise performance grid for an entire lesson
export const getExerciseStats = (lessonId) =>
  client.get(`/content/lessons/${lessonId}/exercise-stats/`)

// Authenticated portal (JWT): submit answers and receive graded result
export const submitExercise = (sectionId, answers) =>
  client.post(`/content/sections/${sectionId}/submit/`, { answers })

// Authenticated portal (JWT): check if already attempted
export const getMyResult = (sectionId) =>
  client.get(`/content/sections/${sectionId}/my-result/`)

// Student portal (StudentToken): used by StudentPortalLesson only
export const submitExerciseStudent = (sectionId, answers) =>
  studentClient.post(`/content/sections/${sectionId}/submit/`, { answers })

export const getMyResultStudent = (sectionId) =>
  studentClient.get(`/content/sections/${sectionId}/my-result/`)
