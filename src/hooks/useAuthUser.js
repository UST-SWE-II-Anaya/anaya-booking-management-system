// src/hooks/useAuthUser.js
import { useEffect } from 'react'
import { supabase } from '../services/supabaseClient'
import { getProfile } from '../services/authService'
import useAuthStore from '../store/authStore'

const useAuthUser = () => {
  const { setUser, setProfile, setLoading, clear } = useAuthStore()

  useEffect(() => {
    let mounted = true
    let isInitialized = false

    const initSession = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (session?.user) {
          const profile = await getProfile(session.user.id)
          if (mounted) {
            setUser(session.user)
            setProfile(profile)
          }
        } else if (mounted) {
          clear()
        }
      } catch (err) {
        console.error('Auth init error:', err)
        if (mounted) clear()
      } finally {
        if (mounted) {
          isInitialized = true
          setLoading(false)
        }
      }
    }

    initSession()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        if (event === 'INITIAL_SESSION' || !isInitialized) {
          // let initSession handle the initial load
          return
        }

        if (session?.user) {
          try {
            setLoading(true)
            const profile = await getProfile(session.user.id)
            if (mounted) {
              setUser(session.user)
              setProfile(profile)
            }
          } catch (err) {
            console.error('Auth state change error:', err)
            if (mounted) clear()
          } finally {
            if (mounted) setLoading(false)
          }
        } else {
          if (mounted) {
            clear()
            setLoading(false)
          }
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])
}

export default useAuthUser
