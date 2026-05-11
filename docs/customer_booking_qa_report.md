# Customer Booking Flow - QA Test Report

**Testing Context:**
- QA Flow: Customer Booking Path
- Account: namota7004@pmdeal.com

## 1. Primary Reported Bug: Duplicate/Empty Bookings on Payment Back Navigation
- **Status:** **REPRODUCED**
- **Severity:** Critical
- **Description:** When a user proceeds to the payment screen, uses the browser's back button, and attempts to reserve/proceed to payment again, a second booking is created. Sometimes this booking appears empty if the session state is lost.
- **Root Cause & Details:** The system creates a booking record in the database with a "Pending" status and a 12-hour expiration timer *immediately* when the user clicks "Reserve Appointment" or "Reserve Appointment and Proceed to Payment" on the Review page. Since the creation happens *before* payment is even initiated or confirmed, any action that brings the user back to the review page allows them to submit again, thus creating duplicate records. Additionally, manually navigating back often clears the selected services/staff from the session state, leading to "empty" booking creations when the stale button is clicked again.

## 2. Session State Loss on Navigation
- **Severity:** High
- **Description:** Manually navigating back (e.g., using browser back button) to earlier steps in the booking flow (like `/booking/review`) often clears the entirely local booking state (selected services, selected staff, etc.), unexpectedly throwing the user back to a "No Services Selected" state and forcing them to restart the booking.

## 3. Broken "Go Back" Navigation
- **Severity:** Medium
- **Description:** Internal UI links labeled "← Go Back to Previous Page" sometimes reset the entire selection flow instead of taking the user back exactly one step with their state preserved.

## 4. Confusing Field Validation on Payment Page
- **Severity:** Medium
- **Description:** The "Reference Number" input field on the Payment page explicitly specifies "13 digits", but its placeholder text currently reads `e.g. 1234567890ABC` which includes letters. This is contradictory and can confuse users.

[IGNORE] ## 5. Low-Quality Payment QR Codes
- **Severity:** Medium
- **Description:** The GCASH QR codes displayed on the payment screen are low-resolution placeholders (raw black and white squares). This looks unfinished and could reduce customer trust during payment.

[IGNORE] ## 6. UI Icon Issue in Staff Selection
- **Severity:** Low
- **Description:** In the Staff selection step, the "Any professional" option is using a `user-circle` icon that resembles a sad or confused face, which makes it feel visually off-putting.

---

### Recommendations for Resolution
1. **Defer Database Persistence:** Alter the booking flow to not persist the final booking record until a successful payment is recorded or at least a confirmed user intent exists beyond clicking the button.
2. **Idempotency Strategy:** Assign a unique session identifier to the booking attempt so that repeated clicks to "Reserve" update the exact same database row instead of pushing a duplicate.
3. **Robust State Preservation:** Refactor the booking flow state (via Zustand/Context or session storage) so that navigating backwards does not clear the user's selected services and timeslot unexpectedly.
