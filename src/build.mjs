import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const src = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(src, "..");

const stripBom = (s) => (s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

const template = stripBom(await fs.readFile(path.join(src, "index.template.html"), "utf8"));
const baseStyles = stripBom(await fs.readFile(path.join(src, "styles.css"), "utf8"));
const landingStyles = stripBom(await fs.readFile(path.join(src, "styles-v2.css"), "utf8"));
const seed = stripBom(await fs.readFile(path.join(src, "seed.js"), "utf8"));
const app = stripBom(await fs.readFile(path.join(src, "app.js"), "utf8"));

const html = template
  .replace("{{STYLES}}", baseStyles + "\n" + landingStyles)
  .replace("{{SEED}}", seed)
  .replace("{{SCRIPT}}", app);

const out = path.join(root, "index.html");
await fs.writeFile(out, html, "utf8");
console.log("wrote", out, (await fs.stat(out)).size, "bytes");
