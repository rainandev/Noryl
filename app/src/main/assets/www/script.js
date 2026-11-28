// ===================================================================
// NORYL — tela inicial, vídeo de apresentação, tela do título e menu
// Todos os tempos (em segundos) foram medidos quadro a quadro no vídeo de referência.
// ===================================================================

const $ = (id) => document.getElementById(id);
const at = (s, fn) => setTimeout(fn, s * 1000);

// ---------- ESCALA DO PALCO ----------
// Mantém o palco 1920x1080 inteiro na tela, sem distorcer.
function fitStage() {
  const scale = Math.min(innerWidth / 1920, innerHeight / 1080);
  $('stage').style.setProperty('--scale', scale);
}
addEventListener('resize', fitStage);
fitStage();

// ---------- AJUDANTES DE ANIMAÇÃO ----------
// Opacidade por pontos: keys = [[segundo, opacidade], ...], contados a partir de "agora".
function anima(el, keys) {
  const start = keys[0][0], end = keys[keys.length - 1][0], dur = end - start;
  const frames = keys.map(([t, o]) => ({ offset: dur ? (t - start) / dur : 1, opacity: o }));
  el.animate(frames, { delay: start * 1000, duration: Math.max(dur, 0.001) * 1000, fill: 'both' });
}

// Desloca os tempos de uma lista de pontos (para a parte que começa no toque).
const desloca = (keys, d) => keys.map(([t, v]) => [t - d, v]);

// ---------- TROCA DE TELAS ----------
function mostraTela(id) {
  document.querySelectorAll('.tela').forEach((t) => t.classList.toggle('escondida', t.id !== id));
}
function cortina(fechar) {
  $('cortina').classList.toggle('fechada', fechar);
}

// ===================================================================
// TELA 0 — TOQUE PARA INICIAR
// O primeiro toque libera o som do vídeo (regra dos navegadores de celular).
// ===================================================================
$('tela-inicio').addEventListener('click', () => {
  // No navegador pede tela cheia; no app Android ele já abre em tela cheia (?app=1)
  const noApp = location.search.includes('app=1');
  const pedirTelaCheia = document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen;
  if (!noApp) {
    try { pedirTelaCheia && pedirTelaCheia.call(document.documentElement).catch?.(() => {}); } catch (e) {}
  }
  liberaVideos();
  iniciaIntro();
}, { once: true });

// No iPhone, cada vídeo com som só pode tocar se for "liberado" dentro de um toque.
// Aqui todos os vídeos do jogo são liberados no primeiro toque.
function liberaVideos() {
  ['cena', 'loop-a', 'loop-b'].forEach((id) => {
    const v = $(id);
    const p = v.play();
    if (p && p.then) p.then(() => { v.pause(); v.currentTime = 0; }).catch(() => {});
  });
}

// ===================================================================
// TELA 1 — VÍDEO DE APRESENTAÇÃO (com botão discreto de pular)
// ===================================================================
let introAcabou = false;

function iniciaIntro() {
  const video = $('intro-video');
  video.controls = false;
  mostraTela('tela-intro');
  video.currentTime = 0;
  video.play().catch(() => { video.muted = true; video.play(); }); // se o som for bloqueado, roda mudo
  $('cena').load();                    // já deixa a cena do título carregando
  at(3, () => $('pular').classList.add('visivel'));
  video.addEventListener('ended', () => fimDaIntro(false), { once: true });
  // Se o aparelho abrir o vídeo no player dele e o jogador fechar, segue para o título
  video.addEventListener('webkitendfullscreen', () => fimDaIntro(true), { once: true });
}

$('pular').addEventListener('click', (e) => {
  e.stopPropagation();
  $('pular').classList.remove('visivel');
  cortina(true);                       // escurece em 0,8s
  at(0.85, () => fimDaIntro(true));
});

