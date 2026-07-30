import { readFileSync } from "node:fs";
import { XMLParser } from "fast-xml-parser";
import type { ParsedAddress, ParsedCustomer, ParsedOrder, ParsedOrderLine } from "./types.ts";

const parser = new XMLParser({
  ignoreAttributes: false,
  isArray: (_name, jpath) =>
    jpath === "TransactionRequest.Orders.Order" ||
    jpath === "TransactionRequest.Orders.Order.OrderLines.OrderLine",
  //INFO: Prevents type coersions during import
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: false,
});

function text(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function required(value: unknown, field: string, where: string): string {
  const found = text(value);
  if (found === null) throw new Error(`${where}: ${field} is missing or empty`);
  return found;
}

//INFO: Parse seq value to int, or null if non-numeric
function seq(value: unknown): number | null {
  const found = text(value);
  if (found === null) return null;
  const parsed = Number(found);
  return Number.isInteger(parsed) ? parsed : null;
}

function customerOf(raw: any, where: string): ParsedCustomer {
  return {
    customer_code: required(raw?.CustomerCode, "CustomerCode", where),
    first_name: text(raw?.FirstName),
    last_name: text(raw?.LastName),
    phone: text(raw?.Phone),
    email: text(raw?.Email),
  };
}

function addressOf(raw: any, countryCode: unknown): ParsedAddress {
  return {
    address_type: text(raw?.AddressType),
    full_name: text(raw?.FullName),
    address_line1: text(raw?.AddressLine1),
    address_line2: text(raw?.AddressLine2),
    country_code: text(countryCode),
  };
}

function orderLineOf(raw: any, where: string, position: number): ParsedOrderLine {
  return {
    item_num: required(raw?.ItemNum, "ItemNum", `${where} line ${position}`),
    item_description: text(raw?.ItemDescription),
  };
}

export function parseOrders(path: string): ParsedOrder[] {
  const root = parser.parse(readFileSync(path, "utf8"));
  const orders: any[] = root?.TransactionRequest?.Orders?.Order ?? [];

  return orders.map((order, index) => {
    const where = text(order?.ReferenceNum) ?? `order ${index + 1}`;
    return {
      reference_num: required(order?.ReferenceNum, "ReferenceNum", where),
      seq: seq(order?.["@_seq"]),
      customer: customerOf(order?.Customer, where),
      address: addressOf(order?.Address, order?.CountryCode),
      lines: (order?.OrderLines?.OrderLine ?? []).map((line: any, i: number) =>
        orderLineOf(line, where, i + 1),
      ),
    };
  });
}
