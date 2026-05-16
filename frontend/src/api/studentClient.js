import axios from 'axios'

const studentClient = axios.create({
  baseURL: '/api',
})

studentClient.interceptors.request.use(config => {
  const student = JSON.parse(localStorage.getItem('lms_student') || '{}')
  if (student.token) {
    config.headers.Authorization = `StudentToken ${student.token}`
  }
  return config
})

studentClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lms_student')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default studentClient
