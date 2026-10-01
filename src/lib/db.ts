import { MongoClient, type Db } from "mongodb";
import { SEED_DEPARTMENTS, SEED_DESIGNATIONS, SEED_EMPLOYEES, SEED_HOLIDAYS } from "./seed-data";

const URI = process.env.MONGODB_URI ?? "";

/** No MONGODB_URI => the app runs on the in-memory demo store (see queries.memory.ts). */
export const STATIC_MODE = !URI;
const DB_NAME = process.env.MONGODB_DB ?? "pmc-attendance";

async function seed(db: Db) {
  if ((await db.collection("employees").estimatedDocumentCount()) > 0) return;

  const employees = SEED_EMPLOYEES.map((e) => ({ ...e }));
  try {
    await db.collection("employees").insertMany(employees);
    await db.collection<{ _id: string; seq: number }>("counters").updateOne(
      { _id: "employees" }, { $set: { seq: employees.length } }, { upsert: true },
    );
  } catch (e) {
    // Two requests seeding at once: the unique indexes make the loser fail harmlessly.
    if ((e as { code?: number }).code !== 11000) throw e;
  }
}

async function seedHolidays(db: Db) {
  const holidays = db.collection("holidays");
  if ((await holidays.estimatedDocumentCount()) > 0) return;
  const docs = SEED_HOLIDAYS.map((h) => ({ ...h }));
  try {
    await holidays.insertMany(docs);
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
  }
}

async function seedLookups(db: Db) {
  for (const [collection, values] of [["departments", SEED_DEPARTMENTS], ["designations", SEED_DESIGNATIONS]] as const) {
    if ((await db.collection(collection).estimatedDocumentCount()) > 0) continue;
    try {
      await db.collection(collection).insertMany(values.map((name) => ({ name })));
    } catch (e) {
      if ((e as { code?: number }).code !== 11000) throw e;
    }
  }
}

async function init(): Promise<Db> {
  if (!URI) throw new Error("MONGODB_URI is not set");
  const client = new MongoClient(URI);
  await client.connect();
  const db = client.db(DB_NAME);

  await Promise.all([
    db.collection("employees").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { emp_code: 1 }, unique: true },
      { key: { email: 1 }, unique: true },
      { key: { phone: 1 }, unique: true },
    ]),
    db.collection("attendance").createIndexes([
      { key: { employee_id: 1, date: 1 }, unique: true },
      { key: { date: 1 } },
    ]),
    db.collection("payslips").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { employee_id: 1, month: 1 }, unique: true },
    ]),
    db.collection("holidays").createIndexes([{ key: { date: 1 }, unique: true }]),
    db.collection("departments").createIndexes([{ key: { name: 1 }, unique: true }]),
    db.collection("designations").createIndexes([{ key: { name: 1 }, unique: true }]),
    db.collection("regularizations").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { employee_id: 1, date: 1 } },
    ]),
    db.collection("leave_requests").createIndexes([
      { key: { id: 1 }, unique: true },
      { key: { employee_id: 1, status: 1 } },
    ]),
  ]);
  await seed(db);
  await seedHolidays(db);
  await seedLookups(db);
  return db;
}

// Cached on globalThis so dev hot-reloads reuse one connection pool.
const g = globalThis as unknown as { __mongoDb?: Promise<Db> };

export function getDb(): Promise<Db> {
  if (!g.__mongoDb) {
    g.__mongoDb = init().catch((e) => {
      g.__mongoDb = undefined; // allow a retry on the next request
      throw e;
    });
  }
  return g.__mongoDb;
}

/** Next auto-increment number for a collection (atomic). */
export async function nextId(name: string): Promise<number> {
  const db = await getDb();
  const doc = await db
    .collection<{ _id: string; seq: number }>("counters")
    .findOneAndUpdate({ _id: name }, { $inc: { seq: 1 } }, { upsert: true, returnDocument: "after" });
  return doc!.seq;
}
