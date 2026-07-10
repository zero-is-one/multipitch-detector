import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(currentDir, "..");
const siteDir = path.join(projectRoot, "site");

await rm(siteDir, { recursive: true, force: true });
await mkdir(siteDir, { recursive: true });

await cp(path.join(projectRoot, "demo"), path.join(siteDir, "demo"), {
  recursive: true,
});
await cp(path.join(projectRoot, "dist"), path.join(siteDir, "dist"), {
  recursive: true,
});

const landingPage = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta http-equiv="refresh" content="0; url=./demo/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>multi-pitch detector demo</title>
  </head>
  <body>
    <p>Redirecting to the demo...</p>
    <p><a href="./demo/">Open the demo</a></p>
  </body>
</html>
`;

await writeFile(path.join(siteDir, "index.html"), landingPage, "utf8");

console.log("Prepared GitHub Pages site in ./site");
