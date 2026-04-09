# Public Master Context

This document outlines the user journey, UI flow, and business logic for the public-facing side (Public View) of the Anaya Booking Management System. It defines how new and returning unauthorized visitors discover services, build trust with the brand, and ultimately initiate a booking.

## Customer Experience Overview

Public users represent the general public who are visiting the website without an authenticated account. 

**Core Capabilities for Public Users:**
- View services offered, their descriptions, durations, pricing, and general availability.
- Discover studio location, operating hours, and contact details.
- Submit inquiries to the administration.

**Restrictions:**
- Public users **cannot** formally book an appointment.
- Public users **cannot** make any modifications to accounts or bookings.
- Any attempt to proceed with a booking will mandate account authentication (login/signup process).

---

## Detailed User Flow

The public user's logical journey generally follows these steps:

1. **Discovery & Exploration**: Users land on the **Home Page** to get an immediate sense of the studio's aesthetic and value proposition. They may navigate to the **About Us** or **Location** pages to verify credibility, read team profiles, and find the physical address.
2. **Service Browsing**: Users seeking to understand general offerings navigate to the visual **Categories Overview**. From there, they dive deeper into a **Category Detail Page** to read up on specific procedures, tools used, and the scope of services under that umbrella.
3. **Booking Selection (Services Page)**: Once decided (or directly from the Home Page's primary CTA), the user accesses the interactive **Services Page**. Here they can search, filter by category tabs, assess precise pricing and durations, and select specific items.
4. **Authentication Handoff**: When the user decides to finalize a selection by clicking `+ Book`, they are redirected out of the public flow into the **Login Page** or **Sign Up Page** to authenticate before completing the reservation.

---

## UI Component Breakdown

The public view consists of the following key pages:

### 1. Home / Landing Page
- **Purpose**: To provide a strong first impression, highlight core values, showcase popular services, and drive action toward booking.
- **Components**:
  - **Global Navigation Bar**: Logo, Services, About Us, Location, Log in, Sign up.
  - **Hero Section**: Large background image, primary tagline ("Your Everyday Reset"), subtext, and a prominent solid CTA button ("View Services & Book").
  - **Value Proposition Cards**: Emphasizing key benefits (Certified Professionals, Tailored Treatment Plans, Serene Studio Environment, Simple Online Scheduling).
  - **Popular Services Carousel/Grid**: Highlighted image cards for specific services with "Learn more >" interactive links.
  - **Studio Location Section**: Embedded map component paired with an overlaid contact info card (Address, Phone, Email, Hours).
  - **Global Footer**: Essential links, contacts, address, operating hours, and social media links.

### 2. Categories Overview (Service Category Page)
- **Purpose**: Visual, high-level map of all service umbrellas offered.
- **Components**:
  - **Page Title**: "Our Services".
  - **Service Category Grid**: Large image cards for broad categories (Nail Care, Lash & Brow Care, Facial Care, etc.) with a semi-transparent gradient overlay and a "Learn more >" CTA.

### 3. Category Detail Page
- **Purpose**: Informational view explaining specific category procedures before financial decisions are made.
- **Components**:
  - **Page Title & Subtitle**: Categorical naming (e.g., "Nail Care" and "Exquisite Manicures & Pedicures").
  - **Hero Image & Overview Text**: High-res image and text block explaining the studio's approach.
  - **Service Check-list**: A clean list under "Services under this Category", identifying individual available line-items with a custom leaf icon bullet.

### 4. Booking Selection Menu (Services Page)
- **Purpose**: Interactive menu to review exact details and commit to scheduling.
- **Components**:
  - **Page Title**: "Our Services".
  - **Search Bar**: Full-width input field for quick lookups.
  - **Filter Pill Navigation**: Selectable categories to dynamically filter the list below.
  - **Detailed Service List**: Grouped cards displaying specific bookable items.
  - **Service Card Data**: Service designation, duration (e.g., 1 hr 30 mins), brief description, Price (₱ 350.00), and an outlined `+ Book` button.

### 5. About Us Page
- **Purpose**: Humanize the brand, showcase staff expertise, and establish core mission/vision.
- **Components**:
  - **Page Title**: "Our Story & Our Team".
  - **Staff Group Photo** & **Core Values Text Blocks** (Mission/Vision).
  - **Meet the Team Grid**: Individual profile cards detailing staff photos, names, and specific roles.

### 6. Location & Contact Page
- **Purpose**: Assist users in locating the physical establishment and provide an asynchronous channel for inquiries.
- **Components**:
  - **Contact Information Grid**: Address, Phone, Email cards.
  - **Interactive Map**: Map screenshot/embed displaying the precise location of the clinic.
  - **Contact Form**: "We're Here to Help" section with input fields for Name (First, Last), Email, and a multi-line Comments text area, complete with a `Send Message` CTA.

### 7. Login & Sign Up Pages
- Exists as part of the public domain but serves as the gateway to the authenticated user dashboard and booking mechanics.

---

## Business Rules & Logic

1. **Authentication Requirement for Booking**
   - The system allows unauthenticated browsing of all Service Cards and pricing.
   - However, clicking the **"+ Book"** button on the Services Page strictly triggers a state change that transitions the user away from public browsing and redirects them to the **Login Page** (or prompts them to Sign Up). An account is mandatory to finalize a booking.
2. **Contact Form Routing**
   - Submitting the form on the Location Page validates inputs (checking for required fields and proper email format). Upon successful submission, the message payload is automatically forwarded directly to the hidden **Admin View** for staff to review. Success/error notifications should be displayed to the user accordingly.
