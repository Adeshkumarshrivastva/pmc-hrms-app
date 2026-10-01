export const TZ = "Asia/Kolkata";

export const COMPANY = {
  /** Printed at the top of every salary slip. */
  name: "Positive Mind Care and Research Centre Pvt. Ltd.",
  /** Printed above "Authorised Signatory". */
  signatory: "Positive Mind Care and Research Centre",
  address: "Your company address, City, State - PIN",
};

export const RULES = {
  /** Shift start in "HH:mm" (IST). Punch-ins after start + grace are marked late. */
  shiftStart: "10:00",
  lateGraceMinutes: 0,
  /** Hours worked for a full day / half day credit. */
  fullDayHours: 8,
  halfDayHours: 4,
  /** Weekly off days (0 = Sunday ... 6 = Saturday). */
  weeklyOff: [0],
  /** Provident fund as a percent of basic salary (for employees with PF enabled). */
  pfPercent: 12,
  /** Paid leave days per calendar year (one pool for everyone). Unpaid leave has no limit. */
  paidLeavePerYear: 12,
  /** Overtime = hours beyond a full day (or all hours on an off day), paid at hourly rate x multiplier. */
  overtimeMultiplier: 1.5,
  overtimeMinMinutes: 60,
};
