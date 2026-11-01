import fs from "node:fs";
import path from "node:path";
import { Linter } from "eslint";

const root = process.cwd(),
  source = path.join(root, "src"),
  graph = new Map(),
  linter = new Linter();
function files(directory) {
  return fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) =>
      entry.isDirectory()
        ? files(path.join(directory, entry.name))
        : /\.(js|jsx)$/.test(entry.name)
          ? [path.join(directory, entry.name)]
          : [],
    );
}
for (const file of files(source)) {
  const errors = linter.verify(fs.readFileSync(file, "utf8"), [
    {
      languageOptions: {
        sourceType: "module",
        ecmaVersion: "latest",
        parserOptions: { ecmaFeatures: { jsx: true } },
      },
    },
  ]);
  if (errors.some((error) => error.fatal))
    throw new Error(`Cannot parse ${path.relative(root, file)}`);
  const dependencies = [];
  const specifiers = [];
  function inspect(node) {
    if (!node || typeof node !== "object") return;
    if (
      [
        "ImportDeclaration",
        "ExportNamedDeclaration",
        "ExportAllDeclaration",
        "ImportExpression",
      ].includes(node.type) &&
      node.source?.value
    )
      specifiers.push(node.source.value);
    // Vite emits module workers from literal URLs relative to import.meta.url.
    if (
      node.type === "NewExpression" &&
      node.callee?.name === "URL" &&
      node.arguments[0]?.type === "Literal" &&
      node.arguments[1]?.type === "MemberExpression" &&
      node.arguments[1].object?.type === "MetaProperty"
    )
      specifiers.push(node.arguments[0].value);
    for (const [key, value] of Object.entries(node)) {
      if (["parent", "tokens", "comments", "loc", "range"].includes(key)) continue;
      if (Array.isArray(value)) value.forEach(inspect);
      else if (value && typeof value === "object") inspect(value);
    }
  }
  inspect(linter.getSourceCode().ast);
  for (const specifier of new Set(specifiers)) {
    if (
      file.startsWith(path.join(source, "results") + path.sep) &&
      (/^(react|react-dom|recharts|lucide-react)(\/|$)/.test(specifier) ||
        specifier.includes("/components/") ||
        specifier.includes("/features/"))
    )
      throw new Error(`Result model imports presentation: ${file} -> ${specifier}`);
    if (!specifier.startsWith(".")) continue;
    const target = path.resolve(path.dirname(file), specifier);
    if (!fs.existsSync(target)) throw new Error(`Unresolved import: ${file} -> ${specifier}`);
    if (/\.(js|jsx)$/.test(target)) dependencies.push(target);
  }
  graph.set(file, dependencies);
}
const reached = new Set();
function visit(file, stack = []) {
  if (stack.includes(file))
    throw new Error(
      `Import cycle: ${[...stack, file].map((p) => path.relative(root, p)).join(" -> ")}`,
    );
  if (reached.has(file)) return;
  reached.add(file);
  for (const dependency of graph.get(file) || []) visit(dependency, [...stack, file]);
}
visit(path.join(source, "index.jsx"));
const unused = [...graph.keys()].filter((file) => !reached.has(file));
if (unused.length)
  throw new Error(
    `Unreachable source modules: ${unused.map((p) => path.relative(root, p)).join(", ")}`,
  );
console.log(
  `Architecture: ${graph.size} reachable modules, no cycles or presentation imports in result models.`,
);
