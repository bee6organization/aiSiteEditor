// lib/mods.js — mods nativos: código que vem dentro do pacote da extensão,
// revisado junto com ela. Não existe mod baixado da internet (o Manifest V3
// proíbe código remoto e não há catálogo de terceiros).
//
// Um mod só roda depois que o usuário liga a chave no popup. Ligar registra o
// content script do mod com `chrome.scripting.registerContentScripts`, apenas
// nos `matches` declarados aqui; desligar remove o registro. Nada de mod entra
// no `content_scripts` fixo do manifest.json.

export const ENABLED_KEY = "mods:enabled";
export const MOD_SCRIPT_PREFIX = "aise-mod-";

export const NATIVE_MODS = [
  {
    id: "reddit-cfmod",
    name: "Reddit Custom Feeds",
    description: "Edita custom feeds do Reddit em massa: comunidades do feed e as que você segue lado a lado.",
    // O que o usuário precisa saber antes de ligar, em português simples.
    access: "Usa sua sessão logada no Reddit para ler e alterar seus custom feeds. Só roda em www.reddit.com.",
    matches: ["https://www.reddit.com/*"],
    js: ["mods/reddit-cfmod/styles.js", "mods/reddit-cfmod/content.js"],
  },
  {
    id: "youtube-foco",
    name: "YouTube Foco",
    description: "Vídeo centralizado e recomendações fora da tela. Uma aba na borda direita puxa as recomendações quando você quiser.",
    access: "Só muda o visual da página de vídeo do YouTube. Não lê nem envia dado nenhum. Só roda em www.youtube.com.",
    matches: ["https://www.youtube.com/*"],
    js: ["mods/youtube-foco/styles.js", "mods/youtube-foco/content.js"],
  },
];

// Só host explícito com esquema https, sem curinga de subdomínio. Curinga
// ("*://*/*", "https://*.com/*", "https://*.com.br/*") ou "<all_urls>" daria a
// um mod alcance de todos os sites de um domínio de topo.
const MATCH_RE = /^https:\/\/[a-z0-9-]+(\.[a-z0-9-]+)+\/.*$/i;
const ID_RE = /^[a-z0-9-]+$/;

export function validateModDef(mod) {
  const errors = [];
  if (!mod || typeof mod !== "object") return ["mod inválido"];
  if (!ID_RE.test(mod.id || "")) errors.push(`id inválido: ${mod.id}`);
  if (!mod.name) errors.push(`${mod.id}: sem nome`);
  if (!mod.access) errors.push(`${mod.id}: sem texto de acesso`);
  if (!Array.isArray(mod.matches) || mod.matches.length === 0) errors.push(`${mod.id}: sem matches`);
  for (const m of mod.matches || []) {
    if (!MATCH_RE.test(m)) errors.push(`${mod.id}: match amplo demais ou inválido: ${m}`);
  }
  if (!Array.isArray(mod.js) || mod.js.length === 0) errors.push(`${mod.id}: sem js`);
  for (const f of mod.js || []) {
    if (!f.startsWith(`mods/${mod.id}/`) || f.includes("..")) errors.push(`${mod.id}: arquivo fora da pasta do mod: ${f}`);
  }
  return errors;
}

export function findMod(id) {
  return NATIVE_MODS.find((m) => m.id === id) || null;
}

export async function getEnabledMods(storage) {
  const v = await storage.get(ENABLED_KEY);
  const map = v && v[ENABLED_KEY];
  return map && typeof map === "object" ? { ...map } : {};
}

export async function setModEnabled(storage, id, enabled) {
  if (!findMod(id)) throw new Error(`mod desconhecido: ${id}`);
  const map = await getEnabledMods(storage);
  if (enabled) map[id] = true;
  else delete map[id];
  await storage.set({ [ENABLED_KEY]: map });
  return map;
}

export function contentScriptFor(mod) {
  return {
    id: MOD_SCRIPT_PREFIX + mod.id,
    matches: [...mod.matches],
    js: [...mod.js],
    runAt: "document_idle",
    allFrames: false,
    persistAcrossSessions: true,
  };
}

// Deixa os scripts registrados iguais ao mapa de mods ligados. Remove também
// qualquer registro `aise-mod-*` que não corresponda a um mod nativo atual
// (mod removido numa atualização da extensão não pode continuar rodando).
export async function syncRegisteredMods(scripting, enabledMap) {
  const registered = await scripting.getRegisteredContentScripts();
  const ours = registered.filter((s) => s.id.startsWith(MOD_SCRIPT_PREFIX));
  const wanted = NATIVE_MODS.filter((m) => enabledMap[m.id] && validateModDef(m).length === 0);
  const wantedIds = new Set(wanted.map((m) => MOD_SCRIPT_PREFIX + m.id));

  const stale = ours.filter((s) => !wantedIds.has(s.id)).map((s) => s.id);
  if (stale.length) await scripting.unregisterContentScripts({ ids: stale });

  // Re-registra sempre os desejados: uma atualização da extensão pode ter
  // mudado `matches` ou arquivos de um mod que continua ligado.
  const keep = ours.filter((s) => wantedIds.has(s.id)).map((s) => s.id);
  if (keep.length) await scripting.unregisterContentScripts({ ids: keep });
  if (wanted.length) await scripting.registerContentScripts(wanted.map(contentScriptFor));

  return { registered: wanted.map((m) => m.id), removed: stale };
}

// Converte um match pattern simples em teste de URL (para injetar o mod nas
// abas já abertas quando o usuário liga a chave).
export function urlMatches(mod, url) {
  if (typeof url !== "string") return false;
  return mod.matches.some((m) => {
    const re = new RegExp("^" + m.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$");
    return re.test(url);
  });
}
