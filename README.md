# PMC Attendance

Employee attendance (punch in / punch out) and salary slips, built with Next.js 16, TypeScript, Tailwind CSS 4 and MongoDB (official `mongodb` driver).

## Run

```bash
npm install
cp .env.example .env.local   # set AUTH_SECRET (long random string) and MONGODB_URI
npm run dev                  # http://localhost:3000
```

**Static mode (default):** with no `MONGODB_URI` the app runs on in-memory demo data (`src/lib/queries.memory.ts`) - nothing to install; data is saved to `data/static-data.json` so it survives restarts (delete that file to start over), and a new mobile number can log in (OTP, then it asks for your name once and creates an Admin account with that name). Demo employees: 9000000001 (admin), 9000000002 / 03 / 04.

**MongoDB mode:** set `MONGODB_URI` (local `mongodb://127.0.0.1:27017` or an Atlas `mongodb+srv://...` string) and optionally `MONGODB_DB` in `.env.local`. Everything switches over with no code changes; only registered numbers can log in. Database `pmc-attendance`, its indexes and the demo data are created on first request. Collections: `employees`, `attendance`, `payslips`, `holidays`, `leave_requests`, `counters`.

Login is by mobile number + OTP. **The OTP is hard-coded to `628791` for every number** (see `src/lib/otp.ts`) until an SMS provider is connected.

## Features

- **Employees**: login, live-clock Punch In / Punch Out once per day, monthly attendance (late marks, hours, overtime), leave balance and requests, holiday list, own salary slips (view, print, PDF).
- **Leave management**: Casual / Sick / Earned (yearly quota) and Unpaid leave, half-day leave, overlap and balance checks, admin approve / reject / revoke with a note. Approved paid leave counts as a paid day in payroll; unpaid leave is LOP.
- **Holidays**: admin manages the calendar (fixed national holidays are pre-seeded; add festivals yourself). Holidays are paid and are not working days.
- **Setup & reports**: department / designation dropdowns (with "Add new" right on the employee form, plus a manage page), employee search and filters, a printable monthly attendance report, and attendance-correction requests (employee asks, admin approves, attendance is updated).
- **Admin**: dashboard of who's in today, employees and salary structure, correct or add missing punches, payroll per month, generate salary slips.
- **Salary slip**: follows the company template (Adesh-Salary-Slip.docx): employee info (PAN, UAN, bank), attendance & leave details, earnings (Basic, HRA, Conveyance, Medical, Special), deductions (LOP, EPF, Professional Tax, ESI, TDS), net pay in words. Shown on screen and downloaded as a read-only **PDF** (fonts in `assets/fonts`). Stored as a snapshot so later edits do not change past slips.

## Rules (edit in `src/lib/config.ts`)

- Timezone IST, shift 09:30 with 15 min grace (later = "late"). Sunday is the weekly off.
- >= 8h = full day, >= 4h = half day, otherwise absent. Punch-in without punch-out = unpaid until an admin fixes it.
- Leave quota per year: Casual 12, Sick 6, Earned 12. Weekly offs and holidays don't use up leave.
- Gross = Basic + HRA + Conveyance + Medical + Special. Per-day salary = gross / days in the month; LOP deduction = per-day x unpaid days; Total payable days = days in month - LOP days. PF = 12% of earned basic (per-employee toggle); Professional Tax, ESI, TDS are fixed monthly amounts on the employee.
- Overtime (per-employee toggle "Pay overtime"): hours beyond 8h on a working day, or all hours on a Sunday/holiday, when at least 60 min; paid at (gross / working days / 8) x 1.5.

## Layout

- `src/lib/` — `db.ts` (schema + seed), `queries.ts`, `auth.ts` (signed cookie session), `payroll.ts` (attendance → salary), `dates.ts`, `config.ts`
- `src/app/actions.ts` — all server actions (login, punch, employees, attendance edits, payroll)
- `src/app/(app)/` — authenticated pages; `src/proxy.ts` sends visitors without a session to `/login`
