import type { TransactionSql } from "postgres";
import { sql } from "./db.ts";
import type {
  Address,
  Customer,
  OrderDetail,
  OrderDetailLine,
  OrderSummary,
} from "./types.ts";

export async function listOrders(): Promise<OrderSummary[]> {
  return sql<OrderSummary[]>`
    select o.reference_num,
           nullif(trim(concat_ws(' ', c.first_name, c.last_name)), '') as customer_name,
           a.country_code,
           count(ol.id)::int as line_count
      from orders o
      join customers c on c.id = o.customer_id
      join addresses a on a.id = o.address_id
      left join order_lines ol on ol.order_id = o.id
     group by o.id, c.first_name, c.last_name, a.country_code
     order by o.reference_num`;
}

// Returns null rather than raising when the reference number is unknown.
export async function getOrder(referenceNum: string): Promise<OrderDetail | null> {
  const [header] = await sql<
    (Omit<OrderDetail, "customer" | "address" | "lines"> & {
      customer: Customer;
      address: Address;
    })[]
  >`
    select o.id, o.reference_num, o.seq, o.created_at,
           to_jsonb(c.*) as customer,
           to_jsonb(a.*) as address
      from orders o
      join customers c on c.id = o.customer_id
      join addresses a on a.id = o.address_id
     where o.reference_num = ${referenceNum}`;
  if (!header) return null;

  const lines = await sql<OrderDetailLine[]>`
    select ol.id, ol.seq, i.item_num, i.description
      from order_lines ol
      join items i on i.id = ol.item_id
     where ol.order_id = ${header.id}
     order by ol.id`;

  return { ...header, lines: [...lines] };
}

export async function updateReferenceNum(orderId: number, referenceNum: string) {
  const [clash] = await sql`
    select 1 from orders where reference_num = ${referenceNum} and id <> ${orderId}`;
  if (clash) throw new Error(`reference number ${referenceNum} is already used by another order`);

  await sql`update orders set reference_num = ${referenceNum} where id = ${orderId}`;
}

export async function updateAddress(addressId: number, fields: Partial<Omit<Address, "id" | "customer_id">>) {
  const columns = Object.keys(fields) as (keyof typeof fields)[];
  if (columns.length === 0) return;
  await sql`update addresses set ${sql(fields, ...columns)} where id = ${addressId}`;
}

async function itemIdOf(tx: TransactionSql, itemNum: string): Promise<number> {
  const [item] = await tx<{ id: number }[]>`select id from items where item_num = ${itemNum}`;
  if (!item) throw new Error(`unknown item ${itemNum}`);
  return item.id;
}

//INFO: New added item has no seq, so it is set to null.
export async function addLine(orderId: number, itemNum: string) {
  await sql.begin(async (tx) => {
    const itemId = await itemIdOf(tx, itemNum);
    await tx`insert into order_lines (order_id, item_id) values (${orderId}, ${itemId})`;
  });
}

export async function changeLineItem(lineId: number, itemNum: string) {
  await sql.begin(async (tx) => {
    const itemId = await itemIdOf(tx, itemNum);
    await tx`update order_lines set item_id = ${itemId} where id = ${lineId}`;
  });
}

export async function deleteLine(lineId: number) {
  await sql`delete from order_lines where id = ${lineId}`;
}
