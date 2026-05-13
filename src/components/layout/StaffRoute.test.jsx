import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(),
}))

import useAuthStore from '../../store/authStore'
import StaffRoute from './StaffRoute'

const renderWithRouter = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  return render(
    <MemoryRouter initialEntries={['/staff']}>
      <Routes>
        <Route element={<StaffRoute />}>
          <Route path="/staff" element={<div>Staff Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('StaffRoute', () => {
  it('shows spinner while loading', () => {
    renderWithRouter({ loading: true, profile: null })
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderWithRouter({ loading: false, profile: null })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects to /login when role is admin (not staff)', () => {
    renderWithRouter({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when role is staff', () => {
    renderWithRouter({ loading: false, profile: { role: 'staff', account_status: 'active' } })
    expect(screen.getByText('Staff Page')).toBeInTheDocument()
  })

  it('redirects to /account-inactive when staff is suspended', () => {
    useAuthStore.mockReturnValue({
      loading: false,
      profile: { role: 'staff', account_status: 'suspended' },
    })
    render(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route element={<StaffRoute />}>
            <Route path="/staff" element={<div>Staff Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Inactive Page')).toBeInTheDocument()
  })
})
