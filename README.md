# Shramik Pay & Attendance (Owner & Labour Salary Tracking Mobile App)

A complete, production-grade mobile solution with **two distinct user interfaces** (Owner App and Labour App) powered by a single shared PostgreSQL / Supabase backend and an immutable, transparent salary ledger engine.

---

## 🌟 Key Features

### 1. Owner App Interface
- **Executive Dashboard:** Live metrics for total workers, present/absent today, monthly salary payable, total advances given, deductions, paid salary, net remaining balance, and pending advance requests.
- **Worker Management:** Add, edit, deactivate, and view workers. Configure monthly base rate or daily wage, custom divisor (e.g., 30 or 26 days), weekly off day, paid leave allowances, max advance limits, and mobile 4-digit PINs.
- **Attendance & Leave Tracker:** Record daily attendance (Present, Absent, Half-Day, Paid Leave, Unpaid Leave, Weekly Off, Holiday) with real-time deduction previews. Supports audit-tracked corrections with mandatory explanations.
- **Small Cash & Advance Disburser:** Disburse ₹50, ₹100, ₹200, ₹500, or custom amounts via Cash, UPI, or Bank Transfer. Clearly distinguishes between **Recoverable Advances** (reduces salary) and **Non-recoverable Reimbursements/Bonuses** (does not reduce salary).
- **Salary Payments & Receipts:** Record partial salary installments or complete settlement payments. Generates unique electronic receipts (`RCPT-YYYYMM-XXXX`) and marks periods settled when balance reaches ₹0.
- **Reports & Data Export:** One-click CSV/Excel export and printable HTML Salary Slips with itemized calculation breakdowns.

### 2. Labour App Interface (Simple, High Contrast, Multilingual)
- **Worker Dashboard:** Large numbers, clear labels, and instant visibility into:
  - Remaining Salary Payable
  - Total Advances Received
  - Days Present, Days Absent, Half Days, and Unpaid Leave
  - Salary Installments Paid
- **"Request Money" Fast Action:** Quick presets for ₹50, ₹100, ₹200, ₹500, or custom amount. Choose reason (Food, Travel, Medical, Family, Other) and track real-time statuses (`Pending`, `Approved`, `Rejected`, `Paid`).
- **Passbook / Salary Ledger:** Chronological passbook showing exact additions (`+`) and subtractions (`-`) with running balances. Tap any entry to see full calculation details.
- **Salary Transparency & Disputes:** File instant clarification requests if an attendance entry or deduction is disputed. Owner receives immediate notification.
- **Multilingual Support:** English, Hindi (हिंदी), and Marathi (मराठी) ready.

---

## 📐 Invariant Financial Accounting Rules

The engine strictly enforces the user invariant formula:

$$\text{Salary Payable} = \text{Gross Earnings} - \text{Unpaid Leave Deductions} - \text{Other Valid Deductions} - \text{Recoverable Advances (Not Yet Repaid)} - \text{Salary Already Paid}$$

1. **Daily Rate Formula:**
   - Monthly: $\text{Daily Rate} = \frac{\text{Base Rate}}{\text{Configured Divisor (e.g. 30 or 26)}}$
   - Daily: $\text{Daily Rate} = \text{Base Rate}$
2. **Never Deduct Advances Twice:**
   - Advances are categorized as `active` or `settled`. Once settled in a payroll repayment, they are never subtracted again.
3. **Approved vs Given:**
   - Approving an advance request does **NOT** alter the ledger balance. Only physically disbursed money alters worker balances.
4. **Non-Recoverable Protection:**
   - Expense reimbursements and festival gifts are explicitly flagged `isRecoverable = false`, preventing wrongful salary deductions.
5. **No Double Deduction on Absences:**
   - Automatically prevents subtracting both an attendance absence and an unpaid leave deduction for the same day.

---

## 🛠️ Tech Stack & Architecture

- **Mobile Client:** React Native with Expo (SDK 57), React 19, TypeScript
- **State Management & Calculations:** Pure TypeScript `SalaryEngine` with exhaustive mathematical invariants
- **Database & Backend:** Supabase (PostgreSQL 15) with Row-Level Security (RLS) policies, Realtime websockets, and audit logging
- **Export Engine:** Native CSV generator and printable HTML/PDF salary slips
- **Testing:** Vitest automated test suite

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js v18+ (tested on Node v24.19)
- npm or yarn

