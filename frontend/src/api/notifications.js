import client from './client'

export const getNotifications = () => client.get('/notifications/')
export const markNotificationsRead = (ids = []) => client.post('/notifications/mark-read/', { ids })
export const deleteNotification = (id) => client.delete(`/notifications/${id}/`)
