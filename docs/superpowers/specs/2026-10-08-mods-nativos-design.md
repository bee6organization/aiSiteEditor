# Mods nativos no AI Site Modder

Data: 2026-10-08 · Autor: Arthur Attili (com Claude) · Status: fase 1 implementada

## 1. Decisão

O aiSiteEditor passa a carregar **mods nativos**: código que vem dentro do pacote da extensão e é revisado junto com ela. **Não existe** marketplace, catálogo da comunidade nem mod baixado da internet. Com isso fica dentro da regra do Manifest V3 e da Chrome Web Store, que proíbem código remoto.

O primeiro mod é o Reddit-CFMod (edição em massa de custom feeds), portado do repositório `bee6-reddit-MOD`. Esse repositório continua existindo e não foi alterado.

Os mods não usam o formato de preset de IA (`lib/ops.js`). Preset é DOM declarativo; o Reddit-CFMod chama a API do Reddit com a sessão do usuário, e isso só é possível com código.

## 2. Estrutura

```
lib/mods.js                    registro dos mods + validação + sync de registro
lib/ui/mods-view.js            seção "Mods" do popup (módulo puro)
mods/reddit-cfmod/styles.js    CSS do mod (string JS, ver 3.4)
mods/reddit-cfmod/content.js   código do mod
```

Cada mod em `NATIVE_MODS` (`lib/mods.js`) declara `id`, `name`, `description`, `access` (texto mostrado ao usuário antes de ligar), `matches` e `js`.

## 3. Segurança

### 3.1 Nada roda sem o usuário ligar
- Mod nasce desligado (`mods:enabled` vazio no `chrome.storage.local`).
- Ligar no popup registra o content script com `chrome.scripting.registerContentScripts`, **só nos `matches` do mod**; desligar remove o registro. Nenhum mod entra no `content_scripts` fixo do `manifest.json` (há teste para isso).
- Ao ligar, o background injeta o mod nas abas já abertas que casam com os `matches`. O script tem guarda contra carga dupla.
- Ao desligar, o mod escuta `chrome.storage.onChanged` e se desmonta na hora (observer, botão, painel), sem precisar recarregar a aba. Um lote de inclusões em andamento para no próximo item.
- No `onInstalled` e no `onStartup`, `syncRegisteredMods` refaz os registros a partir do storage e remove qualquer `aise-mod-*` que não corresponda a um mod nativo atual.

### 3.2 Quem pode ligar um mod
- `LIST_MODS` e `SET_MOD_ENABLED` só são aceitos de página da própria extensão (`sender.tab` ausente e `sender.url` dentro de `chrome.runtime.getURL("")`). Um content script, que roda dentro de sites, não consegue ativar código com acesso à sessão de outro site.

### 3.3 Escopo
- `validateModDef` exige host explícito com `https` em `matches`. Recusa `<all_urls>`, `*://*/*`, qualquer curinga de subdomínio (`*.com.br` passaria por sufixo público) e `http`. Os arquivos precisam estar em `mods/<id>/`, sem `..`.
- Registro com `allFrames: false`.

### 3.4 Isolamento na página
- Toda a UI do mod fica em `<aise-mod data-mod="...">` com **shadow root fechado**. A página só vê o elemento vazio e não lê nem altera o painel.
- O picker e o content script do editor de IA ignoram `aise-mod` (mesma lista de `aise-panel`, `aise-indicator` e `aise-picker`). Assim, um pedido de IA não reescreve o painel do mod.
- O CSS vai como string JS (`styles.js`), não como arquivo em `web_accessible_resources`. Arquivo exposto permitiria ao Reddit detectar a extensão buscando a URL dele.
- A trava de scroll virou estilo inline no `<html>` e no `<body>`, restaurado ao fechar. Antes era uma classe com CSS global.

### 3.5 Código do mod (mudanças em relação ao original)
- **Sem `innerHTML`:** painel montado com `createElement`/`textContent`, SVG com `createElementNS`. Nome de feed e de comunidade vêm da API e entram só como texto. Há teste que falha se aparecer `innerHTML`, `eval` ou `new Function`.
- **Ícone de comunidade:** só carrega se for `https` e de host do Reddit (`redditstatic.com`, `redditmedia.com`, `redd.it`, `reddit.com`), com `referrerpolicy="no-referrer"`. Antes, qualquer URL vinda da API virava `<img src>`.
- **URLs da API:** `user`, `feed` e o cursor `after` passam por `encodeURIComponent`. Antes, `getFeed` e `after` iam crus.
- **Storage com namespace:** o cache das comunidades usa `mod:reddit-cfmod:subscriptions`. Não há migração do cache da extensão separada, porque storage de extensão não é compartilhado e o cache expira em 10 minutos.
- **Rede:** o mod só fala com `https://www.reddit.com` (teste confere as URLs no código).
- **Paridade com a original (até `7762e34`):** o port inicial saiu do primeiro commit (`f84adc5`). Depois entraram os quatro commits seguintes (o × nativo é achado por posição perto da busca e o "+" é alinhado com `translateY`):
  - botão "+" ao lado do lápis da seção Communities, num `<aise-mod data-part="mini">` próprio;
  - fechar o nosso modal fecha também o painel nativo "Communities";
  - escudo de teclas e foco contra o focus trap do Reddit. Com shadow fechado, a checagem é contra o host, porque o evento chega retargetado.
- **Painel nativo:** só é fechado se o nosso modal estava aberto. Na original, sair do feed também disparava esse clique.

### 3.5b YouTube Foco (`youtube-foco`)
- Na página `/watch`, centraliza o player e transforma o `#secondary` do próprio YouTube numa gaveta presa à direita, fechada por padrão. A aba que abre a gaveta fica num `<aise-mod>` com shadow fechado. Esc fecha, e navegar para outro vídeo também.
- Esse é o primeiro mod que precisa de CSS na página: um `<style id="aise-mod-youtube-foco">` no `<head>`, porque o layout que muda é do YouTube. Toda regra depende de `html.aise-ytfoco` (há teste para isso), e desligar remove o style e a classe. O YouTube consegue detectar esse style; isso é aceitável, porque o mod não usa sessão nem dado do usuário.
- Também esconde as telas finais do player (grade de vídeos sugeridos e cards do criador).
- Não faz requisição, não lê o DOM fora do layout e não grava storage.

### 3.6 O que continua como está
- O aiSiteEditor pede `<all_urls>` desde antes dos mods. Os mods não aumentam a superfície no papel, mas o ideal é mover hosts para `optional_host_permissions` e pedir permissão por mod ao ligar. Isso fica para a fase 2.
- Content scripts da mesma extensão compartilham `chrome.storage.local`. O namespace é convenção, não barreira, e isso é aceitável porque todo mod é código revisado.

## 4. Como adicionar um mod nativo

1. Criar `mods/<id>/` com o código. Usar shadow DOM fechado em `<aise-mod>`, nenhum `innerHTML` com dado externo e storage em `mod:<id>:*`. O mod escuta `mods:enabled` para se desmontar.
2. Adicionar a entrada em `NATIVE_MODS` com `access` em português simples.
3. `npm test`: o teste de `mods.test.js` valida a definição e a existência dos arquivos.

## 5. Fases

1. **Feito:** registro dinâmico, Reddit-CFMod portado, chave no popup, testes.
2. Permissões opcionais por mod (sair do `<all_urls>` obrigatório).
3. i18n do aiSiteEditor. Hoje só o mod tem pt/en/es, com strings internas.
