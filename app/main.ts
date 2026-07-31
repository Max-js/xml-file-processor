import { sql, initDb } from "./db.ts";
import { parseOrders } from "./parser.ts";
import { importOrders } from "./importer.ts";
import { listOrders, getOrder } from "./editor.ts";
import { editSession } from "./session.ts";
import { bold, field, shown, showOrder, table } from "./view.ts";

const USAGE = `usage: node app/main.ts <command>

  init-db          create the schema
  import <file>    import orders from an XML file
  list             list all orders
  show <ref>       show one order in full
  edit <ref>       edit an order interactively`;

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

    case "edit": {
      if (!argument) throw new Error("edit needs a reference number: node app/main.ts edit o1234567");
      if (!(await editSession(argument))) process.exitCode = 1;
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
