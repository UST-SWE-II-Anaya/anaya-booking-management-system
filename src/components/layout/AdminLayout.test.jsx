// src/components/layout/AdminLayout.test.jsx
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../store/authStore', () => ({
  default: vi.fn(() => ({
    profile: { first_name: 'Ana', last_name: 'Admin', role: 'admin' },
  })),
}))

vi.mock('../../services/authService', () => ({
  signOut: vi.fn().mockResolvedValue(undefined),
}))

import AdminLayout from './AdminLayout'

const renderLayout = () =>
  render(
    <MemoryRouter>
      <AdminLayout />
    </MemoryRouter>
  )

describe('AdminLayout', () => {
  it('renders sidebar navigation links', () => {
    renderLayout()
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Bookings')).toBeInTheDocument()
    expect(screen.getByText('Customers')).toBeInTheDocument()
    expect(screen.getByText('Staff')).toBeInTheDocument()
    expect(screen.getByText('Services')).toBeInTheDocument()
    expect(screen.getByText('Inquiries')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders admin name in header', () => {
    renderLayout()
    expect(screen.getByText('Ana Admin')).toBeInTheDocument()
  })
})
