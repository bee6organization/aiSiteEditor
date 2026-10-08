// mods/youtube-foco/content.js — mod nativo "YouTube Foco": na página de vídeo,
// o player fica centralizado e as recomendações saem da tela. Uma aba discreta
// na borda direita puxa a coluna de recomendações como gaveta.
//
// Só roda em www.youtube.com e só depois que o usuário liga o mod no popup
// (registro dinâmico em lib/mods.js). Só mexe em CSS e em duas classes no
// <html>: não lê dado da página, não faz requisição, não guarda nada.
//
// - O layout do YouTube muda por um <style> no <head> (o CSS de shadow root
//   não alcança os elementos da página). Toda regra depende de html.aise-ytfoco.
// - A aba fica num <aise-mod> com shadow root fechado.
// - A gaveta é o próprio #secondary do YouTube, só reposicionado: rolagem
//   infinita, playlist e chat ao vivo continuam funcionando.
// - Padrão é sempre fechado: abrir outro vídeo fecha a gaveta.
// - Desligar o mod no popup desmonta tudo na hora, sem recarregar a aba.
(() => {
  'use strict';

  if (globalThis.__aiseYoutubeFocoLoaded) return;
  globalThis.__aiseYoutubeFocoLoaded = true;

  const MOD_ID = 'youtube-foco';
  const ENABLED_KEY = 'mods:enabled';
  const ON_CLASS = 'aise-ytfoco';
  const OPEN_CLASS = 'aise-ytfoco-open';
  const STYLE_ID = 'aise-mod-youtube-foco';
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const CSS = (globalThis.__aiseModStyles || {})[MOD_ID] || { page: '', ui: '' };

  const STRINGS = {
    pt: { show: 'Mostrar recomendações', hide: 'Esconder recomendações' },
    en: { show: 'Show recommendations', hide: 'Hide recommendations' },
    es: { show: 'Mostrar recomendaciones', hide: 'Ocultar recomendaciones' },
  };
  const T = (() => {
    const langs = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || 'en'];
    for (const l of langs) {
      const k = String(l).slice(0, 2).toLowerCase();
      if (STRINGS[k]) return STRINGS[k];
    }
    return STRINGS.en;
  })();

  let running = false;
  let open = false;
  let host = null;
  let tab = null;

  const isWatch = () => location.pathname === '/watch';

  function chevron() {
    const s = document.createElementNS(SVG_NS, 'svg');
    s.setAttribute('viewBox', '0 0 16 16');
    s.setAttribute('aria-hidden', 'true');
    const p = document.createElementNS(SVG_NS, 'path');
    p.setAttribute('d', 'M10 3 5 8l5 5');
    p.setAttribute('fill', 'none');
    p.setAttribute('stroke', 'currentColor');
    p.setAttribute('stroke-width', '2');
    p.setAttribute('stroke-linecap', 'round');
    p.setAttribute('stroke-linejoin', 'round');
    s.append(p);
    return s;
  }

  // O player do YouTube recalcula o tamanho no resize da janela.
  function relayout() {
    window.dispatchEvent(new Event('resize'));
  }

  function addPageStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const st = document.createElement('style');
    st.id = STYLE_ID;
    st.textContent = CSS.page;
    (document.head || document.documentElement).append(st);
  }

  function makeTab() {
    host = document.createElement('aise-mod');
    host.setAttribute('data-mod', MOD_ID);
    const root = host.attachShadow({ mode: 'closed' });
    const style = document.createElement('style');
    style.textContent = CSS.ui;
    tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'ytf-tab';
    tab.append(chevron());
    tab.addEventListener('click', () => setOpen(!open));
    root.append(style, tab);
    (document.body || document.documentElement).append(host);
  }

  function paintTab() {
    if (!tab) return;
    tab.classList.toggle('is-open', open);
    tab.setAttribute('aria-expanded', String(open));
    tab.setAttribute('aria-label', open ? T.hide : T.show);
    tab.title = open ? T.hide : T.show;
  }

  // Janela estreita: o YouTube tira #related da coluna lateral e põe embaixo
  // da descrição. Aí a gaveta ficaria vazia; abrir mostra a lista no lugar.
  function relatedBelow() {
    return document.querySelector('ytd-watch-flexy #below #related');
  }

  function setOpen(v) {
    open = !!v;
    document.documentElement.classList.toggle(OPEN_CLASS, open);
    paintTab();
    if (open) {
      const below = relatedBelow();
      if (below && typeof below.scrollIntoView === 'function') {
        requestAnimationFrame(() => below.scrollIntoView({ behavior: 'smooth', block: 'start' }));
      }
    }
  }

  // Mostra a aba só na página de vídeo e fecha a gaveta a cada navegação
  // (clicar numa recomendação volta para o vídeo limpo).
  function sync() {
    if (!running) return;
    setOpen(false);
    if (isWatch()) {
      if (!host || !host.isConnected) makeTab();
      paintTab();
    } else if (host) {
      host.remove();
      host = tab = null;
    }
    relayout();
  }

  function onKey(e) {
    if (open && e.key === 'Escape') setOpen(false);
  }

  function start() {
    if (running) return;
    running = true;
    addPageStyle();
    document.documentElement.classList.add(ON_CLASS);
    document.addEventListener('yt-navigate-finish', sync);
    window.addEventListener('popstate', sync);
    document.addEventListener('keydown', onKey);
    sync();
  }

  function stop() {
    if (!running) return;
    running = false;
    document.removeEventListener('yt-navigate-finish', sync);
    window.removeEventListener('popstate', sync);
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove(ON_CLASS, OPEN_CLASS);
    const st = document.getElementById(STYLE_ID);
    if (st) st.remove();
    if (host) host.remove();
    host = tab = null;
    open = false;
    relayout();
  }

  // O registro do content script já depende do mod estar ligado; conferir o
  // storage aqui cobre a janela entre desligar e o background desregistrar, e
  // deixa o mod sair da página na hora em que o usuário desliga.
  function isEnabled(map) {
    return !!(map && map[MOD_ID]);
  }

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[ENABLED_KEY]) return;
    isEnabled(changes[ENABLED_KEY].newValue) ? start() : stop();
  });

  chrome.storage.local.get(ENABLED_KEY, (v) => {
    if (isEnabled(v && v[ENABLED_KEY])) start();
  });
})();
