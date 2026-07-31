import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import type {
  ImportSummary,
  ParsedAddress,
  ParsedCustomer,
  ParsedOrder,
  ParsedOrderLine,
} from "./types.ts";

type Tx = TransactionSql;

async function upsertCustomer(tx: Tx, customer: ParsedCustomer): Promise<number> {
  const [row] = await tx<{ id: number }[]>`
    insert into customers (customer_code, first_name, last_name, phone, email)
    values (${customer.customer_code}, ${customer.first_name}, ${customer.last_name},
            ${customer.phone}, ${customer.email})
    on conflict (customer_code) do update set
      first_name = excluded.first_name,
      last_name  = excluded.last_name,
      phone      = excluded.phone,
      email      = excluded.email
    returning id`;
  return row!.id;
}

async function upsertItem(tx: Tx, line: ParsedOrderLine): Promise<number> {
  const [row] = await tx<{ id: number }[]>`
    insert into items (item_num, description)
    values (${line.item_num}, ${line.item_description})
    on conflict (item_num) do update set description = excluded.description
    returning id`;
  return row!.id;
}

//INFO: Check if address exists before importing to prevent duplicates
async function resolveAddress(
  tx: Tx,
  customerId: number,
  address: ParsedAddress,
): Promise<number> {
  const [existing] = await tx<{ id: number }[]>`
    select id from addresses
     where customer_id   = ${customerId}
       and address_type  is not distinct from ${address.address_type}
       and full_name     is not distinct from ${address.full_name}
       and address_line1 is not distinct from ${address.address_line1}
       and address_line2 is not distinct from ${address.address_line2}
       and country_code  is not distinct from ${address.country_code}
     limit 1`;
  if (existing) return existing.id;

  const [inserted] = await tx<{ id: number }[]>`
    insert into addresses (customer_id, address_type, full_name, address_line1,
                           address_line2, country_code)
    values (${customerId}, ${address.address_type}, ${address.full_name},
            ${address.address_line1}, ${address.address_line2}, ${address.country_code})
    returning id`;
  return inserted!.id;
}

async function importOrder(tx: Tx, order: ParsedOrder) {
  const customerId = await upsertCustomer(tx, order.customer);
  const addressId = await resolveAddress(tx, customerId, order.address);
  const lines: { itemId: number; seq: number | null }[] = [];
  for (const line of order.lines) {
    lines.push({ itemId: await upsertItem(tx, line), seq: line.seq });
  }

  const [before] = await tx<{ id: number; customer_id: number; address_id: number; seq: number | null }[]>`
    select id, customer_id, address_id, seq from orders
     where reference_num = ${order.reference_num}`;

  let status: "inserted" | "updated" | "unchanged" = "inserted";
  if (before) {
    const existing = await tx<{ item_id: number; seq: number | null }[]>`
      select item_id, seq from order_lines where order_id = ${before.id} order by id`;
    const sameHeader =
      before.customer_id === customerId &&
      before.address_id === addressId &&
      before.seq === order.seq;
    const sameLines =
      existing.length === lines.length &&
      existing.every((row, i) => row.item_id === lines[i]!.itemId && row.seq === lines[i]!.seq);
    status = sameHeader && sameLines ? "unchanged" : "updated";
  }

  const [row] = await tx<{ id: number }[]>`
    insert into orders (reference_num, customer_id, address_id, seq)
    values (${order.reference_num}, ${customerId}, ${addressId}, ${order.seq})
    on conflict (reference_num) do update set
      customer_id = excluded.customer_id,
      address_id  = excluded.address_id,
      seq         = excluded.seq
    returning id`;
  const orderId = row!.id;

  //INFO: Wipe and replace order lines on re-import since orderLines don't have a key for upserting
  await tx`delete from order_lines where order_id = ${orderId}`;
  for (const line of lines) {
    await tx`insert into order_lines (order_id, item_id, seq)
             values (${orderId}, ${line.itemId}, ${line.seq})`;
  }

  return { reference_num: order.reference_num, status };
}

export async function importOrders(orders: ParsedOrder[]): Promise<ImportSummary> {
  return sql.begin(async (tx) => {
    const results = [];
    for (const order of orders) {
      try {
        results.push(await importOrder(tx, order));
      } catch (cause) {
        throw new Error(`failed importing order ${order.reference_num}`, { cause });
      }
    }

    const [counts] = await tx<ImportSummary["counts"][]>`
      select (select count(*) from customers)::int   as customers,
             (select count(*) from items)::int       as items,
             (select count(*) from addresses)::int   as addresses,
             (select count(*) from orders)::int      as orders,
             (select count(*) from order_lines)::int as order_lines`;

    return { orders: results, counts: counts! };
  });
}