### 2. Installation
```bash
# Clone the repository
git clone https://github.com/your-username/silly-archimedes.git
cd silly-archimedes

# Install dependencies
npm install
```

### 3. Run Automated Tests
```bash
npm test
```
All 14 tests across the Salary Engine and Database/Ledger Invariant suites run in milliseconds.

### 4. Start the Application
```bash
# Start Expo development server (Web, Android, iOS)
npm start

# Or open directly in Web browser
npm run web
```

---

## 👥 Demo Logins & Pre-Seeded Profiles

The app is pre-configured with realistic Indian enterprise demo data. Use the toggle at the top of the header to instantly switch between **Owner** and **Labour** perspectives:

### Owner Profile
- **Business:** Sharma Construction & Interiors, Pune
- **Owner Name:** Ramesh Sharma (`+919822011223`)
- **Role:** `owner`

### Worker Profiles (Labour App)
Switch the worker selector pill in Labour view to test each perspective:

| Employee Code | Name | Role | Wage Plan | Divisor | Mobile PIN |
|---|---|---|---|---|---|
| **EMP-101** | Manoj Kumar | Carpenter | ₹18,000 / month | 30 Days | `1234` |
| **EMP-102** | Suresh Yadav | Senior Mason | ₹850 / day | Daily | `1234` |
| **EMP-103** | Bablu Paswan | Site Helper | ₹14,000 / month | 30 Days | `1234` |
| **EMP-104** | Anil Verma | Welder & Fabricator | ₹22,000 / month | 26 Days | `1234` |

---

## 🗄️ Database Setup & Supabase Migrations

1. Create a project in [Supabase](https://supabase.com).
2. Open the **SQL Editor** in your Supabase dashboard.
3. Run the schema migration located at:
   ```
   supabase/migrations/20261021_initial_schema.sql
   ```
4. Run the seed data script:
   ```
   supabase/seed.sql
   ```
5. Copy your project URL and anon public key into `.env`:
   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ```

---

## 📱 Android Build Instructions (APK / AAB)

### Option A: Cloud Build using Expo Application Services (EAS)
```bash
# Install EAS CLI
npm install -g eas-cli

# Login to Expo
eas login

# Configure EAS Build
eas build:configure

# Build standalone Android APK for direct installation
eas build -p android --profile preview

# Build production Android App Bundle (AAB) for Google Play
eas build -p android --profile production
```

### Option B: Local Android Build
```bash
# Generate native android project folders
npx expo prebuild

# Build release APK using Gradle
cd android
./gradlew assembleRelease
# The APK will be generated at: android/app/build/outputs/apk/release/app-release.apk
```

---

## 🧪 Verification & Test Results

The mathematical rules and accounting invariants were verified using automated tests:

```
 RUN  v2.1.9 C:/Users/rishi/Documents/antigravity/silly-archimedes

 ✓ __tests__/salaryEngine.test.ts (10 tests)
   ✓ calculates the exact daily rate with configurable divisor
   ✓ correctly calculates unpaid leave deduction as per project example (₹18,000 base, 30 days divisor, 2 unpaid leaves = ₹1,200 deduction)
   ✓ handles half-day deduction correctly (0.5 * dailyRate)
   ✓ only counts money as an advance when it is actually disbursed (approving a request alone must not alter balance)
   ✓ accurately applies small money disbursements (₹50, ₹100, ₹200, ₹500)
   ✓ does NOT deduct non-recoverable payments (e.g. festival bonus, travel reimbursement) from salary payable
   ✓ NEVER subtracts the same advance twice if it was already settled in a prior repayment
   ✓ supports partial salary payments (installments) and marks settled only when balance is zero
   ✓ correctly calculates daily wage workers (₹850/day * days worked)
   ✓ generates a consistent chronological ledger with running balance
 ✓ __tests__/databaseAndLedgerInvariants.test.ts (4 tests)
   ✓ correctly aggregates owner dashboard stats across all workers
   ✓ handles the full lifecycle of an advance request: pending -> approved -> disbursed -> settled
   ✓ allows attendance correction with audit reason and recalculates salary deductions accordingly
   ✓ supports dispute and clarification submission and owner reply

 Test Files  2 passed (2)
      Tests  14 passed (14)
   Duration  722ms
```
