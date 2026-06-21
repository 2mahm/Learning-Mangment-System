import axios from 'axios'

const client = axios.create({
  baseURL: import.meta.env.VITE_API_URL + '/api',
})

// Attach token to every request
client.interceptors.request.use(config => {
  const token = localStorage.getItem('lms_token')
  if (token) {
    config.headers.Authorization = `Token ${token}`
  }
  return config
})

// Auto-logout on 401
client.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem('lms_token')
      localStorage.removeItem('lms_user')
      window.location.href = '/login'
    }
    return Promise.reject(error)
  }
)

export default client
