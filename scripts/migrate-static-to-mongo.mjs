// Copies data/static-data.json into MongoDB Atlas (one time).
//   1. put MONGODB_URI (and MONGODB_DB) in .env.local
//   2. node --env-file=.env.local scripts/migrate-static-to-mongo.mjs
// Add --force to overwrite a database that already has employees.
import { readFileSync } from "node:fs";
import { MongoClient } from "mongodb";

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error("MONGODB_URI is not set (remove the # in .env.local and paste your Atlas string)");
const dbName = process.env.MONGODB_DB ?? "pmc-attendance";
const force = process.argv.includes("--force");

const data = JSON.parse(readFileSync(new URL("../data/static-data.json", import.meta.url), "utf8"));
const client = new MongoClient(uri);
await client.connect();
const db = client.db(dbName);

if (!force && (await db.collection("employees").estimatedDocumentCount()) > 0) {
  console.log(`"${dbName}" already has employees. Run again with --force to replace its data.`);
  await client.close();
  process.exit(1);
}

const named = (list) => (list ?? []).map((name) => ({ name }));
const tables = {
  employees: data.employees,
  attendance: data.attendance,
  payslips: data.payslips,
  holidays: data.holidays,
  leave_requests: data.leaves,
  regularizations: data.regs,
  departments: named(data.departments),
  designations: named(data.designations),
};

for (const [name, rows] of Object.entries(tables)) {
  const col = db.collection(name);
  await col.deleteMany({});
  if (rows?.length) await col.insertMany(rows.map((r) => ({ ...r })));
  console.log(`${name}: ${rows?.length ?? 0} copied`);
}

// Auto-increment counters continue after the highest id already used.
const maxId = (rows) => Math.max(0, ...(rows ?? []).map((r) => r.id ?? 0));
const counters = {
  employees: Math.max(data.seq?.employees ?? 0, maxId(data.employees)),
  attendance: Math.max(data.seq?.attendance ?? 0, maxId(data.attendance)),
  payslips: Math.max(data.seq?.payslips ?? 0, maxId(data.payslips)),
  leave_requests: Math.max(data.seq?.leave_requests ?? 0, maxId(data.leaves)),
  regularizations: Math.max(data.seq?.regularizations ?? 0, maxId(data.regs)),
};
for (const [_id, seq] of Object.entries(counters)) {
  await db.collection("counters").updateOne({ _id }, { $set: { seq } }, { upsert: true });
}
console.log("counters:", counters);
await client.close();
console.log("Done.");
