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

// Curva suave (interpolação cúbica monotônica) entre pontos medidos:
// a velocidade muda sem nenhum tranco e termina parando devagar.
function curvaSuave(keys) {
  const n = keys.length, xs = keys.map((k) => k[0]), ys = keys.map((k) => k[1]);
  const d = [], m = [];
  for (let i = 0; i < n - 1; i++) d.push((ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]));
  m[0] = d[0]; m[n - 1] = 0;
  for (let i = 1; i < n - 1; i++) {
    if (d[i - 1] * d[i] <= 0) { m[i] = 0; continue; }
    const w1 = 2 * (xs[i + 1] - xs[i]) + (xs[i] - xs[i - 1]);
    const w2 = (xs[i + 1] - xs[i]) + 2 * (xs[i] - xs[i - 1]);
    m[i] = (w1 + w2) / (w1 / d[i - 1] + w2 / d[i]);
  }
  return (t) => {
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0; while (t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i], s = (t - xs[i]) / h;
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s;
    const h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return h00 * ys[i] + h10 * h * m[i] + h01 * ys[i + 1] + h11 * h * m[i + 1];
  };
}

// Varredura dos quadros: keys = [[segundo, fração da tela], ...]
function varre(el, keys) {
  const t0 = keys[0][0], t1 = keys[keys.length - 1][0], f = curvaSuave(keys), passos = 60;
  const frames = [];
  for (let k = 0; k <= passos; k++) {
    const p = (10 + f(t0 + (t1 - t0) * k / passos) * 80) + '% 0';
    frames.push({ offset: k / passos, maskPosition: p, webkitMaskPosition: p });
  }
  el.animate(frames, { delay: t0 * 1000, duration: (t1 - t0) * 1000, fill: 'both' });
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
  iniciaIntro();
}, { once: true });

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
  carregaQuadrosTitulo();              // já deixa a animação do título carregando
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
// ANIMAÇÃO DAS LETRAS DO TÍTULO
// São os 65 quadros do seu vídeo (25 por segundo), desenhados num canvas.
// Usar imagens em vez de vídeo garante que o celular nunca abra um player.
// ===================================================================
const QUADROS_TITULO = 65, FPS_TITULO = 25;
const quadrosTitulo = [];
function carregaQuadrosTitulo() {
  if (quadrosTitulo.length) return;
  for (let i = 0; i < QUADROS_TITULO; i++) {
    const img = new Image();
    img.src = `img/titulo/${String(i).padStart(2, '0')}.jpg`;
    quadrosTitulo.push(img);
  }
}
function tocaAnimacaoTitulo() {
  const canvas = $('titulo-video'), ctx = canvas.getContext('2d');
  const inicio = performance.now();
  let ultimo = -1;
  (function desenha(agora) {
    const q = Math.max(0, Math.min(QUADROS_TITULO - 1, Math.floor((agora - inicio) / 1000 * FPS_TITULO)));
    if (q !== ultimo && quadrosTitulo[q].complete) {
      ctx.drawImage(quadrosTitulo[q], 0, 0, 960, 600);
      ultimo = q;
    }
    if (q < QUADROS_TITULO - 1 || ultimo !== q) requestAnimationFrame(desenha);
  })(inicio);
}

// ===================================================================
// TELA 2 — TÍTULO (parte automática, até o título acender)
// ===================================================================
let podeTocarTitulo = false;

function iniciaTelaTitulo() {
  // Rosto surge do escuro (0,36s a 1,4s)
  $('rosto').animate([{ opacity: 0 }, { opacity: 1 }],
    { delay: 360, duration: 1040, easing: 'cubic-bezier(.2, .6, .4, 1)', fill: 'both' });

  // Quadros entram da direita para a esquerda
  varre($('entra-cima'),  [[0.21, 0], [0.26, .10], [0.32, .23], [0.36, .34], [0.40, .40], [0.50, .46],
                           [0.60, .52], [0.70, .57], [0.80, .61], [0.90, .65], [1.00, .69], [1.10, .72],
                           [1.20, .75], [1.30, .79], [1.40, .84], [1.50, .90], [1.60, .955], [1.70, .99], [1.80, 1]]);
  varre($('entra-baixo'), [[0.21, 0], [0.26, .17], [0.32, .27], [0.36, .37], [0.40, .45], [0.48, .56],
                           [0.56, .63], [0.64, .69], [0.72, .75], [0.80, .81], [0.90, .88], [1.00, .93],
                           [1.12, .975], [1.26, 1]]);

  // Título: letras se formam na animação; aos 2,3s o PNG original acende enquanto o vídeo apaga (1,6s)
  const tv = $('titulo-video');
  tocaAnimacaoTitulo();
  at(2.3, () => {
    const troca = { duration: 1600, easing: 'ease-in-out', fill: 'forwards' };
    tv.animate([{ opacity: 1 }, { opacity: 0 }], troca);
    $('titulo-png').animate([{ opacity: 0 }, { opacity: 1 }], troca);
  });

  // A partir dos 4s (título totalmente aceso) espera o toque do jogador
  at(4, () => { podeTocarTitulo = true; });
}

