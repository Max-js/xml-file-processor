import { sql, initDb } from "./db.ts";

const [command] = process.argv.slice(2);

try {
  switch (command) {
    case "init-db":
      await initDb();
      console.log("schema created");
      break;
    default:
      console.error("usage: node app/main.ts init-db");
      process.exitCode = 1;
  }
} finally {
  await sql.end();
}
