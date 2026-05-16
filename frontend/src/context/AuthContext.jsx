import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import client from '../api/client'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null)
  const [loading, setLoading] = useState(true)

  // On every page load re-fetch /me/ so permissions are always current.
  useEffect(() => {
    const token = localStorage.getItem('lms_token')
    if (!token) {
      setLoading(false)
      return
    }
    client.get('/me/')
      .then(({ data }) => {
        localStorage.setItem('lms_user', JSON.stringify(data))
        setUser(data)
      })
      .catch(() => {
        localStorage.removeItem('lms_token')
        localStorage.removeItem('lms_user')
        setUser(null)
      })
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email, password) => {
    const { data: tokenData } = await client.post('/auth/login/', {
      username: email,
      password,
    })
    localStorage.setItem('lms_token', tokenData.token)

    const { data: userData } = await client.get('/me/')
    localStorage.setItem('lms_user', JSON.stringify(userData))
    setUser(userData)
    return userData
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem('lms_token')
    localStorage.removeItem('lms_user')
    setUser(null)
  }, [])

  /** Re-fetch /me/ and update the stored user. Call this after an admin
   *  changes the user's permissions so the sidebar refreshes immediately. */
  const refreshUser = useCallback(async () => {
    const { data } = await client.get('/me/')
    localStorage.setItem('lms_user', JSON.stringify(data))
    setUser(data)
    return data
  }, [])

  /** True when the user has the given accounts-app permission codename. */
  const hasPerm = useCallback((codename) => {
    if (!user) return false
    return Array.isArray(user.permissions) && user.permissions.includes(codename)
  }, [user])

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshUser, hasPerm }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => useContext(AuthContext)
