import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'

const useBookingStore = create(
  persist(
    (set) => ({
      cart: [],
      staffPreference: 'any',
      selectedStaffId: null,
      selectedDate: null,
      selectedTime: null,
      bookingNotes: '',
      bookingSessionKey: null,
      previousSessionKey: null,
      addToCart: (service) =>
        set((s) => ({
          cart: [...s.cart, service],
          previousSessionKey: s.bookingSessionKey || s.previousSessionKey,
          bookingSessionKey: null,
        })),
      removeFromCart: (id) =>
        set((s) => ({
          cart: s.cart.filter((item) => item.id !== id),
          previousSessionKey: s.bookingSessionKey || s.previousSessionKey,
          bookingSessionKey: null,
        })),
      setStaffPreference: (pref) =>
        set((s) => ({
          staffPreference: pref,
          selectedStaffId: null,
          previousSessionKey: s.bookingSessionKey || s.previousSessionKey,
          bookingSessionKey: null,
        })),
      setSelectedStaff: (id) =>
        set((s) => ({
          selectedStaffId: id,
          previousSessionKey: s.bookingSessionKey || s.previousSessionKey,
          bookingSessionKey: null,
        })),
      setDateTime: (date, time) =>
        set((s) => ({
          selectedDate: date,
          selectedTime: time,
          previousSessionKey: s.bookingSessionKey || s.previousSessionKey,
          bookingSessionKey: null,
        })),
      setBookingNotes: (notes) => set({ bookingNotes: notes }),
      setBookingSessionKey: (key) => set({ bookingSessionKey: key }),
      clearBooking: () =>
        set({
          cart: [],
          staffPreference: 'any',
          selectedStaffId: null,
          selectedDate: null,
          selectedTime: null,
          bookingNotes: '',
          bookingSessionKey: null,
          previousSessionKey: null,
        }),
    }),
    {
      name: 'booking-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

export default useBookingStore
