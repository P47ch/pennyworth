import { access, readdir, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const wikiRoot = path.resolve(process.cwd(), "wiki");
const allowedTypes = new Set([
  "overview",
  "schema",
  "index",
  "log",
  "source-map",
  "product",
  "status",
  "architecture",
  "security",
  "feature",
  "runbook",
  "verification"
]);
const allowedStatuses = new Set(["current", "planned", "historical", "needs-review"]);
const errors = [];

async function listMarkdownFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(
    entries.map(async (entry) => {
      const absolute = path.join(directory, entry.name);
      return entry.isDirectory() ? listMarkdownFiles(absolute) : entry.name.endsWith(".md") ? [absolute] : [];
    })
  );
  return nested.flat().sort();
}

function relativeName(absolute) {
  return path.relative(wikiRoot, absolute).split(path.sep).join("/");
}

function parseFrontmatter(content, file) {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n/);
  if (!match) {
    errors.push(`${file}: missing frontmatter.`);
    return {};
  }

  const values = {};
  for (const line of match[1].split(/\r?\n/)) {
    const field = line.match(/^([a-z_]+):\s*(.*)$/);
    if (field) {
      values[field[1]] = field[2].trim();
    }
  }
  return values;
}

function parseInlineArray(value, file, field) {
  const match = value?.match(/^\[(.*)\]$/);
  if (!match) {
    errors.push(`${file}: ${field} must be a single-line array.`);
    return [];
  }
  return match[1]
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function markdownTargets(content) {
  const targets = [];
  const pattern = /\[[^\]]*\]\(([^)]+)\)/g;
  for (const match of content.matchAll(pattern)) {
    let target = match[1].trim();
    if (target.startsWith("<") && target.includes(">")) {
      target = target.slice(1, target.indexOf(">"));
    } else {
      target = target.split(/\s+/)[0];
    }
    targets.push(target);
  }
  return targets;
}

function internalPath(sourceFile, target) {
  if (!target || target.startsWith("#") || /^[a-z][a-z0-9+.-]*:/i.test(target)) {
    return null;
  }
  const withoutAnchor = decodeURIComponent(target.split("#")[0].split("?")[0]);
  return withoutAnchor ? path.resolve(path.dirname(sourceFile), withoutAnchor) : null;
}

const markdownFiles = await listMarkdownFiles(wikiRoot);
const contentByFile = new Map(
  await Promise.all(markdownFiles.map(async (file) => [file, await readFile(file, "utf8")]))
);
const sourcesFile = path.join(wikiRoot, "sources.md");
const sourceContent = contentByFile.get(sourcesFile) ?? "";
const knownSourceIds = new Set(Array.from(sourceContent.matchAll(/^## source:([a-z0-9-]+)\s*$/gm), (match) => match[1]));

if (knownSourceIds.size === 0) {
  errors.push("sources.md: no source IDs found.");
}

let internalLinkCount = 0;
const inboundLinks = new Map(markdownFiles.map((file) => [file, 0]));
const indexedFiles = new Set();

for (const file of markdownFiles) {
  const name = relativeName(file);
  const content = contentByFile.get(file);
  const frontmatter = parseFrontmatter(content, name);

  for (const field of ["title", "type", "status", "updated", "source_ids", "tags"]) {
    if (!frontmatter[field]) {
      errors.push(`${name}: missing frontmatter field ${field}.`);
    }
  }

  if (frontmatter.type && !allowedTypes.has(frontmatter.type)) {
    errors.push(`${name}: unsupported type ${frontmatter.type}.`);
  }
  if (frontmatter.status && !allowedStatuses.has(frontmatter.status)) {
    errors.push(`${name}: unsupported status ${frontmatter.status}.`);
  }
  if (frontmatter.updated && !/^\d{4}-\d{2}-\d{2}$/.test(frontmatter.updated)) {
    errors.push(`${name}: updated must use YYYY-MM-DD.`);
  }

  for (const sourceId of parseInlineArray(frontmatter.source_ids, name, "source_ids")) {
    if (!knownSourceIds.has(sourceId)) {
      errors.push(`${name}: unknown source ID ${sourceId}.`);
    }
  }
  parseInlineArray(frontmatter.tags, name, "tags");

  if (name !== "log.md" && !/^## Sources\s*$/m.test(content)) {
    errors.push(`${name}: missing ## Sources section.`);
  }

  for (const target of markdownTargets(content)) {
    const resolved = internalPath(file, target);
    if (!resolved) {
      continue;
    }
    internalLinkCount += 1;
    try {
      await access(resolved);
    } catch {
      errors.push(`${name}: broken internal link ${target}.`);
      continue;
    }

    if (contentByFile.has(resolved) && resolved !== file) {
      inboundLinks.set(resolved, (inboundLinks.get(resolved) ?? 0) + 1);
    }
    if (file === path.join(wikiRoot, "index.md") && contentByFile.has(resolved)) {
      indexedFiles.add(resolved);
    }
  }
}

const indexFile = path.join(wikiRoot, "index.md");
for (const file of markdownFiles) {
  if (file !== indexFile && !indexedFiles.has(file)) {
    errors.push(`index.md: missing ${relativeName(file)}.`);
  }
  if (file !== indexFile && (inboundLinks.get(file) ?? 0) === 0) {
    errors.push(`${relativeName(file)}: orphan page with no inbound links.`);
  }
}

const logFile = path.join(wikiRoot, "log.md");
const logContent = contentByFile.get(logFile) ?? "";
const logHeadings = Array.from(logContent.matchAll(/^## (.+)$/gm), (match) => match[1]);
let previousLogDate = "";
for (const heading of logHeadings) {
  const match = heading.match(/^\[(\d{4}-\d{2}-\d{2})\] (ingest|query|lint|transform|source-sync) \| .+$/);
  if (!match) {
    errors.push(`log.md: invalid operation heading "${heading}".`);
    continue;
  }
  if (previousLogDate && match[1] < previousLogDate) {
    errors.push(`log.md: operation dates are not chronological at ${match[1]}.`);
  }
  previousLogDate = match[1];
}

if (errors.length > 0) {
  console.error(`Wiki lint failed with ${errors.length} error(s):`);
  for (const error of errors) {
    console.error(`- ${error}`);
  }
  process.exitCode = 1;
} else {
  console.log(
    `Wiki lint passed: ${markdownFiles.length} pages, ${knownSourceIds.size} source IDs, ${internalLinkCount} internal links.`
  );
}
