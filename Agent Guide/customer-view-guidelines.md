# Customer Master Context

This document outlines the user journey, UI flow, and business logic for the Customer View of the Anaya Booking Management System. It covers both the linear booking process and dashboard management functionalities for authenticated users.

## Customer Experience Overview

Users with accounts can access a personalized portal to manage their relationship with the aesthetic clinic. The portal supports the following core capabilities:
1. Check their current and past bookings.
2. Cancel their bookings (if within the cancellation policy).
3. View and edit profile information.
4. Add or change profile pictures.
5. Change passwords.
6. Log out.

The customer journey is divided into two main phases:
- **Phase 1: The Booking Journey** – A step-by-step flow from selecting services to finalizing the appointment and paying the down payment.
- **Phase 2: User Dashboard & Profile** – A centralized hub where users manage their appointments and account details.


## Detailed User Flow

### Phase 1: The Booking Journey

#### Step 1: Service Selection
- **Purpose:** User browses and selects specific treatments or packages to book. 
- **Action:** Searching or filtering by category (e.g., Package, Nail Care, Facial Care). Clicking `+ Add` or `Add to Cart` adds the service to the persistent booking sidebar.
- **Proceed:** Clicking `Continue` proceeds to Professional Selection.

#### Step 2: Professional Selection
- **Purpose:** User determines which aesthetician or staff member will handle their selected services.
- **Options Available:**
  1. Any available professional
  2. Any female professional
  3. Any male professional
  4. A specific professional
- **Proceed:** Clicking `Select` on an option updates the booking context and proceeds to Date & Time Selection.

#### Step 3: Date & Time Selection
- **Purpose:** User picks their preferred date and an available time slot.
- **Action:** Clicking a day on the calendar queries available times. The system displays time slots from **9:00 AM to 7:30 PM with 30-minute intervals**, filtered by the selected professional's availability. (Note: Unavailable times are grayed out but still visible). Calendar defaults to the current date.
- **Proceed:** Clicking a time slot highlights it, and clicking `Continue` proceeds to Review and Confirm.

#### Step 4: Review and Confirm
- **Purpose:** Final review of the booking, cancellation policy, and important info. 
- **Action:** User can input special requests in the "Booking Notes" text area.
- **Proceed Options:**
  - **"Reserve Appointment"**: Reserves the slot but leaves the down payment status as "Pending". Redirects to the Appointment Booking Manager.
  - **"Reserve Appointment and Proceed to Downpayment"**: Reserves the slot and routes the user to the Payment gateway.

#### Step 5: Down Payment (Payment Page)
- **Purpose:** Settle the mandatory 10% down payment to confirm the appointment.
- **Action:** User scans the provided GCash QR codes and manually transfers the funds. They must input:
  - Reference Number of the GCash receipt
  - Account Name (Name of the sender)
  - Screenshot/Proof of the GCash receipt
- **Proceed:** Clicking `Confirm` verifies the payload and routes to Booking Success.

#### Step 6: Booking Success
- **Purpose:** Visual validation of the successful booking and payment. 
- **Action:** Displays a booking summary prioritizing the remaining balance to be paid at the establishment. An automated email is sent to the user confirming the booking and down payment.
- **Proceed:** Clicking `Back to Home` redirects to the Appointment Booking Manager (dashboard) where the appointment will show as "Upcoming" and "Paid" (if down payment was made).

---

### Phase 2: User Dashboard & Profile

#### Appointment Booking Manager (Dashboard)
- **Empty State:** If no active appointments exist, an "Empty State Graphic" appears with options to `Book an appointment` or `View Past Appointments`.
- **Active State:** Displays appointment cards for current bookings.

#### Appointment Details (Modal/View)
- **Purpose:** Detailed view of a specific appointment's status and payment breakdowns.
- **Action:** If the appointment has a pending down payment, the user can click `Pay Downpayment` to complete the transaction. Users can also click `Cancel Reservation` if within policy limits.

#### User Profile
- **Purpose:** Display and manage the user's personal details, profile picture, and password.
- **Action:** Clicking `Edit` or the avatar enables edit mode for updating information.

---

## UI Component Breakdown

### Booking Page Elements
- **Service Categories & Grid:** E.g., Packages (She Nailed It), Nail Care (Classic Manicure, Gel Polish).
- **Service Card:** Name, Estimated Duration, Price, Description, and `+ Add` button.
- **"Your Booking" Sidebar (Cart):** Persistently displays selected services, subtotal, required down payment (10% of total), and total estimated duration.

### Dashboard Elements
- **Appointment Card Data:** 
  - Appointment ID, Date, and Starting Time
  - Total Duration and Services included
  - Booking Status: Upcoming, Finished, Cancelled, No Show
  - Downpayment Status: Pending, Paid
  - Downpayment Total vs. Overall Balance (overall minus down payment)
  - **Time left to pay countdown:** (Only visible for pending down payments).

---

## Business Rules & Logic

1. **Down Payment System:**
   - A **10% down payment** is required to secure bookings.
   - Users can choose to "Reserve Appointment" without paying immediately. In this state, the down payment is "Pending".
   - **Time Limit:** There is a specific "Time left to pay" countdown for pending down payments. If the user fails to pay within this timeframe, the system automatically cancels the reservation.
2. **Cancellation Policy:**
   - Users can self-cancel their reservations only within 12 hours after the booking was created.
3. **Availability Display:**
   - Timeslots are rendered strictly based on the professional selected. If a professional is booked, that 30-minute interval is grayed out but still visible (rather than being hidden).
4. **Offline Balance Validation:**
   - The system tracks the "Remaining Balance". The initial online transaction only covers the down payment via GCash. The rest is settled offline at the establishment.
