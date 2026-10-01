import { STATIC_MODE } from "./db";
import * as mongo from "./queries.mongo";
import * as memory from "./queries.memory";
import * as extrasMongo from "./extras.mongo";
import * as extrasMemory from "./extras.memory";

/**
 * Data access facade. Without MONGODB_URI the app runs on the in-memory store (static demo data);
 * set MONGODB_URI in .env.local to switch everything to MongoDB. Both backends export the same functions.
 */
const q: typeof mongo = STATIC_MODE ? memory : mongo;

const x: typeof extrasMongo = STATIC_MODE ? extrasMemory : extrasMongo;

export type { EmployeeInput } from "./queries.mongo";

export const getEmployee = q.getEmployee;
export const getEmployeeByEmail = q.getEmployeeByEmail;
export const getEmployeeByPhone = q.getEmployeeByPhone;
export const listEmployees = q.listEmployees;
export const insertEmployee = q.insertEmployee;
export const updateEmployee = q.updateEmployee;

export const getAttendance = q.getAttendance;
export const listAttendanceForMonth = q.listAttendanceForMonth;
export const listAttendanceForDate = q.listAttendanceForDate;
export const punchIn = q.punchIn;
export const punchOut = q.punchOut;
export const upsertAttendance = q.upsertAttendance;
export const deleteAttendance = q.deleteAttendance;

export const getPayslip = q.getPayslip;
export const listPayslips = q.listPayslips;
export const savePayslip = q.savePayslip;

export const listHolidays = q.listHolidays;
export const holidaysBetween = q.holidaysBetween;
export const addHoliday = q.addHoliday;
export const deleteHoliday = q.deleteHoliday;

export const getLeave = q.getLeave;
export const listLeaves = q.listLeaves;
export const listLeavesOverlapping = q.listLeavesOverlapping;
export const leaveDaysUsed = q.leaveDaysUsed;
export const insertLeave = q.insertLeave;
export const setLeaveStatus = q.setLeaveStatus;
export const countPendingLeaves = q.countPendingLeaves;

export const listDepartments = x.listDepartments;
export const addDepartment = x.addDepartment;
export const deleteDepartment = x.deleteDepartment;
export const listDesignations = x.listDesignations;
export const addDesignation = x.addDesignation;
export const deleteDesignation = x.deleteDesignation;

export const getRegularization = x.getRegularization;
export const listRegularizations = x.listRegularizations;
export const hasPendingRegularization = x.hasPendingRegularization;
export const insertRegularization = x.insertRegularization;
export const setRegularizationStatus = x.setRegularizationStatus;
export const countPendingRegularizations = x.countPendingRegularizations;

export const saveLocation = x.saveLocation;
export const listLocations = x.listLocations;
export const clearLocation = x.clearLocation;
