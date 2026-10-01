export type Role = "ADMIN" | "EMPLOYEE";

export type Employee = {
  id: number;
  emp_code: string;
  name: string;
  email: string;
  phone: string;
  role: Role;
  designation: string;
  department: string;
  join_date: string;
  pan: string;
  uan: string;
  bank_name: string;
  bank_account: string;
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  special: number;
  pf_enabled: number;
  /** Fixed monthly deductions */
  professional_tax: number;
  esi: number;
  tds: number;
  ot_enabled: number;
  /** Admin switch: 1 = phone location is watched while punched in (optional for older records). */
  track_location?: number; // 0 = admin switched it off; anything else = on
  active: number;
};

export type Attendance = {
  id: number;
  employee_id: number;
  date: string;
  punch_in: string;
  punch_out: string | null;
  note: string;
};

export type LeaveType = "CASUAL" | "SICK" | "EARNED" | "UNPAID";
export type LeaveStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

export const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  // Older requests may be stored as SICK / EARNED; all of them draw from the same paid-leave pool.
  CASUAL: "Paid Leave",
  SICK: "Paid Leave",
  EARNED: "Paid Leave",
  UNPAID: "Unpaid Leave",
};

export type LeaveRequest = {
  id: number;
  employee_id: number;
  type: LeaveType;
  start_date: string;
  end_date: string;
  half_day: number;
  days: number;
  reason: string;
  status: LeaveStatus;
  applied_at: string;
  decided_at: string | null;
  admin_note: string;
  emp_name: string;
  emp_code: string;
};

export type RegStatus = "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";

/** An employee's request to fix a missing/wrong punch for one day. */
export type Regularization = {
  id: number;
  employee_id: number;
  date: string;
  punch_in: string;
  punch_out: string | null;
  reason: string;
  status: RegStatus;
  applied_at: string;
  decided_at: string | null;
  admin_note: string;
  emp_name: string;
  emp_code: string;
};

export type Holiday = { date: string; name: string };

export type Payslip = {
  id: number;
  employee_id: number;
  month: string;
  emp_code: string;
  emp_name: string;
  designation: string;
  department: string;
  working_days: number;
  paid_days: number;
  lop_days: number;
  paid_leave_days: number;
  holidays: number;
  present_days: number;
  weekly_offs: number;
  leave_taken: number;
  per_day: number;
  overtime_hours: number;
  pan: string;
  uan: string;
  bank_name: string;
  bank_account: string;
  basic: number;
  hra: number;
  conveyance: number;
  medical: number;
  special: number;
  gross: number;
  overtime_pay: number;
  lop_deduction: number;
  pf: number;
  professional_tax: number;
  esi: number;
  tds: number;
  net: number;
  /** Optional custom "amount in words"; blank/absent means derive it from `net`. */
  net_words?: string;
  generated_at: string;
};

/** Latest phone location of a punched-in employee, plus the punch-in spot it is measured from. */
export type LocationPing = {
  employee_id: number;
  date: string;
  lat: number;
  lng: number;
  base_lat: number;
  base_lng: number;
  distance_m: number;
  accuracy_m: number;
  at: string;
};
