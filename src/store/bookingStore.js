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
      addToCart: (service) =>
        set((s) => ({ cart: [...s.cart, service] })),
      removeFromCart: (id) =>
        set((s) => ({ cart: s.cart.filter((item) => item.id !== id) })),
      setStaffPreference: (pref) =>
        set({ staffPreference: pref, selectedStaffId: null }),
      setSelectedStaff: (id) => set({ selectedStaffId: id }),
      setDateTime: (date, time) =>
        set({ selectedDate: date, selectedTime: time }),
      setBookingNotes: (notes) => set({ bookingNotes: notes }),
      clearBooking: () =>
        set({
          cart: [],
          staffPreference: 'any',
          selectedStaffId: null,
          selectedDate: null,
          selectedTime: null,
          bookingNotes: '',
        }),
    }),
    {
      name: 'booking-store',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
)

export default useBookingStore
