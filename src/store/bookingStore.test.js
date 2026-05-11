import { describe, it, expect, beforeEach } from 'vitest'
import useBookingStore from './bookingStore'

const reset = () =>
  useBookingStore.setState({
    cart: [],
    staffPreference: 'any',
    selectedStaffId: null,
    selectedDate: null,
    selectedTime: null,
    bookingNotes: '',
    bookingSessionKey: null,
    previousSessionKey: null,
  })

describe('bookingStore', () => {
  beforeEach(reset)

  it('adds a service to cart', () => {
    const svc = { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 }
    useBookingStore.getState().addToCart(svc)
    expect(useBookingStore.getState().cart).toHaveLength(1)
    expect(useBookingStore.getState().cart[0].id).toBe('1')
  })

  it('removes a service from cart by id', () => {
    const svc = { id: '1', name: 'Manicure', category_name: 'Nails', duration_minutes: 60, price: 350 }
    useBookingStore.getState().addToCart(svc)
    useBookingStore.getState().removeFromCart('1')
    expect(useBookingStore.getState().cart).toHaveLength(0)
  })

  it('sets staff preference and clears selectedStaffId', () => {
    useBookingStore.setState({ selectedStaffId: 'abc' })
    useBookingStore.getState().setStaffPreference('any_female')
    expect(useBookingStore.getState().staffPreference).toBe('any_female')
    expect(useBookingStore.getState().selectedStaffId).toBeNull()
  })

  it('setSelectedStaff sets selectedStaffId', () => {
    useBookingStore.getState().setSelectedStaff('staff-uuid')
    expect(useBookingStore.getState().selectedStaffId).toBe('staff-uuid')
  })

  it('sets date and time', () => {
    useBookingStore.getState().setDateTime('2026-04-20', '10:00')
    expect(useBookingStore.getState().selectedDate).toBe('2026-04-20')
    expect(useBookingStore.getState().selectedTime).toBe('10:00')
  })

  it('sets booking notes', () => {
    useBookingStore.getState().setBookingNotes('No gel please')
    expect(useBookingStore.getState().bookingNotes).toBe('No gel please')
  })

  it('setBookingSessionKey stores the provided key', () => {
    useBookingStore.getState().setBookingSessionKey('test-uuid-1234')
    expect(useBookingStore.getState().bookingSessionKey).toBe('test-uuid-1234')
  })

  it('clearBooking resets bookingSessionKey and previousSessionKey to null', () => {
    useBookingStore.setState({ bookingSessionKey: 'key', previousSessionKey: 'prev' })
    useBookingStore.getState().clearBooking()
    expect(useBookingStore.getState().bookingSessionKey).toBeNull()
    expect(useBookingStore.getState().previousSessionKey).toBeNull()
  })

  it('setBookingNotes does not affect bookingSessionKey', () => {
    useBookingStore.setState({ bookingSessionKey: 'key1' })
    useBookingStore.getState().setBookingNotes('No gel please')
    expect(useBookingStore.getState().bookingSessionKey).toBe('key1')
    expect(useBookingStore.getState().previousSessionKey).toBeNull()
  })

  it('mutating cart stashes bookingSessionKey into previousSessionKey', () => {
    useBookingStore.setState({ bookingSessionKey: 'session-1' })
    useBookingStore.getState().addToCart({ id: 's1' })
    const s = useBookingStore.getState()
    expect(s.bookingSessionKey).toBeNull()
    expect(s.previousSessionKey).toBe('session-1')
  })

  it('clearBooking resets all state', () => {
    useBookingStore.setState({
      cart: [{ id: '1' }],
      selectedDate: '2026-04-20',
      selectedTime: '10:00',
      staffPreference: 'any_female',
      bookingNotes: 'Note',
      bookingSessionKey: 'some-uuid',
    })
    useBookingStore.getState().clearBooking()
    const s = useBookingStore.getState()
    expect(s.cart).toHaveLength(0)
    expect(s.selectedDate).toBeNull()
    expect(s.selectedTime).toBeNull()
    expect(s.staffPreference).toBe('any')
    expect(s.bookingNotes).toBe('')
    expect(s.bookingSessionKey).toBeNull()
    expect(s.previousSessionKey).toBeNull()
  })
})
