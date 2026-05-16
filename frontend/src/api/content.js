import client from './client'

// ---------------------------------------------------------------------------
// Subject Groups  (teacher)
// ---------------------------------------------------------------------------
export const getSubjectGroups = () =>
  client.get('/content/subject-groups/')

export const createSubjectGroup = (data) =>
  client.post('/content/subject-groups/', data)

export const updateSubjectGroup = (id, data) =>
  client.patch(`/content/subject-groups/${id}/`, data)

export const deleteSubjectGroup = (id) =>
  client.delete(`/content/subject-groups/${id}/`)

// ---------------------------------------------------------------------------
// Lessons  (teacher)
// ---------------------------------------------------------------------------
export const getLessons = (groupId) =>
  client.get(`/content/subject-groups/${groupId}/lessons/`)

export const createLesson = (groupId, data) =>
  client.post(`/content/subject-groups/${groupId}/lessons/`, data)

export const reorderLessons = (groupId, order) =>
  client.post(`/content/subject-groups/${groupId}/lessons/reorder/`, { order })

export const getLessonDetail = (id) =>
  client.get(`/content/lessons/${id}/`)

export const updateLesson = (id, data) =>
  client.patch(`/content/lessons/${id}/`, data)

export const deleteLesson = (id) =>
  client.delete(`/content/lessons/${id}/`)

// ---------------------------------------------------------------------------
// Sections  (teacher)
// ---------------------------------------------------------------------------
export const createSection = (lessonId, data) =>
  client.post(`/content/lessons/${lessonId}/sections/`, data)

export const updateSection = (id, data) =>
  client.patch(`/content/sections/${id}/`, data)

export const deleteSection = (id) =>
  client.delete(`/content/sections/${id}/`)

export const reorderSections = (lessonId, order) =>
  client.post(`/content/lessons/${lessonId}/sections/reorder/`, { order })

export const reorderChildSections = (sectionId, order) =>
  client.post(`/content/sections/${sectionId}/children/reorder/`, { order })

// ---------------------------------------------------------------------------
// Book Files  (teacher)
// ---------------------------------------------------------------------------
export const getBookFiles = (groupId) =>
  client.get(`/content/subject-groups/${groupId}/files/`)

export const uploadBookFile = (groupId, formData) =>
  client.post(`/content/subject-groups/${groupId}/files/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

export const deleteBookFile = (id) =>
  client.delete(`/content/files/${id}/`)

// ---------------------------------------------------------------------------
// Section media upload  (teacher)
// ---------------------------------------------------------------------------
export const uploadSectionMedia = (formData) =>
  client.post('/content/media/', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })

// ---------------------------------------------------------------------------
// Grades  (admin CRUD + teacher read — filtered by center)
// ---------------------------------------------------------------------------
export const getGrades = (centerId) =>
  client.get('/grades/', centerId ? { params: { center: centerId } } : undefined)

export const createGrade = (data) =>
  client.post('/grades/', data)

export const updateGrade = (id, data) =>
  client.patch(`/grades/${id}/`, data)

export const deleteGrade = (id) =>
  client.delete(`/grades/${id}/`)

// ---------------------------------------------------------------------------
// Students in a subject group (teacher — assignment picker)
// ---------------------------------------------------------------------------
export const getGroupStudents = (groupId) =>
  client.get(`/content/subject-groups/${groupId}/students/`)

// ---------------------------------------------------------------------------
// Parent: student performance
// ---------------------------------------------------------------------------
export const getParentPerformance = () =>
  client.get('/content/parent/performance/')

// ---------------------------------------------------------------------------
// Attendance  (teacher manages, parent views)
// ---------------------------------------------------------------------------
export const getAttendance = (groupId, date) =>
  client.get(`/attendance/subject-groups/${groupId}/`, date ? { params: { date } } : undefined)

export const saveAttendance = (groupId, date, records) =>
  client.post(`/attendance/subject-groups/${groupId}/`, { date, records })

export const getAttendanceSummary = (groupId) =>
  client.get(`/attendance/subject-groups/${groupId}/summary/`)

export const getParentAttendance = () =>
  client.get('/attendance/parent/')

// ---------------------------------------------------------------------------
// Progress dashboard  (parent views student progress)
// ---------------------------------------------------------------------------
export const getStudentProgress = (studentId) =>
  client.get(`/content/progress/student/${studentId}/`)

// ---------------------------------------------------------------------------
// Published content  (student / parent — read only)
// ---------------------------------------------------------------------------
export const getPublishedSubjectGroups = () =>
  client.get('/content/published/subject-groups/')

export const getPublishedLessons = (groupId) =>
  client.get(`/content/published/subject-groups/${groupId}/lessons/`)

export const getPublishedLesson = (id) =>
  client.get(`/content/published/lessons/${id}/`)
