export const DDL = `
  CREATE TABLE IF NOT EXISTS customers (
    id            serial PRIMARY KEY,
    customer_code text NOT NULL UNIQUE,
    first_name    text,
    last_name     text,
    phone         text,
    email         text
  );

  CREATE TABLE IF NOT EXISTS items (
    id          serial PRIMARY KEY,
    item_num    text NOT NULL UNIQUE,
    description text
  );

  CREATE TABLE IF NOT EXISTS addresses (
    id            serial PRIMARY KEY,
    customer_id   integer NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
    address_type  text,
    full_name     text,
    address_line1 text,
    address_line2 text,
    country_code  text
  );

  CREATE TABLE IF NOT EXISTS orders (
    id            serial PRIMARY KEY,
    reference_num text NOT NULL UNIQUE,
    customer_id   integer NOT NULL REFERENCES customers(id),
    address_id    integer NOT NULL REFERENCES addresses(id),
    seq           integer,
    created_at    timestamptz NOT NULL DEFAULT now()
  );

  CREATE TABLE IF NOT EXISTS order_lines (
    id       serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    item_id  integer NOT NULL REFERENCES items(id),
    seq      integer
  );
`;
