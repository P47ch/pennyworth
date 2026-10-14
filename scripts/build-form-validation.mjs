import { readFileSync, writeFileSync } from "node:fs";
import ts from "typescript";

const source = readFileSync(new URL("../src/lib/formValidation.ts", import.meta.url), "utf8");
const output = "// Generated from src/lib/formValidation.ts. Run npm run build:validation.\n" + ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022, removeComments: false }
}).outputText;
const target = new URL("../src/public/form-validation-core.js", import.meta.url);
if (process.argv.includes("--check")) {
  if (readFileSync(target, "utf8") !== output) throw new Error("Rebuild browser validation: npm run build:validation");
} else writeFileSync(target, output);
