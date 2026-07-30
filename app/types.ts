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
  seq: number;
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
}

export interface ParsedOrder {
  reference_num: string;
  seq: number | null;
  customer: ParsedCustomer;
  address: ParsedAddress;
  lines: ParsedOrderLine[];
}
