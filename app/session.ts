import { createInterface } from "node:readline/promises";
import { getOrder, updateAddress, updateReferenceNum } from "./editor.ts";
import { bold, dim, shown, showOrder } from "./view.ts";
import type { Address, OrderDetail } from "./types.ts";

type AddressField = keyof Pick<
  Address,
  "full_name" | "address_type" | "address_line1" | "address_line2" | "country_code"
>;

const ADDRESS_FIELDS: { label: string; key: AddressField }[] = [
  { label: "full name", key: "full_name" },
  { label: "address type", key: "address_type" },
  { label: "address line 1", key: "address_line1" },
  { label: "address line 2", key: "address_line2" },
  { label: "country code", key: "country_code" },
];

//INFO: Buffering edits until saved
interface Draft {
  reference_num: string;
  address: Record<AddressField, string | null>;
}

function draftOf(order: OrderDetail): Draft {
  return {
    reference_num: order.reference_num,
    address: Object.fromEntries(
      ADDRESS_FIELDS.map(({ key }) => [key, order.address[key]]),
    ) as Draft["address"],
  };
}

function changes(draft: Draft, original: Draft) {
  const address = ADDRESS_FIELDS.map(({ key }) => key).filter(
    (key) => draft.address[key] !== original.address[key],
  );
  return { reference: draft.reference_num !== original.reference_num, address };
}

function menu(draft: Draft, original: Draft) {
  const mark = (changed: boolean) => (changed ? bold(" *") : "");
  const { reference, address } = changes(draft, original);

  console.log(bold("\nEdit"));
  console.log(`  1  ${"reference number".padEnd(17)}${shown(draft.reference_num)}${mark(reference)}`);
  ADDRESS_FIELDS.forEach(({ label, key }, i) => {
    console.log(
      `  ${i + 2}  ${label.padEnd(17)}${shown(draft.address[key])}${mark(address.includes(key))}`,
    );
  });
  console.log(dim("  s  save        q  quit"));
}

export type Ask = (prompt: string) => Promise<string>;

function readlineAsk(): { ask: Ask; close: () => void } {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return { ask: (prompt) => rl.question(prompt), close: () => rl.close() };
}

export async function editSession(
  referenceNum: string,
  io: { ask: Ask; close: () => void } = readlineAsk(),
): Promise<boolean> {
  const order = await getOrder(referenceNum);
  if (!order) {
    io.close();
    console.error(`no order found with reference number ${referenceNum}`);
    return false;
  }

  const original = draftOf(order);
  const draft = draftOf(order);

  showOrder(order);

  try {
    for (;;) {
      menu(draft, original);
      const choice = (await io.ask("> ")).trim().toLowerCase();

      if (choice === "q") {
        const { reference, address } = changes(draft, original);
        if (!reference && address.length === 0) return true;
        const confirm = (await io.ask("discard unsaved changes? (y/n) ")).trim().toLowerCase();
        if (confirm === "y") {
          console.log("changes discarded");
          return true;
        }
        continue;
      }

      if (choice === "s") {
        const { reference, address } = changes(draft, original);
        if (!reference && address.length === 0) {
          console.log("nothing to save");
          continue;
        }
        try {
          if (reference) await updateReferenceNum(order.id, draft.reference_num);
          if (address.length > 0) {
            await updateAddress(
              order.address.id,
              Object.fromEntries(address.map((key) => [key, draft.address[key]])),
            );
          }
        } catch (error) {
          // A reference-number collision keeps the session open.
          console.error((error as Error).message);
          continue;
        }
        console.log("saved");
        return true;
      }

      const index = Number(choice);
      if (!Number.isInteger(index) || index < 1 || index > ADDRESS_FIELDS.length + 1) {
        console.log("pick a field number, s to save, or q to quit");
        continue;
      }

      if (index === 1) {
        console.log(`  current: ${shown(draft.reference_num)}`);
        const value = (await io.ask("  new value (blank to keep): ")).trim();
        if (value !== "") draft.reference_num = value;
        continue;
      }

      const { label, key } = ADDRESS_FIELDS[index - 2]!;
      console.log(`  current ${label}: ${shown(draft.address[key])}`);
      const value = await io.ask("  new value (blank to keep): ");
      if (value.trim() !== "") draft.address[key] = value;
    }
  } finally {
    io.close();
  }
}
