#!/usr/bin/env node
// Referentie-screenshots van onze eigen pagina's (design-systeem, zie docs/design/DESIGN.md).
// Gebruikt de lokale Chrome via het DevTools-protocol: geen puppeteer/playwright nodig.
//
//   node scripts/design-screenshots.mjs                        alle pagina's uit PAGES → docs/design/reference/site/
//   node scripts/design-screenshots.mjs --url /nl/league --width 390 --out tmp.png [--full] [--scroll 600] [--eval "document.querySelector(...).click()"]
//   COOKIE=<authjs.session-token> node scripts/design-screenshots.mjs   ook de ingelogde pagina's
//
// Opties: --base http://localhost:3000, --chrome <pad naar chrome.exe>, DSF=2 voor scherpere beelden.
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import http from "node:http";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : fallback;
};
const flag = (name) => args.includes(`--${name}`);

const BASE = opt("base", "http://localhost:3000");
const CHROME = opt("chrome", process.platform === "win32" ? "C:/Program Files/Google/Chrome/Application/chrome.exe" : "google-chrome");
const OUT_DIR = path.resolve("docs/design/reference/site");
const COOKIE = process.env.COOKIE;
const PORT = 9400 + Math.floor(Math.random() * 400);

/** [bestandsnaam, pad, ingelogd nodig] */
const PAGES = [
  ["home", "/nl", false],
  ["evenementen", "/nl/evenementen", false],
  ["info", "/nl/info", false],
  ["league", "/nl/league", false],
  ["nieuws", "/nl/nieuws", false],
  ["ervaringen", "/nl/ervaringen", false],
  ["verkopen", "/nl/verkopen", false],
  ["login", "/nl/login", false],
  ["verkopen-losse-kaarten", "/nl/verkopen/losse-kaarten", true],
  ["dashboard", "/nl/dashboard", true],
  ["dashboard-tickets", "/nl/dashboard/tickets", true],
  ["dashboard-league", "/nl/dashboard/league", true],
  ["dashboard-profiel", "/nl/dashboard/profiel", true],
  ["berichten", "/nl/berichten", true],
];
const WIDTHS = [
  ["desktop", 1440, 900],
  ["mobiel", 390, 844],
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function getJson(p, method = "GET") {
  return new Promise((res, rej) => {
    const r = http.request({ host: "127.0.0.1", port: PORT, path: p, method }, (resp) => {
      let d = "";
      resp.on("data", (c) => (d += c));
      resp.on("end", () => {
        try {
          res(JSON.parse(d));
        } catch {
          rej(new Error(d));
        }
      });
    });
    r.on("error", rej);
    r.end();
  });
}

const chrome = spawn(CHROME, [
  "--headless=new",
  `--remote-debugging-port=${PORT}`,
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--window-size=1440,900",
  `--user-data-dir=${path.join(process.env.TEMP || "/tmp", `cc-design-shots-${PORT}`)}`,
  "about:blank",
]);

async function connect() {
  let target;
  for (let i = 0; i < 60 && !target; i++) {
    try {
      target = await getJson("/json/new?about:blank", "PUT");
    } catch {
      await sleep(250);
    }
  }
  if (!target) throw new Error("Chrome niet bereikbaar");
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const m = JSON.parse(ev.data);
    if (m.id && pending.has(m.id)) {
      pending.get(m.id)(m);
      pending.delete(m.id);
    }
  };
  const send = (method, params = {}) =>
    new Promise((res) => {
      const i = ++id;
      pending.set(i, res);
      ws.send(JSON.stringify({ id: i, method, params }));
    });
  await send("Page.enable");
  await send("Network.enable");
  if (COOKIE) await send("Network.setCookie", { name: "authjs.session-token", value: COOKIE, url: BASE, path: "/" });
  return { ws, send };
}

async function shoot(send, url, width, height, file, full, scrollTo = 0, evalJs = "") {
  await send("Emulation.setDeviceMetricsOverride", { width, height, deviceScaleFactor: Number(process.env.DSF || 1), mobile: width < 700 });
  await send("Page.navigate", { url });
  await sleep(6500);
  await send("Page.bringToFront");
  // Scroll één keer door de pagina zodat in-view-animaties hun eindstand halen.
  await send("Runtime.evaluate", {
    expression: "new Promise(r => { let y = 0; const t = setInterval(() => { y += 600; scrollTo(0, y); if (y > document.documentElement.scrollHeight) { clearInterval(t); scrollTo(0, 0); setTimeout(r, 900); } }, 120); })",
    awaitPromise: true,
  });
  // Optioneel: op een scrollpositie vastleggen (bv. de header in gescrolde stand).
  if (scrollTo > 0) {
    await send("Runtime.evaluate", { expression: `new Promise(r => { scrollTo(0, ${scrollTo}); setTimeout(r, 1200); })`, awaitPromise: true });
  }
  // Optioneel: eerst wat JS draaien (bv. het menu openklikken) en even wachten.
  if (evalJs) {
    await send("Runtime.evaluate", { expression: `new Promise(r => { ${evalJs}; setTimeout(r, 900); })`, awaitPromise: true });
  }
  if (process.env.DEBUG) console.log("debug", JSON.stringify((await send("Runtime.evaluate", { expression: "location.href + ' | ' + document.title + ' | ' + document.documentElement.scrollHeight", returnByValue: true })).result));
  const shot = await send("Page.captureScreenshot", { format: "png", captureBeyondViewport: full });
  writeFileSync(file, Buffer.from(shot.result.data, "base64"));
  console.log("ok", path.relative(process.cwd(), file));
}

try {
  const { ws, send } = await connect();
  // Git Bash maakt van "/nl/x" een Windows-pad ("C:/Program Files/Git/nl/x"); draai dat terug.
  const single = opt("url")?.replace(/\\/g, "/").replace(/^[A-Za-z]:\/.*?\/Git(?=\/)/, "");
  if (single) {
    const width = Number(opt("width", "1440"));
    await shoot(send, BASE + single, width, width < 700 ? 844 : 900, path.resolve(opt("out", "screenshot.png")), flag("full"), Number(opt("scroll", "0")), opt("eval", ""));
  } else {
    mkdirSync(OUT_DIR, { recursive: true });
    for (const [name, p, needsLogin] of PAGES) {
      if (needsLogin && !COOKIE) {
        console.log("skip", name, "(geen COOKIE)");
        continue;
      }
      for (const [label, w, h] of WIDTHS) {
        await shoot(send, BASE + p, w, h, path.join(OUT_DIR, `${name}-${label}.png`), true);
      }
    }
  }
  ws.close();
} catch (e) {
  console.error(e);
  process.exitCode = 1;
} finally {
  chrome.kill();
}
