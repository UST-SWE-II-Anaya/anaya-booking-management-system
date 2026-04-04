// src/hooks/useAuthUser.js
import { useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { getProfile } from '../services/authService'
import useAuthStore from '../store/authStore'

const useAuthUser = () => {
  const { setUser, setProfile, setLoading, clear } = useAuthStore()

  useEffect(() => {
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const profile = await getProfile(session.user.id)
          setUser(session.user)
          setProfile(profile)
        }
      } catch (err) {
        console.error('Auth init error:', err)
      } finally {
        setLoading(false)
      }
    }

    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          try {
            const profile = await getProfile(session.user.id)
            setUser(session.user)
            setProfile(profile)
          } catch (err) {
            console.error('Auth state change error:', err)
            clear()
          } finally {
            setLoading(false)
          }
        } else {
          clear()
          setLoading(false)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])
}

export default useAuthUser
