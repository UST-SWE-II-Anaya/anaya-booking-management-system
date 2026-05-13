import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { describe, it, expect, vi } from 'vitest'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(),
}))

vi.mock('../common/Spinner', () => ({ default: () => <div>Loading...</div> }))

import useAuthStore from '../../store/authStore'
import CustomerRoute from './CustomerRoute'

const renderRoute = (storeState) => {
  useAuthStore.mockReturnValue(storeState)
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <Routes>
        <Route element={<CustomerRoute />}>
          <Route path="/dashboard" element={<div>Dashboard</div>} />
        </Route>
        <Route path="/login" element={<div>Login</div>} />
      </Routes>
    </MemoryRouter>
  )
}

describe('CustomerRoute', () => {
  it('shows spinner while loading', () => {
    renderRoute({ loading: true, profile: null })
    expect(screen.getByText('Loading...')).toBeInTheDocument()
  })

  it('redirects to /login when no profile', () => {
    renderRoute({ loading: false, profile: null })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects to /login when role is admin', () => {
    renderRoute({ loading: false, profile: { role: 'admin' } })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('redirects to /login when role is staff', () => {
    renderRoute({ loading: false, profile: { role: 'staff' } })
    expect(screen.getByText('Login')).toBeInTheDocument()
  })

  it('renders outlet when role is customer', () => {
    renderRoute({ loading: false, profile: { role: 'customer', account_status: 'active' } })
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
  })

  it('redirects to /account-inactive when customer is suspended', () => {
    useAuthStore.mockReturnValue({
      loading: false,
      profile: { role: 'customer', account_status: 'suspended' },
    })
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Routes>
          <Route element={<CustomerRoute />}>
            <Route path="/dashboard" element={<div>Dashboard</div>} />
          </Route>
          <Route path="/login" element={<div>Login Page</div>} />
          <Route path="/account-inactive" element={<div>Inactive Page</div>} />
        </Routes>
      </MemoryRouter>
    )
    expect(screen.getByText('Inactive Page')).toBeInTheDocument()
  })
})
