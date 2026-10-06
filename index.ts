#!/usr/bin/env node

import { realpathSync } from "node:fs";
import { fileURLToPath } from "node:url";

import { main } from "./src/index.ts";

// Re-export the public API so the surface lives in one place (`src/index.ts`).
export * from "./src/index.ts";

let invokedPath = "";
if (process.argv[1]) {
  try {
    invokedPath = realpathSync(process.argv[1]);
  } catch {
    // Importing the module from a non-file entry point should not execute it.
  }
}
const modulePath = fileURLToPath(import.meta.url);
if (invokedPath === modulePath) {
  main()
    .then((code) => {
      process.exitCode = code;
    })
    .catch((error: unknown) => {
      process.stderr.write(`pi-to-md: ${error instanceof Error ? error.message : String(error)}\n`);
      process.exitCode = 1;
    });
}
