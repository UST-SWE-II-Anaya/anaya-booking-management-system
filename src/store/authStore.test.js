// src/store/authStore.test.js
import { describe, it, expect, beforeEach } from 'vitest'
import useAuthStore from './authStore'

beforeEach(() => {
  useAuthStore.setState({ user: null, profile: null, loading: true })
})

describe('authStore', () => {
  it('starts with null user and loading true', () => {
    const state = useAuthStore.getState()
    expect(state.user).toBeNull()
    expect(state.profile).toBeNull()
    expect(state.loading).toBe(true)
  })

  it('setUser updates user', () => {
    useAuthStore.getState().setUser({ id: 'abc' })
    expect(useAuthStore.getState().user).toEqual({ id: 'abc' })
  })

  it('setProfile updates profile', () => {
    useAuthStore.getState().setProfile({ role: 'admin' })
    expect(useAuthStore.getState().profile).toEqual({ role: 'admin' })
  })

  it('clear resets user and profile', () => {
    useAuthStore.setState({ user: { id: 'x' }, profile: { role: 'admin' } })
    useAuthStore.getState().clear()
    const { user, profile, loading } = useAuthStore.getState()
    expect(user).toBeNull()
    expect(profile).toBeNull()
    expect(loading).toBe(false)
  })
})
