#!/usr/bin/env node

import { spawnSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFilePath), "..");
const tsxCliPath = resolve(repoRoot, "node_modules/tsx/dist/cli.mjs");
const scriptPath = resolve(repoRoot, "scripts/verify-proof.ts");

const result = spawnSync(process.execPath, [tsxCliPath, scriptPath, ...process.argv.slice(2)], {
  cwd: repoRoot,
  stdio: "inherit"
});

process.exitCode = result.status ?? 1;
