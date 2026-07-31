import { sql, initDb } from "./db.ts";
import { parseOrders } from "./parser.ts";
import { importOrders } from "./importer.ts";
import { listOrders, getOrder } from "./editor.ts";
import type { OrderDetail } from "./types.ts";

const USAGE = `usage: node app/main.ts <command>

  init-db          create the schema
  import <file>    import orders from an XML file
  list             list all orders
  show <ref>       show one order in full`;

const dim = (value: string) => `\x1b[2m${value}\x1b[0m`;
const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;
const shown = (value: unknown) => (value === null || value === undefined ? "-" : String(value));

function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]!.length)),
  );
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");

  console.log(bold(line(headers)));
  console.log(dim(widths.map((width) => "-".repeat(width)).join("  ")));
  for (const row of rows) console.log(line(row));
}

function field(label: string, value: unknown) {
  console.log(`  ${label.padEnd(12)}${shown(value)}`);
}

function showOrder(order: OrderDetail) {
  console.log(bold(`Order ${order.reference_num}`));
  field("seq", order.seq);
  field("created", order.created_at.toISOString().slice(0, 16).replace("T", " "));

  console.log(bold("\nAddress"));
  field("full name", order.address.full_name);
  field("type", order.address.address_type);
  field("line 1", order.address.address_line1);
  field("line 2", order.address.address_line2);
  field("country", order.address.country_code);

  console.log(bold("\nCustomer") + dim(" (read-only, not editable)"));
  console.log(
    dim(
      [
        `  code        ${shown(order.customer.customer_code)}`,
        `  name        ${shown(order.customer.first_name)} ${shown(order.customer.last_name)}`,
        `  phone       ${shown(order.customer.phone)}`,
        `  email       ${shown(order.customer.email)}`,
      ].join("\n"),
    ),
  );

  console.log(bold("\nLines"));
  if (order.lines.length === 0) {
    console.log(dim("  none"));
    return;
  }
  table(
    ["#", "seq", "item", "description"],
    order.lines.map((line, i) => [
      String(i + 1),
      shown(line.seq),
      line.item_num,
      shown(line.description),
    ]),
  );
}

const [command, argument] = process.argv.slice(2);

try {
  switch (command) {
    case "init-db": {
      await initDb();
      console.log("schema created");
      break;
    }

    case "import": {
      if (!argument) throw new Error("import needs a file: node app/main.ts import input.xml");
      const summary = await importOrders(parseOrders(argument));
      table(
        ["order", "status"],
        summary.orders.map((order) => [order.reference_num, order.status]),
      );
      console.log(bold("\nRows"));
      for (const [name, count] of Object.entries(summary.counts)) field(name, count);
      break;
    }

    case "list": {
      const orders = await listOrders();
      if (orders.length === 0) {
        console.log("no orders");
        break;
      }
      table(
        ["reference", "customer", "country", "lines"],
        orders.map((order) => [
          order.reference_num,
          shown(order.customer_name),
          shown(order.country_code),
          String(order.line_count),
        ]),
      );
      break;
    }

    case "show": {
      if (!argument) throw new Error("show needs a reference number: node app/main.ts show o1234567");
      const order = await getOrder(argument);
      if (!order) {
        console.error(`no order found with reference number ${argument}`);
        process.exitCode = 1;
        break;
      }
      showOrder(order);
      break;
    }

    default:
      console.error(USAGE);
      process.exitCode = 1;
  }
} catch (error) {
  console.error((error as Error).message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
