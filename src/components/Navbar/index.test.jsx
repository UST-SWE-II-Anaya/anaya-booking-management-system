import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../../store/authStore', () => ({ default: vi.fn() }))
import useAuthStore from '../../store/authStore'

vi.mock('../../services/supabaseClient', () => ({
  supabase: { auth: { signOut: vi.fn().mockResolvedValue({}) } },
}))

import Navbar from './index'

const render_ = () =>
  render(
    <MemoryRouter>
      <Navbar />
    </MemoryRouter>
  )

describe('Navbar', () => {
  beforeEach(() => vi.clearAllMocks())

  it('shows Log in when no profile', () => {
    useAuthStore.mockReturnValue({ profile: null, clear: vi.fn() })
    render_()
    expect(screen.getByText(/log in/i)).toBeInTheDocument()
  })

  it('shows customer links when profile.role is customer', () => {
    useAuthStore.mockReturnValue({ profile: { role: 'customer' }, clear: vi.fn() })
    render_()
    expect(screen.getByText(/my appointment/i)).toBeInTheDocument()
    expect(screen.getByText(/log out/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /profile/i })).toBeInTheDocument()
  })

  it('does not show customer links for admin role', () => {
    useAuthStore.mockReturnValue({ profile: { role: 'admin' }, clear: vi.fn() })
    render_()
    expect(screen.queryByText(/my appointment/i)).not.toBeInTheDocument()
  })

  it('calls supabase.auth.signOut and clear on Log out click', async () => {
    const clear = vi.fn()
    useAuthStore.mockReturnValue({ profile: { role: 'customer' }, clear })
    render_()
    fireEvent.click(screen.getByText(/log out/i))
    const { supabase } = await import('../../services/supabaseClient')
    expect(supabase.auth.signOut).toHaveBeenCalled()
  })
})
