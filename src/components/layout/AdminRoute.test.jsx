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
    renderWithRouter({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Admin Page')).toBeInTheDocument()
  })
})
