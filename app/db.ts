import postgres from "postgres";
import { DDL } from "./schema.ts";

const { DATABASE_URL } = process.env;
if (!DATABASE_URL) throw new Error("DATABASE_URL is not set; copy .env.example to .env");

export const sql = postgres(DATABASE_URL);

export async function initDb() {
  await sql.unsafe(DDL);
}
