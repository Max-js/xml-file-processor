export interface Customer {
  id: number;
  customer_code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

export interface Item {
  id: number;
  item_num: string;
  description: string | null;
}

export interface Order {
  id: number;
  reference_num: string;
  customer_id: number;
  address_id: number;
  seq: number | null;
  created_at: Date;
}

export interface Address {
  id: number;
  customer_id: number;
  address_type: string | null;
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  country_code: string | null;
}

export interface OrderLine {
  id: number;
  order_id: number;
  item_id: number;
  seq: number | null;
}

//INFO:  Parsed shapes, as read from XML
export interface ParsedCustomer {
  customer_code: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  email: string | null;
}

export interface ParsedAddress {
  address_type: string | null;
  full_name: string | null;
  address_line1: string | null;
  address_line2: string | null;
  country_code: string | null;
}

export interface ParsedOrderLine {
  item_num: string;
  item_description: string | null;
  seq: number | null;
}

export interface ParsedOrder {
  reference_num: string;
  seq: number | null;
  customer: ParsedCustomer;
  address: ParsedAddress;
  lines: ParsedOrderLine[];
}

export interface ImportSummary {
  orders: { reference_num: string; status: "inserted" | "updated" | "unchanged" }[];
  counts: {
    customers: number;
    items: number;
    addresses: number;
    orders: number;
    order_lines: number;
  };
}

//INFO: CLI query results

export interface OrderSummary {
  reference_num: string;
  customer_name: string | null;
  country_code: string | null;
  line_count: number;
}

export interface OrderDetailLine {
  id: number;
  seq: number | null;
  item_num: string;
  description: string | null;
}

export interface OrderDetail {
  id: number;
  reference_num: string;
  seq: number | null;
  created_at: Date;
  customer: Customer;
  address: Address;
  lines: OrderDetailLine[];
}