function fimDaIntro(pulou) {
  if (introAcabou) return;
  introAcabou = true;
  const video = $('intro-video');
  video.pause();
  video.removeAttribute('src');        // libera memória do celular
  video.load();
  if (document.webkitFullscreenElement === video && document.webkitExitFullscreen) document.webkitExitFullscreen();
  mostraTela('tela-menu');
  iniciaTelaTitulo();
  if (pulou) at(0.05, () => cortina(false));
}

// ===================================================================
// TELA 2 — CENA EM VÍDEO
// 1,7s de tela preta depois da intro; depois o vídeo mostra o rosto, os quadros
// e o título surgindo e PAUSA aos 3,88s (logo antes do primeiro efeito), esperando o toque.
// No toque ele continua: efeitos, quadros saem, rosto se aproxima, título sobe, sangue, luz.
// Quando termina, entra o fundo do menu em loop. Os botões são os elementos reais, por cima.
// ===================================================================
const PRETO = 1.7;          // segundos de tela preta antes da interface
const PAUSA = 3.88;         // segundo do vídeo em que ele espera o toque
let podeTocarTitulo = false;

function iniciaTelaTitulo() {
  const cena = $('cena');
  cena.currentTime = 0;
  ['loop-a', 'loop-b'].forEach((id) => $(id).load());   // deixa o loop carregando
  at(PRETO, () => {
    cena.play().catch(() => { cena.muted = true; cena.play(); });
    pausaEm(cena, PAUSA, () => { podeTocarTitulo = true; });
  });
}

// Pausa o vídeo exatamente num segundo (confere a cada quadro desenhado)
function pausaEm(video, segundo, depois) {
  const confere = () => {
    if (video.currentTime >= segundo - 0.02) {
      video.pause();
      depois();
      return;
    }
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(confere);
    else requestAnimationFrame(confere);
  };
  confere();
}

$('tela-menu').addEventListener('click', () => {
  if (!podeTocarTitulo) return;
  podeTocarTitulo = false;
  transicaoParaMenu();
});

// ===================================================================
// TRANSIÇÃO PARA O MENU (no toque o vídeo continua; os botões entram por cima)
// Os tempos dos botões são os do vídeo, contados a partir de onde ele está.
// ===================================================================
function transicaoParaMenu() {
  const cena = $('cena');
  cena.addEventListener('playing', () => {
    const agora = cena.currentTime;

    // Menu: cada linha pisca como neon falhando até firmar (quadros de 1/25s)
    const Q = 1 / 25;
    const pisca = (t0, seq) => desloca(seq.map((o, i) => [t0 + i * Q, o]), agora);
    anima($('linha-exit'),     pisca(6.08, [0, .7, 1, 0, 1, 0, .7, 1, 0, 0, 0, 0, 1]));
    anima($('linha-continue'), pisca(6.12, [0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1]));
    anima($('linha-newgame'),  pisca(6.28, [0, .3, 1, 0, .8, 1, 1, .6, 0, .6, 1, .6, .6, 1]));
    anima($('linha-settings'), pisca(6.44, [0, .3, 1, 0, 1, 0, .4, 1, 0, 0, 0, .8, 1]));

    // Quando o menu firma, libera os toques nas opções
    at(7.0 - agora, () => $('tela-menu').classList.add('menu-ativo'));
  }, { once: true });
  cena.addEventListener('ended', iniciaLoopDoMenu, { once: true });
  cena.play().catch(() => { cena.muted = true; cena.play(); });
}

