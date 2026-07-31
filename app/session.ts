import { createInterface } from "node:readline/promises";
import {
  addLine,
  changeLineItem,
  deleteLine,
  findItem,
  getOrder,
  updateAddress,
  updateReferenceNum,
} from "./editor.ts";
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

interface DraftLine {
  id: number | null;
  seq: number | null;
  item_num: string;
  description: string | null;
}

//INFO: Buffering edits until saved
interface Draft {
  reference_num: string;
  address: Record<AddressField, string | null>;
  lines: DraftLine[];
}

function draftOf(order: OrderDetail): Draft {
  return {
    reference_num: order.reference_num,
    address: Object.fromEntries(
      ADDRESS_FIELDS.map(({ key }) => [key, order.address[key]]),
    ) as Draft["address"],
    lines: order.lines.map((line) => ({
      id: line.id,
      seq: line.seq,
      item_num: line.item_num,
      description: line.description,
    })),
  };
}

function changes(draft: Draft, original: Draft) {
  const address = ADDRESS_FIELDS.map(({ key }) => key).filter(
    (key) => draft.address[key] !== original.address[key],
  );

  const kept = new Set(draft.lines.map((line) => line.id));
  const deleted = original.lines.filter((line) => !kept.has(line.id)).map((line) => line.id!);
  const added = draft.lines.filter((line) => line.id === null);
  const repointed = draft.lines.filter((line) => {
    const before = original.lines.find((candidate) => candidate.id === line.id);
    return before !== undefined && before.item_num !== line.item_num;
  });

  return {
    reference: draft.reference_num !== original.reference_num,
    address,
    deleted,
    added,
    repointed,
    get any() {
      return (
        this.reference ||
        this.address.length > 0 ||
        this.deleted.length > 0 ||
        this.added.length > 0 ||
        this.repointed.length > 0
      );
    },
  };
}

function menu(draft: Draft, original: Draft) {
  const mark = (changed: boolean) => (changed ? bold(" *") : "");
  const { reference, address, deleted, added, repointed } = changes(draft, original);

  console.log(bold("\nEdit"));
  console.log(`  1  ${"reference number".padEnd(17)}${shown(draft.reference_num)}${mark(reference)}`);
  ADDRESS_FIELDS.forEach(({ label, key }, i) => {
    console.log(
      `  ${i + 2}  ${label.padEnd(17)}${shown(draft.address[key])}${mark(address.includes(key))}`,
    );
  });
  const linesChanged = deleted.length > 0 || added.length > 0 || repointed.length > 0;
  console.log(`  l  ${"lines".padEnd(17)}${draft.lines.length}${mark(linesChanged)}`);
  console.log(dim("  s  save        q  quit"));
}

function showDraftLines(draft: Draft, original: Draft) {
  console.log(bold("\nLines"));
  if (draft.lines.length === 0) {
    console.log(dim("  none"));
    return;
  }
  draft.lines.forEach((line, i) => {
    const before = original.lines.find((candidate) => candidate.id === line.id);
    const state =
      line.id === null ? bold(" (new)") : before && before.item_num !== line.item_num ? bold(" (changed)") : "";
    console.log(
      `  ${String(i + 1).padEnd(3)}seq ${shown(line.seq).padEnd(4)}${line.item_num.padEnd(10)}${shown(line.description)}${state}`,
    );
  });
}

//INFO: Buffer for line changes
async function linesMenu(draft: Draft, original: Draft, ask: Ask) {
  for (;;) {
    showDraftLines(draft, original);
    console.log(dim("  a  add     c  change item     d  delete     b  back"));
    const choice = (await ask("lines> ")).trim().toLowerCase();

    if (choice === "b") return;

    if (choice === "a") {
      const itemNum = (await ask("  item number: ")).trim();
      if (itemNum === "") continue;
      const item = await findItem(itemNum);
      if (!item) {
        console.log(`  unknown item ${itemNum}`);
        continue;
      }
      draft.lines.push({ id: null, seq: null, item_num: item.item_num, description: item.description });
      continue;
    }

    if (choice === "c" || choice === "d") {
      if (draft.lines.length === 0) {
        console.log("  no lines");
        continue;
      }
      const picked = Number((await ask("  line number: ")).trim());
      const line = draft.lines[picked - 1];
      if (!Number.isInteger(picked) || !line) {
        console.log("  pick a line number from the list");
        continue;
      }

      if (choice === "d") {
        draft.lines.splice(picked - 1, 1);
        continue;
      }

      console.log(`  current item: ${line.item_num}`);
      const itemNum = (await ask("  new item number (blank to keep): ")).trim();
      if (itemNum === "") continue;
      const item = await findItem(itemNum);
      if (!item) {
        console.log(`  unknown item ${itemNum}`);
        continue;
      }
      line.item_num = item.item_num;
      line.description = item.description;
      continue;
    }

    console.log("  pick a, c, d, or b");
  }
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
        if (!changes(draft, original).any) return true;
        const confirm = (await io.ask("discard unsaved changes? (y/n) ")).trim().toLowerCase();
        if (confirm === "y") {
          console.log("changes discarded");
          return true;
        }
        continue;
      }

      if (choice === "l") {
        await linesMenu(draft, original, io.ask);
        continue;
      }

      if (choice === "s") {
        const pending = changes(draft, original);
        if (!pending.any) {
          console.log("nothing to save");
          continue;
        }
        try {
          if (pending.reference) await updateReferenceNum(order.id, draft.reference_num);
          if (pending.address.length > 0) {
            await updateAddress(
              order.address.id,
              Object.fromEntries(pending.address.map((key) => [key, draft.address[key]])),
            );
          }
          for (const id of pending.deleted) await deleteLine(id);
          for (const line of pending.repointed) await changeLineItem(line.id!, line.item_num);
          for (const line of pending.added) await addLine(order.id, line.item_num);
        } catch (error) {
          //INFO: Reference-number collision keeps the session open.
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