$('tela-menu').addEventListener('click', () => {
  if (!podeTocarTitulo) return;
  podeTocarTitulo = false;
  transicaoParaMenu();
});

// ===================================================================
// TRANSIÇÃO PARA O MENU (começa no toque)
// No vídeo de referência essa parte começa aos 4,1s; aqui ela começa no toque,
// então todos os tempos abaixo são "tempo do vídeo - 4,1".
// ===================================================================
const T0 = 4.1;

function transicaoParaMenu() {
  // Quadros saem: varredura da direita para a esquerda
  const VARREDURA = [[4.1, 0], [4.2, .27], [4.4, .42], [4.6, .53], [4.8, .61], [5.0, .70], [5.2, .78], [5.4, .90], [5.6, 1]];
  varre($('quadro-cima'),  desloca(VARREDURA, T0));
  varre($('quadro-baixo'), desloca(VARREDURA, T0));

  // Rosto se aproxima até 109,43%
  const APROXIMA = desloca([[4.62, 0], [4.70, .022], [4.78, .063], [4.86, .128], [4.94, .215], [5.02, .339],
    [5.10, .509], [5.18, .666], [5.26, .794], [5.34, .88], [5.42, .934], [5.50, .978], [5.58, .989], [5.72, 1]], T0);
  const a0 = APROXIMA[0][0], a1 = APROXIMA[APROXIMA.length - 1][0];
  $('rosto').animate(
    APROXIMA.map(([t, p]) => ({ offset: (t - a0) / (a1 - a0), transform: `scale(${1 + 0.0943 * p})` })),
    { delay: a0 * 1000, duration: (a1 - a0) * 1000, fill: 'both' });

  // Título sobe para a posição final
  at(4.75 - T0, () => {
    $('titulo').classList.add('sobe', 'normal-blend');
    $('titulo-video').style.display = 'none';
  });

  // Luz acende devagar e pisca uma vez
  anima($('luz'), desloca([[6.5, 0], [7.9, 1], [9.25, 1], [9.3, 0.25], [9.4, 0], [9.5, 1], [9.6, 0], [9.7, 0.7], [9.8, 1]], T0));

  // Sangue
  anima($('sangue-n'),     desloca([[6.12, 0], [6.20, 0.2], [6.24, 0.5], [6.28, 0.8], [6.32, 0.95], [6.42, 1]], T0));
  anima($('sangue-rosto'), desloca([[6.44, 0], [6.60, 1]], T0));
  anima($('sangue-canto'), desloca([[6.48, 0], [6.72, 1]], T0));
  anima($('sangue-topo'),  desloca([[6.95, 0], [7.6, 1]], T0));

  // Menu: cada linha pisca como neon falhando até firmar (quadros de 1/25s)
  const Q = 1 / 25;
  const pisca = (t0, seq) => desloca(seq.map((o, i) => [t0 + i * Q, o]), T0);
  anima($('linha-exit'),     pisca(6.08, [0, .7, 1, 0, 1, 0, .7, 1, 0, 0, 0, 0, 1]));
  anima($('linha-continue'), pisca(6.12, [0, 1, 1, 0, 1, 0, 1, 1, 0, 0, 0, 0, 1]));
  anima($('linha-newgame'),  pisca(6.28, [0, .3, 1, 0, .8, 1, 1, .6, 0, .6, 1, .6, .6, 1]));
  anima($('linha-settings'), pisca(6.44, [0, .3, 1, 0, 1, 0, .4, 1, 0, 0, 0, .8, 1]));

  // Quando o menu firma, libera os toques nas opções
  at(7.0 - T0, () => $('tela-menu').classList.add('menu-ativo'));
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
