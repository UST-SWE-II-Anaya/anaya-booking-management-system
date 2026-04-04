// src/components/common/Badge.test.jsx
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import Badge from './Badge'

describe('Badge', () => {
  it('renders the label', () => {
    render(<Badge variant="upcoming" label="Upcoming" />)
    expect(screen.getByText('Upcoming')).toBeInTheDocument()
  })

  it('applies upcoming variant class', () => {
    render(<Badge variant="upcoming" label="Upcoming" />)
    const badge = screen.getByText('Upcoming')
    expect(badge).toHaveClass('bg-blue-100')
  })

  it('applies verified variant class', () => {
    render(<Badge variant="verified" label="Verified" />)
    expect(screen.getByText('Verified')).toHaveClass('bg-green-100')
  })

  it('applies denied variant class', () => {
    render(<Badge variant="denied" label="Denied" />)
    expect(screen.getByText('Denied')).toHaveClass('bg-red-100')
  })
})
