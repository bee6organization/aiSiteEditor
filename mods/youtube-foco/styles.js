// mods/youtube-foco/styles.js — CSS do mod, em duas partes:
// - `page`: vai num <style> no <head> do YouTube, porque o layout que muda
//   (#primary, #secondary, telas finais do player) é do próprio YouTube e o
//   CSS de dentro do shadow root não alcança. Toda regra depende da classe
//   html.aise-ytfoco, que o mod tira ao ser desligado.
// - `ui`: o botão da aba, dentro do shadow root fechado do <aise-mod>.
// Fica em JS para não expor arquivo da extensão em web_accessible_resources.
globalThis.__aiseModStyles = globalThis.__aiseModStyles || {};
globalThis.__aiseModStyles["youtube-foco"] = {
  page: `
/* Gaveta com a largura da coluna nativa (402px) + respiro. */
html.aise-ytfoco { --aise-ytfoco-w: min(434px, 92vw); }

/* Vídeo no centro: a coluna de recomendações sai do fluxo e o #primary
   fica com margem igual dos dois lados. */
html.aise-ytfoco ytd-watch-flexy #columns { justify-content: center !important; }
html.aise-ytfoco ytd-watch-flexy #primary {
  margin-left: auto !important; margin-right: auto !important;
  padding-left: var(--ytd-margin-6x, 24px) !important;
  padding-right: var(--ytd-margin-6x, 24px) !important;
}

/* A coluna de recomendações vira gaveta presa à direita, fechada por padrão.
   É o próprio elemento do YouTube: rolagem infinita, playlist e chat ao vivo
   continuam funcionando dentro dela. */
html.aise-ytfoco ytd-watch-flexy #secondary {
  position: fixed !important;
  top: var(--ytd-masthead-height, 56px) !important; right: 0 !important; bottom: 0 !important;
  width: var(--aise-ytfoco-w) !important; min-width: 0 !important; max-width: none !important;
  margin: 0 !important; padding: 16px !important; box-sizing: border-box !important;
  overflow-y: auto !important; overscroll-behavior: contain;
  z-index: 2019 !important;
  background: var(--yt-spec-base-background, #0f0f0f);
  border-left: 1px solid var(--yt-spec-10-percent-layer, rgba(255,255,255,.1));
  box-shadow: -24px 0 48px -24px rgba(0,0,0,.6);
  transform: translateX(100%); visibility: hidden;
  transition: transform .28s cubic-bezier(.2,.8,.2,1), visibility 0s linear .28s;
}
html.aise-ytfoco.aise-ytfoco-open ytd-watch-flexy #secondary {
  transform: none; visibility: visible;
  transition: transform .28s cubic-bezier(.2,.8,.2,1), visibility 0s;
}

/* Janela estreita: o YouTube move as recomendações para baixo da descrição.
   Ficam escondidas também, e a aba as mostra no lugar. */
html.aise-ytfoco:not(.aise-ytfoco-open) ytd-watch-flexy #below #related { display: none !important; }

/* Mouse parado na página de vídeo: o cabeçalho (menu, logo, busca, perfil)
   some devagar e volta rápido. Com foco dentro (digitando na busca) fica. */
html.aise-ytfoco.aise-ytfoco-watch #masthead-container { transition: opacity .2s ease !important; }
html.aise-ytfoco.aise-ytfoco-watch.aise-ytfoco-idle #masthead-container:not(:focus-within) {
  opacity: 0 !important; pointer-events: none !important;
  transition: opacity .8s ease !important;
}

/* Telas finais do player: grade de vídeos sugeridos e cards do criador. */
html.aise-ytfoco .html5-video-player .ytp-endscreen-content,
html.aise-ytfoco .html5-video-player .ytp-ce-element,
html.aise-ytfoco .html5-video-player .ytp-pause-overlay { display: none !important; }

@media (prefers-reduced-motion: reduce) {
  html.aise-ytfoco ytd-watch-flexy #secondary { transition: none !important; }
}
`,
  ui: `:host { all: initial; }
/* Aba discreta na borda direita: quase apagada em repouso para não puxar o
   olho; ganha cor só quando o mouse ou o teclado chegam nela. */
.ytf-tab {
  position: fixed; top: 50%; right: 0; z-index: 2100;
  display: grid; place-items: center;
  width: 22px; height: 76px; padding: 0; margin: 0; box-sizing: border-box;
  border: 1px solid rgba(255, 255, 255, 0.14); border-right: 0;
  border-radius: 12px 0 0 12px;
  background: rgba(8, 8, 8, 0.72);
  backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  color: #d5d5ce; cursor: pointer; opacity: .38;
  transform: translateY(-50%);
  transition: right .28s cubic-bezier(.2,.8,.2,1), opacity .2s ease, width .2s ease, color .2s ease, border-color .2s ease;
}
.ytf-tab svg { width: 14px; height: 14px; transition: transform .28s cubic-bezier(.2,.8,.2,1); }
.ytf-tab:hover, .ytf-tab:focus-visible {
  opacity: 1; width: 28px; color: #ee8d49; border-color: rgba(238, 141, 73, 0.5);
}
.ytf-tab:focus-visible { outline: 2px solid #ee8d49; outline-offset: 2px; }
.ytf-tab.is-open { right: var(--aise-ytfoco-w, min(434px, 92vw)); opacity: .9; }
.ytf-tab.is-open svg { transform: rotate(180deg); }
/* Some junto com o cabeçalho quando o mouse para (gaveta aberta não entra). */
.ytf-tab.is-idle:not(.is-open) { opacity: 0; pointer-events: none; transition: opacity .8s ease; }
@media (prefers-reduced-motion: reduce) {
  .ytf-tab, .ytf-tab svg { transition: none !important; }
}
`,
};