// Fundo do menu em loop: dois vídeos se revezam. Um pouco antes de um acabar,
// o outro começa do zero e só aparece quando o primeiro quadro dele já está na tela.
function iniciaLoopDoMenu() {
  const a = $('loop-a'), b = $('loop-b');
  let atual = a, proximo = b;

  const mostra = (video, depois) => {
    const quandoDesenhar = () => {
      video.classList.add('visivel');
      depois && depois();
    };
    if (video.requestVideoFrameCallback) video.requestVideoFrameCallback(quandoDesenhar);
    else video.addEventListener('playing', quandoDesenhar, { once: true });
  };

  const vigia = () => {
    if (atual.duration && atual.currentTime >= atual.duration - 0.12) {
      const sai = atual;
      proximo.currentTime = 0;
      proximo.play().catch(() => { proximo.muted = true; proximo.play(); });
      mostra(proximo, () => { sai.classList.remove('visivel'); sai.pause(); });
      [atual, proximo] = [proximo, atual];
    }
    requestAnimationFrame(vigia);
  };

  a.currentTime = 0;
  a.play().catch(() => { a.muted = true; a.play(); });
  mostra(a, () => { $('cena').style.visibility = 'hidden'; });
  requestAnimationFrame(vigia);
}

// ===================================================================
// MENU — 1º toque seleciona (pincelada + negrito), 2º toque confirma
// ===================================================================
const PINCEL_FECHADO = 'inset(0 1779px 0 0)';
const PINCEL_ENTRA = [   // entrada medida no vídeo: 0,2s, rápida no começo
  { offset: 0,   clipPath: 'inset(0 1779px 0 0)', opacity: 0.6 },
  { offset: 0.1, clipPath: 'inset(0 1655px 0 0)', opacity: 0.75 },
  { offset: 0.3, clipPath: 'inset(0 1439px 0 0)', opacity: 1 },
  { offset: 0.5, clipPath: 'inset(0 1333px 0 0)', opacity: 1 },
  { offset: 0.7, clipPath: 'inset(0 1240px 0 0)', opacity: 1 },
  { offset: 1,   clipPath: 'inset(0 1160px 0 0)', opacity: 1 }
];
let ativa = null;      // linha selecionada
let ocupado = false;   // trava durante a troca de tela

function seleciona(item) {
  const nova = item ? $('linha-' + item) : null;
  if (nova === ativa) return;
  if (ativa) {         // saída rápida: 0,08s
    const img = ativa.querySelector('.pincel img');
    const atual = getComputedStyle(img).clipPath;
    img.getAnimations().forEach((a) => a.cancel());
    img.animate([{ clipPath: atual }, { clipPath: PINCEL_FECHADO }], { duration: 80, easing: 'ease-in', fill: 'forwards' });
    ativa.classList.remove('ativa');
  }
  if (nova) {
    const img = nova.querySelector('.pincel img');
    img.getAnimations().forEach((a) => a.cancel());
    img.animate(PINCEL_ENTRA, { duration: 200, fill: 'forwards' });
    nova.classList.add('ativa');
  }
  ativa = nova;
}

document.querySelectorAll('.toque-opcao').forEach((botao) => {
  botao.addEventListener('click', (e) => {
    e.stopPropagation();
    if (ocupado) return;
    const item = botao.dataset.item;
    if (ativa && ativa.id === 'linha-' + item) confirma(item);  // 2º toque
    else seleciona(item);                                       // 1º toque
  });
});

// Toque fora das opções tira a seleção
$('tela-menu').addEventListener('click', () => {
  if ($('tela-menu').classList.contains('menu-ativo') && !ocupado) seleciona(null);
});

// ===================================================================
// CONFIRMAÇÃO — por enquanto cada opção abre uma tela provisória
// (aqui vamos ligar as telas de verdade quando você mandar)
// ===================================================================
const NOMES = { newgame: 'NEW GAME', continue: 'CONTINUE', settings: 'SETTINGS', exit: 'EXIT' };

function confirma(item) {
  ocupado = true;
  cortina(true);
  at(0.85, () => {
    $('provisoria-texto').textContent = NOMES[item] + ' — EM BREVE';
    mostraTela('tela-provisoria');
    cortina(false);
    at(0.8, () => { ocupado = false; });
  });
}

$('tela-provisoria').addEventListener('click', () => {
  if (ocupado) return;
  ocupado = true;
  cortina(true);
  at(0.85, () => {
    seleciona(null);
    mostraTela('tela-menu');
    cortina(false);
    at(0.8, () => { ocupado = false; });
  });
});
