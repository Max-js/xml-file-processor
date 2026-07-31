import type { OrderDetail } from "./types.ts";

export const dim = (value: string) => `\x1b[2m${value}\x1b[0m`;
export const bold = (value: string) => `\x1b[1m${value}\x1b[0m`;
export const shown = (value: unknown) =>
  value === null || value === undefined || value === "" ? "-" : String(value);

export function table(headers: string[], rows: string[][]) {
  const widths = headers.map((header, i) =>
    Math.max(header.length, ...rows.map((row) => row[i]!.length)),
  );
  const line = (cells: string[]) => cells.map((cell, i) => cell.padEnd(widths[i]!)).join("  ");

  console.log(bold(line(headers)));
  console.log(dim(widths.map((width) => "-".repeat(width)).join("  ")));
  for (const row of rows) console.log(line(row));
}

export function field(label: string, value: unknown) {
  console.log(`  ${label.padEnd(12)}${shown(value)}`);
}

export function showLines(order: OrderDetail) {
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

export function showOrder(order: OrderDetail) {
  console.log(bold(`Order ${order.reference_num}`));
  field("seq", order.seq);
  field("created", order.created_at.toISOString().slice(0, 16).replace("T", " "));

  console.log(bold("\nAddress"));
  field("full name", order.address.full_name);
  field("type", order.address.address_type);
  field("line 1", order.address.address_line1);
  field("line 2", order.address.address_line2);
  field("country", order.address.country_code);

  console.log(bold("\nCustomer") + dim(" (read-only)"));
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
  showLines(order);
}
