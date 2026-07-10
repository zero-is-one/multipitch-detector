import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const root = process.cwd();
const port = Number(process.env.PORT ?? 4173);

const contentTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
};

const server = createServer(async (req, res) => {
  try {
    const requestPath = req.url ?? "/demo/index.html";
    const urlPath =
      requestPath === "/"
        ? "/demo/index.html"
        : requestPath.endsWith("/")
          ? `${requestPath}index.html`
          : requestPath;
    const safePath = normalize(urlPath)
      .replace(/^([.][.][/\\])+/, "")
      .replace(/^[/\\]+/, "");
    const filePath = join(root, safePath);
    const file = await readFile(filePath);
    const contentType =
      contentTypes[extname(filePath)] ?? "text/plain; charset=utf-8";
    res.writeHead(200, { "Content-Type": contentType });
    res.end(file);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
});

server.on("error", (error) => {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    error.code === "EADDRINUSE"
  ) {
    console.error(
      `Port ${port} is already in use. Set PORT to another value, for example: PORT=4174 npm run demo:serve`,
    );
    process.exit(1);
  }

  throw error;
});

server.listen(port, () => {
  console.log(`Demo server running at http://localhost:${port}/demo/`);
});
