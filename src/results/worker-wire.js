import { SOURCE, EXCLUDED, SIGNAL_COVERAGE } from "./quality.js";
import { GLOBAL_STEP, COVERAGE } from "./temporal.js";

const symbols = new Map(
  [SOURCE, EXCLUDED, SIGNAL_COVERAGE, GLOBAL_STEP, COVERAGE].map((symbol) => [
    symbol.description,
    symbol,
  ]),
);
// Structured clone drops Symbol properties. Keep a separate reference graph so
// record provenance, exclusions and Set membership survive without reserving a
// user column name or copying every measurement into a second JS object graph.
export function packResult(value) {
  const metadata = [],
    seen = new WeakSet();
  function visit(object) {
    if (!object || typeof object !== "object" || seen.has(object)) return;
    seen.add(object);
    for (const symbol of Object.getOwnPropertySymbols(object)) {
      if (!symbols.has(symbol.description)) throw new Error("Unsupported internal result metadata");
      metadata.push([object, symbol.description, object[symbol]]);
      visit(object[symbol]);
    }
    if (object instanceof Set) for (const entry of object) visit(entry);
    else if (object instanceof Map)
      for (const [key, entry] of object) {
        visit(key);
        visit(entry);
      }
    else for (const key of Object.keys(object)) visit(object[key]);
  }
  visit(value);
  return { value, metadata };
}
export function unpackResult({ value, metadata }) {
  for (const [object, name, data] of metadata) {
    const symbol = symbols.get(name);
    if (!symbol) throw new Error("Unsupported internal result metadata");
    object[symbol] = data;
  }
  return value;
}
