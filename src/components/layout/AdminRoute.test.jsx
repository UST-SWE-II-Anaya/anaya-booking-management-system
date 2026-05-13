// src/components/layout/AdminRoute.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(),
}))

import useAuthStore from '../../store/authStore'
import AdminRoute from './AdminRoute'

const renderWithRouter = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  return render(
    <MemoryRouter initialEntries={['/admin']}>
      <Routes>
        <Route element={<AdminRoute />}>
          <Route path="/admin" element={<div>Admin Page</div>} />
        </Route>
        <Route path="/login" element={<div>Login Page</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('AdminRoute', () => {
  it('shows spinner while loading', () => {
    renderWithRouter({ loading: true, profile: null })
    expect(screen.getByTestId('spinner')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderWithRouter({ loading: false, profile: null })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('redirects to /login when role is not admin', () => {
    renderWithRouter({ loading: false, profile: { role: 'staff' } })
    expect(screen.getByText('Login Page')).toBeInTheDocument()
  })

  it('renders children when role is admin', () => {
    renderWithRouter({ loading: false, profile: { role: 'admin', account_status: 'active' } })
    expect(screen.getByText('Admin Page')).toBeInTheDocument()
  })

  it('redirects to /account-inactive when admin is suspended', () => {
    useAuthStore.mockReturnValue({
      loading: false,
      profile: { role: 'admin', account_status: 'suspended' },
    })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Page</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Inactive Page')).toBeInTheDocument()
  })

  it('redirects to /account-banned when admin is banned', () => {
    useAuthStore.mockReturnValue({
      loading: false,
      profile: { role: 'admin', account_status: 'banned' },
    })
    render(
      <MemoryRouter initialEntries={['/admin']}>
        <Routes>
          <Route element={<AdminRoute />}>
            <Route path="/admin" element={<div>Admin Page</div>} />
          </Route>
          <Route path="/account-inactive" element={<div>Inactive Page</div>} />
          <Route path="/account-banned" element={<div>Banned Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Banned Page')).toBeInTheDocument()
  })
})
