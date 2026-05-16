import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'

export default function InviteRedirect() {
  const { token } = useParams()
  const navigate  = useNavigate()

  useEffect(() => {
    if (token) sessionStorage.setItem('invite_token', token)
    navigate('/register', { replace: true })
  }, [])

  return null
}
