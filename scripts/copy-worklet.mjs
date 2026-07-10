import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "..");
const source = resolve(root, "src/browser/capture.worklet.js");
const destination = resolve(root, "dist/capture.worklet.js");

await mkdir(dirname(destination), { recursive: true });
await cp(source, destination);
console.log("Copied AudioWorklet asset to dist/capture.worklet.js");
