import { useState, useEffect } from 'react'
import { getAllSettings } from '../services/settingsService'

const useSiteSettings = () => {
  const [settings, setSettings] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let mounted = true

    const fetchSettings = async () => {
      try {
        const data = await getAllSettings()
        if (mounted) {
          setSettings(data)
        }
      } catch (err) {
        console.error('Error fetching site settings:', err)
        if (mounted) {
          setError(err.message)
        }
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    fetchSettings()

    return () => {
      mounted = false
    }
  }, [])

  return { settings, loading, error }
}

export default useSiteSettings
