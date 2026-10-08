import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { JSDOM } from "jsdom";

const STYLES = readFileSync(new URL("../mods/youtube-foco/styles.js", import.meta.url), "utf8");
const CONTENT = readFileSync(new URL("../mods/youtube-foco/content.js", import.meta.url), "utf8");

const WATCH = `<ytd-watch-flexy><div id="columns"><div id="primary"><div id="below"></div></div><div id="secondary"><div id="related"></div></div></div></ytd-watch-flexy>`;

// Carrega o mod numa página falsa do YouTube com um `chrome` mínimo. `roots`
// guarda os shadow roots fechados que o mod cria, para o teste clicar na aba.
function loadMod({ path = "/watch?v=abc", enabled = true, body = WATCH } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>${body}</body></html>`, {
    url: `https://www.youtube.com${path}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const win = dom.window;
  const store = { "mods:enabled": enabled ? { "youtube-foco": true } : {} };
  const listeners = [];
  win.chrome = {
    storage: {
      local: { get: (key, cb) => cb(key in store ? { [key]: store[key] } : {}) },
      onChanged: { addListener: (fn) => listeners.push(fn) },
    },
  };
  const roots = [];
  const attach = win.Element.prototype.attachShadow;
  win.Element.prototype.attachShadow = function (init) {
    const r = attach.call(this, init);
    roots.push(r);
    return r;
  };
  win.eval(STYLES);
  win.eval(CONTENT);
  const setEnabled = (on) => {
    const newValue = on ? { "youtube-foco": true } : {};
    for (const fn of listeners) fn({ "mods:enabled": { newValue } }, "local");
  };
  const navigate = (p) => {
    win.history.pushState({}, "", p);
    win.document.dispatchEvent(new win.Event("yt-navigate-finish"));
  };
  const tab = () => roots.at(-1)?.querySelector(".ytf-tab");
  return { win, doc: win.document, html: win.document.documentElement, setEnabled, navigate, tab, roots };
}

test("ligado na página de vídeo: CSS de foco aplicado e gaveta fechada por padrão", () => {
  const { doc, html, tab } = loadMod();
  assert.ok(html.classList.contains("aise-ytfoco"));
  assert.ok(!html.classList.contains("aise-ytfoco-open"));
  assert.ok(doc.getElementById("aise-mod-youtube-foco"), "style da página");
  const hosts = doc.querySelectorAll("aise-mod");
  assert.equal(hosts.length, 1);
  assert.equal(hosts[0].getAttribute("data-mod"), "youtube-foco");
  assert.equal(hosts[0].shadowRoot, null, "shadow root precisa ser fechado");
  assert.equal(tab().getAttribute("aria-expanded"), "false");
});

test("a aba abre e fecha a gaveta; Esc fecha", () => {
  const { win, html, tab } = loadMod();
  tab().click();
  assert.ok(html.classList.contains("aise-ytfoco-open"));
  assert.equal(tab().getAttribute("aria-expanded"), "true");
  tab().click();
  assert.ok(!html.classList.contains("aise-ytfoco-open"));
  tab().click();
  win.document.dispatchEvent(new win.KeyboardEvent("keydown", { key: "Escape" }));
  assert.ok(!html.classList.contains("aise-ytfoco-open"));
});

test("navegar para outro vídeo fecha a gaveta; fora de /watch a aba some", () => {
  const { doc, html, tab, navigate } = loadMod();
  tab().click();
  navigate("/watch?v=outro");
  assert.ok(!html.classList.contains("aise-ytfoco-open"));
  assert.equal(doc.querySelectorAll("aise-mod").length, 1);
  navigate("/");
  assert.equal(doc.querySelectorAll("aise-mod").length, 0);
  assert.ok(html.classList.contains("aise-ytfoco"), "o CSS fica, escopado em ytd-watch-flexy");
  navigate("/watch?v=x");
  assert.equal(doc.querySelectorAll("aise-mod").length, 1);
});

test("mod desligado não toca a página; desligar desmonta tudo na hora", () => {
  const off = loadMod({ enabled: false });
  assert.ok(!off.html.classList.contains("aise-ytfoco"));
  assert.equal(off.doc.querySelector("aise-mod"), null);
  assert.equal(off.doc.getElementById("aise-mod-youtube-foco"), null);

  const { doc, html, tab, setEnabled } = loadMod();
  tab().click();
  setEnabled(false);
  assert.ok(!html.classList.contains("aise-ytfoco"));
  assert.ok(!html.classList.contains("aise-ytfoco-open"));
  assert.equal(doc.querySelector("aise-mod"), null);
  assert.equal(doc.getElementById("aise-mod-youtube-foco"), null);
  setEnabled(true);
  assert.ok(html.classList.contains("aise-ytfoco"));
  assert.equal(doc.querySelectorAll("aise-mod").length, 1);
});

test("CSS da página só vale com html.aise-ytfoco", () => {
  const css = loadMod().doc.getElementById("aise-mod-youtube-foco").textContent;
  const selectors = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g).map((s) => s.trim()).filter((s) => !s.startsWith("@"));
  for (const group of selectors) for (const sel of group.split(",")) assert.match(sel.trim(), /^html\.aise-ytfoco/, sel);
});

test("código do mod sem innerHTML, eval, fetch ou storage de escrita", () => {
  for (const bad of ["innerHTML", "eval(", "new Function", "fetch(", "XMLHttpRequest", ".set("]) {
    assert.ok(!CONTENT.includes(bad), bad);
  }
});
