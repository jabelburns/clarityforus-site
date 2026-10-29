/** Conservative, fail-closed source audit of the House ingestion D1 budget.
 *
 * This is a static upper bound for directly visible D1 operations, NOT a
 * measured end-to-end Cloudflare Worker route or remote D1 performance test.
 * Tests must be reviewed if code structure changes. No network/database I/O.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import ts from "typescript";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const paths = {
  route: resolve(root, "app/api/ingest/house-votes/route.ts"),
  auth: resolve(root, "lib/site-admin.ts"),
  helper: resolve(root, "lib/house-clerk.ts"),
};

function assert(condition, message) {
  if (!condition) throw new Error("House D1 query budget audit: " + message);
}

function parseTs(source, filename) {
  const tree = ts.createSourceFile(filename, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  assert(tree.parseDiagnostics.length === 0, filename + " failed to parse");
  return tree;
}

function findHouseLoop(tree) {
  const loops = [];
  function visit(node) {
    if (ts.isForOfStatement(node) && /\brollCall\s+of\b/.test(node.getText(tree))) {
      loops.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  assert(loops.length === 1, "expected exactly one rollCall iteration");
  assert(/\[\.\.\.result\.rollCalls\]\.reverse\(\)/.test(loops[0].getText(tree)), "House loop shape changed");
  return loops[0];
}

function collectDirectDbCalls(source, filename) {
  const tree = parseTs(source, filename);
  const operations = [];
  function visit(node) {
    if (ts.isAwaitExpression(node)) {
      const expression = node.expression.getText(tree);
      const method = /^\s*db\s*\.\s*(insert|update|select|delete|run|execute|batch|query)\s*\(/.exec(expression);
      if (method) {
        operations.push({
          method: method[1],
          pos: node.pos,
          end: node.end,
          line: tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1,
        });
      } else {
        assert(!/^\s*(?:db|env\.DB|getDb\s*\(\s*\))\s*[.[(]/.test(expression),
          "unexpected direct DB operation in awaited expression at line " +
          (tree.getLineAndCharacterOfPosition(node.getStart(tree)).line + 1));
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(tree);
  // Catch database operations introduced without awaiting their completion.
  const lexical = [...source.matchAll(/\bdb\s*\.\s*(?:insert|update|select|delete|run|execute|batch|query)\s*\(/g)];
  assert(lexical.length === operations.length,
    filename + ": unawaited/nested DB operations or unexplained direct references");
  return { operations, tree };
}

export function auditHouseQueryBudget({ route, auth, helper }) {
  assert(typeof route === "string" && typeof auth === "string" && typeof helper === "string",
    "all three source files are required");
  const { operations, tree } = collectDirectDbCalls(route, "house-votes/route.ts");
  const rollLoop = findHouseLoop(tree);
  const inRoll = operations.filter(op => op.pos >= rollLoop.pos && op.end <= rollLoop.end);
  const outside = operations.filter(op => !(op.pos >= rollLoop.pos && op.end <= rollLoop.end));

  assert(operations.length === 15 && inRoll.length === 12 && outside.length === 3,
    "House route changed from 12/roll + 3 outside calls; review budget manually before merging");
  assert(inRoll.filter(op => op.method === "run").length === 3,
    "Expected exactly three bound bulk JSON1 D1 statements per roll");
  assert(outside.filter(op => op.method === "insert").length === 1 &&
    outside.filter(op => op.method === "update").length === 2,
    "Expected one ingest run creation and two mutually exclusive terminal status writes");

  // max 2 roll calls, even when caller asks for more. The discovery helper
  // must still return at most the input limit; any change fails this audit.
  assert(/Math\.min\(\s*requestedLimit\s*,\s*2\s*\)/.test(route) &&
    /:\s*2\s*;/.test(route), "House route's two-roll hard limit changed");
  assert(/fetchRecentHouseRollCalls\(\{\s*year\s*,\s*limit\s*,\s*beforeRoll\s*\}\)/.test(route),
    "Route no longer passes its safe limit to roll-call discovery");
  assert(/const\s+safeLimit\s*=\s*Math\.min\(\s*Math\.max\(\s*Math\.trunc\(limit\)\s*,\s*1\s*\)\s*,\s*25\s*\)/.test(helper) &&
    /\.slice\(\s*0\s*,\s*safeLimit\s*\)/.test(helper) &&
    /\blimit\s*=\s*10\s*,?/.test(helper),
    "House discovery helper limit behavior needs re-review");
  assert(!/\bgetDb\s*\(|\benv\.DB\b|cloudflare:workers/.test(helper),
    "House network/parse helper must not use D1 directly");
  assert((route.match(/\bgetDb\s*\(/g) || []).length === 1,
    "Unexpected database initializer in route");
  assert((route.match(/\bauthorizeIngestRequest\s*\(/g) || []).length === 1,
    "Unexpected additional authorization step");
  assert(!/\benv\.DB\b|\bgetDb\s*\(\s*\)\s*\./.test(route),
    "Unexpected direct D1 binding access in House route");

  const owner = collectDirectDbCalls(auth, "site-admin.ts");
  assert(owner.operations.length === 3 &&
    owner.operations.filter(op => op.method === "select").length === 2 &&
    owner.operations.filter(op => op.method === "insert").length === 1,
    "Owner validation query count changed");
  assert(/supplied\s*&&\s*env\.INGEST_TOKEN/.test(auth) &&
    /return\s+\{\s*ok:\s*true\s+as const,\s*userId:\s*null,\s*mode:\s*"service"/.test(auth) &&
    /const\s+owner\s*=\s*await requireSiteOwner\(request\)/.test(auth),
    "Authentication may have an unreviewed extra database path");

  const maximumRollCalls = 2;
  const directRouteConservative = outside.length + maximumRollCalls * inRoll.length;
  const ownerConservative = owner.operations.length;
  const conservativeTotal = directRouteConservative + ownerConservative;
  const freeTierLimit = 50;
  assert(conservativeTotal <= freeTierLimit, "Static direct D1 upper bound exceeds Free-tier limit");

  return {
    mode: "STATIC_SOURCE_BOUND_NOT_RUNTIME_MEASUREMENT",
    maxRollCalls: maximumRollCalls,
    maxDirectD1CallsPerRoll: inRoll.length,
    otherRouteD1CallsConservative: outside.length,
    ownerAuthD1CallsConservative: ownerConservative,
    serviceAuthD1CallsConservative: 0,
    directRouteAndOwnerAuthUpperBound: conservativeTotal,
    directRouteAndServiceAuthUpperBound: directRouteConservative,
    workerFreeD1QueryLimit: freeTierLimit,
    noActualHandlerRequestExecuted: true,
    assumptions: [
      "Route's two-roll clamp and House discovery respect their current forms",
      "Each awaited Drizzle DB call translates to one D1 query",
      "The House fetch helper contains no indirect database calls",
      "The two alternative terminal success/failure writes are counted together conservatively",
      "No separate writes originate in framework middleware, hosting integration or future code",
    ],
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = auditHouseQueryBudget({
      route: readFileSync(paths.route, "utf8"),
      auth: readFileSync(paths.auth, "utf8"),
      helper: readFileSync(paths.helper, "utf8"),
    });
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } catch (error) {
    process.stderr.write(String(error) + "\n");
    process.exitCode = 2;
  }
}
