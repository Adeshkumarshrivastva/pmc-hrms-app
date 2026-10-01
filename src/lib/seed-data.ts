import type { Employee, Holiday } from "./types";

type Pay = [basic: number, hra: number, conveyance: number, medical: number, special: number];

const emp = (
  id: number, name: string, email: string, phone: string, role: "ADMIN" | "EMPLOYEE", designation: string,
  department: string, join_date: string, [basic, hra, conveyance, medical, special]: Pay, pf_enabled: number,
): Employee => ({
  id, emp_code: `PMC/26/${String(id).padStart(2, "0")}`, name, email, phone, role, designation, department, join_date,
  pan: "", uan: "", bank_name: "", bank_account: "",
  basic, hra, conveyance, medical, special, pf_enabled, professional_tax: 0, esi: 0, tds: 0, ot_enabled: 0, active: 1,
});

/** Demo employees used by both the in-memory store and the MongoDB seed. */
export const SEED_EMPLOYEES: Employee[] = [
  emp(1, "Admin", "admin@pmc.com", "9000000001", "ADMIN", "Operations", "Operations", "2024-01-01", [16000, 6400, 1462, 1142, 6996], 0),
  emp(2, "Rahul Sharma", "rahul@pmc.com", "9000000002", "EMPLOYEE", "Software Developer", "Software Developer", "2024-06-10", [20000, 8000, 1600, 1250, 9150], 1),
  emp(3, "Priya Singh", "priya@pmc.com", "9000000003", "EMPLOYEE", "Psychologist", "Psychologist", "2025-02-01", [15000, 6000, 1462, 1142, 4396], 0),
  emp(4, "Amit Verma", "amit@pmc.com", "9000000004", "EMPLOYEE", "Pharmacist", "Pharmacist", "2025-08-15", [14000, 5600, 1462, 1142, 3796], 0),
];

/** Roles at the centre; used for both the Department and Designation dropdowns (admins can add more). */
export const SEED_DEPARTMENTS = ["Software Developer", "Machine Technician", "Psychologist", "Psychiatrist", "Pharmacist", "Sales", "Operations"];
export const SEED_DESIGNATIONS = SEED_DEPARTMENTS;

/** Fixed-date national holidays; add festival dates (Diwali, Holi, Eid...) from the Holidays page. */
export const SEED_HOLIDAYS: Holiday[] = [2026, 2027].flatMap((y) => [
  { date: `${y}-01-26`, name: "Republic Day" },
  { date: `${y}-08-15`, name: "Independence Day" },
  { date: `${y}-10-02`, name: "Gandhi Jayanti" },
  { date: `${y}-12-25`, name: "Christmas" },
]);
