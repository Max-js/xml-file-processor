# xml-file-processor

Imports orders from an XML file into PostgreSQL and edits them from the terminal.

## Requirements

- Node 22.18 or newer: https://nodejs.org/en/download
- Docker for PostgreSQL: https://docs.docker.com/desktop/

## Setup

1. Run `npm ci`
2. Copy the Database url from `.env.example` to a `.env` file
3. Run `npm run setup` which initializes the DB and imports the `input.xml` file

The schema is created by `init-db`.

## Commands

`npm run init-db` => Create the five tables. Safe to re-run.  
`npm run import <file>` => Import orders from an XML file.  
`npm run list` => List all orders.  
`npm run show <ref>` => Show one order in full.  
`npm run edit <ref>` => Edit an order interactively.  

### import

```sh
npm run import input.xml
```

```
order     status
--------  --------
o1234567  inserted
o1234888  inserted
o1234999  inserted
o1234555  inserted

Rows
  customers   3
  items       5
  addresses   4
  orders      4
  order_lines 6
```

Every order reports `inserted`, `updated`, or `unchanged`. Re-importing the same file changes
nothing and reports all four as `unchanged`. The whole file imports in one transaction: if any
order fails, nothing is written and the error names the order.

### list

```sh
npm run list
```

```
reference  customer   country  lines
---------  ---------  -------  -----
o1234555   Luke Mac   IRL      2
o1234567   John Hope  IRL      2
o1234888   Luke Mac   IRL      1
o1234999   Alan Key   USA      1
```

### show

```sh
npm run show o1234567
```

```
Order o1234555
  seq         3
  created     2026-07-31 10:39

Address
  full name   Place rrr
  type        Private
  line 1      2A, Airport Business Park
  line 2      Cloghran, Swords, Co. Dublin
  country     IRL

Customer (read-only)
  code        KM-02
  name        Luke Mac
  phone       +35312345678
  email       luke@xyz.com

Lines
  #  seq  item     description
  -  ---  -------  -----------
  1  1    R457740  iMac       
  2  1    R457734  iPad Mini  

```

### edit

```sh
npm run edit o1234567
```

Opens an interactive session. The order is displayed, then a numbered menu:

```
Edit
  1  reference number o1234567
  2  full name        Office A
  3  address type     Private
  4  address line 1   1A, Airport Business Park
  5  address line 2   Cloghran, Swords, Co. Dublin
  6  country code     IRL
  l  lines            2
  s  save        q  quit
```

Pick a number to edit that field; the current value is shown first, and blank input leaves it
unchanged. `l` opens the lines sub-menu, which can add a line, change which item a line points
at, or delete a line.

Edits are buffered in memory and marked with `*`. Nothing reaches the database until `s`.
`q` discards, asking to confirm if there are unsaved changes. Customer details are not
editable. Saving a reference number already used by another order is rejected, and the session
stays open.

## Schema

```
customers ──< addresses          an address belongs to a customer
customers ──< orders
orders    >── addresses          an order points at one of its customer's addresses
orders    ──< order_lines
items     ──< order_lines
```

| Table | Columns |
| --- | --- |
| `customers` | `customer_code` (unique), first/last name, phone, email |
| `items` | `item_num` (unique), description |
| `addresses` | → `customers`, address type, full name, two address lines, `country_code` |
| `orders` | `reference_num` (unique), → `customers`, → `addresses`, `seq`, `created_at` |
| `order_lines` | → `orders`, → `items`, `seq` |

`addresses` and `order_lines` cascade on delete, since neither can outlive its parent.

## Layout

```
app/main.ts      command dispatch
app/schema.ts    CREATE TABLE DDL
app/db.ts        Postgres client
app/parser.ts    XML in, plain objects out; no database access
app/importer.ts  parsed objects to database
app/editor.ts    queries and mutations; no terminal output
app/session.ts   interactive edit loop
app/view.ts      rendering helpers
app/types.ts     row, parsed, and query-result shapes
```
