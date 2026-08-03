/* =========================================================
   NerdLab — script.js
   Loja 100% estática. Catálogo carregado de uma planilha
   pública do Google Sheets (convertida para CSV) e imagens
   servidas a partir de uma pasta pública do Google Drive.
   ========================================================= */

/* ---------------------------------------------------------
   1) CONFIGURAÇÃO
   --------------------------------------------------------- */
const CONFIG = {
  // ID da planilha (retirado da URL compartilhada)
  SHEET_ID: '1Cx63e7xOVnNJjTV_JCnW8Xqe18MfdpvxI3AuRwU7DAI',

  // gid da aba a ser lida. 0 = primeira aba da planilha.
  // Se o catálogo estiver em outra aba, troque o gid aqui
  // (o gid aparece na URL da planilha depois de "#gid=").
  SHEET_GID: '0',

  // Número de WhatsApp da loja (formato internacional, só dígitos)
  WHATSAPP_NUMBER: '5521978721561',
};

const CSV_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&gid=${CONFIG.SHEET_GID}`;

/* ---------------------------------------------------------
   2) UTILITÁRIOS
   --------------------------------------------------------- */

// Parser de CSV simples, tolerante a vírgulas e quebras de
// linha dentro de campos entre aspas.
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (inQuotes) {
      if (char === '"' && next === '"') { field += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { field += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ',') { row.push(field); field = ''; }
      else if (char === '\r') { /* ignore */ }
      else if (char === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += char;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }

  return rows.filter(r => r.some(c => c.trim() !== ''));
}

// Converte as linhas do CSV em uma lista de objetos, usando a
// primeira linha como cabeçalho. Os nomes das colunas viram
// chaves em MAIÚSCULO e sem espaços extras.
function csvToProducts(rows) {
  const header = rows[0].map(h => h.trim().toUpperCase());
  return rows.slice(1).map(cols => {
    const obj = {};
    header.forEach((key, i) => { obj[key] = (cols[i] || '').trim(); });
    return obj;
  });
}

// Transforma qualquer link de compartilhamento do Google Drive
// (ou já um link direto) em uma URL de imagem exibível.
function driveImageUrl(rawUrl) {
  if (!rawUrl) return '';
  const url = rawUrl.trim();

  // .../file/d/FILE_ID/view...  ou  .../d/FILE_ID
  let match = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  // ...?id=FILE_ID  ou  &id=FILE_ID
  if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);

  if (match) {
    const id = match[1];
    return `https://lh3.googleusercontent.com/d/${id}=w800`;
  }
  // Já é um link direto de imagem (ex: hospedado em outro lugar)
  return url;
}

// Fallback caso a primeira URL de imagem falhe ao carregar
function driveImageFallback(rawUrl) {
  const match = rawUrl && rawUrl.match(/\/d\/([a-zA-Z0-9_-]{15,})/) || (rawUrl && rawUrl.match(/[?&]id=([a-zA-Z0-9_-]{15,})/));
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return PLACEHOLDER_IMG;
}

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="#1a1a1f"/>
    <text x="50%" y="50%" fill="#616169" font-family="monospace" font-size="20"
      text-anchor="middle" dominant-baseline="middle">imagem indisponível</text>
  </svg>`);

function formatBRL(value) {
  const n = parseFloat(String(value).replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (isNaN(n)) return value || '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function buildWhatsappLink(number, message) {
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

function normalize(str) {
  return (str || '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/* ---------------------------------------------------------
   3) ESTADO
   --------------------------------------------------------- */
let ALL_PRODUCTS = [];
let currentFilter = 'todos';
let currentSearch = '';

/* ---------------------------------------------------------
   4) RENDERIZAÇÃO DOS CARDS
   --------------------------------------------------------- */
const grid = document.getElementById('productGrid');
const template = document.getElementById('cardTemplate');
const statusEl = document.getElementById('catalogStatus');
const emptyEl = document.getElementById('emptyState');

function statusIsActive(status) {
  const s = normalize(status);
  if (!s) return true; // se a coluna estiver vazia, assume ativo
  return !['inativo', 'pausado', 'oculto', 'desativado'].includes(s);
}

function renderProducts(list) {
  grid.innerHTML = '';

  if (!list.length) {
    emptyEl.hidden = false;
    return;
  }
  emptyEl.hidden = true;

  const frag = document.createDocumentFragment();

  list.forEach(p => {
    const node = template.content.cloneNode(true);

    const img = node.querySelector('.card-img');
    const skeleton = node.querySelector('.skeleton');
    const primarySrc = driveImageUrl(p.IMAGEM);
    const fallbackSrc = driveImageFallback(p.IMAGEM);

    img.alt = p.NOME_PRODUTO || 'Produto NerdLab';
    img.src = primarySrc || PLACEHOLDER_IMG;
    img.addEventListener('load', () => { img.classList.add('loaded'); skeleton.style.display = 'none'; });
    img.addEventListener('error', () => {
      if (img.dataset.step === 'fallback') { img.src = PLACEHOLDER_IMG; img.dataset.step = 'placeholder'; }
      else if (img.dataset.step !== 'placeholder') { img.dataset.step = 'fallback'; img.src = fallbackSrc; }
    });

    node.querySelector('.card-cat').textContent = p.CATEGORIA || '';
    node.querySelector('.card-name').textContent = p.NOME_PRODUTO || 'Produto';
    node.querySelector('.card-desc').textContent = p.DESCRICAO || '';
    node.querySelector('.card-price').textContent = formatBRL(p.PRECO);

    const featuredBadge = node.querySelector('.card-badge-featured');
    if (normalize(p.DESTAQUE) !== 'sim') featuredBadge.hidden = true;

    const stockBadge = node.querySelector('.card-badge-stock');
    const estoque = parseInt(String(p.ESTOQUE).replace(/\D/g, ''), 10);
    if (!isNaN(estoque)) {
      if (estoque <= 0) stockBadge.textContent = 'Sob encomenda';
      else if (estoque <= 3) stockBadge.textContent = `Últimas ${estoque} un.`;
      else stockBadge.hidden = true;
    } else {
      stockBadge.hidden = true;
    }

    const buyBtn = node.querySelector('.card-buy');
    const msg = `Olá, tenho interesse no produto ${p.NOME_PRODUTO} da NerdLab.`;
    buyBtn.href = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, msg);

    frag.appendChild(node);
  });

  grid.appendChild(frag);
}

function applyFilters() {
  const filtered = ALL_PRODUCTS.filter(p => {
    if (!statusIsActive(p.STATUS)) return false;

    const matchesFilter =
      currentFilter === 'todos' ||
      normalize(p.CATEGORIA).includes(normalize(currentFilter));

    const matchesSearch =
      !currentSearch ||
      normalize(p.NOME_PRODUTO).includes(currentSearch) ||
      normalize(p.DESCRICAO).includes(currentSearch);

    return matchesFilter && matchesSearch;
  });

  // Destaques primeiro
  filtered.sort((a, b) => (normalize(b.DESTAQUE) === 'sim') - (normalize(a.DESTAQUE) === 'sim'));

  renderProducts(filtered);
}

/* ---------------------------------------------------------
   5) BUSCA E FILTROS
   --------------------------------------------------------- */
document.getElementById('searchInput').addEventListener('input', (e) => {
  currentSearch = normalize(e.target.value.trim());
  applyFilters();
});

document.querySelectorAll('.chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    currentFilter = chip.dataset.filter;
    applyFilters();
  });
});

/* ---------------------------------------------------------
   6) CARREGAMENTO DA PLANILHA
   --------------------------------------------------------- */
async function loadProducts() {
  try {
    const sep = CSV_URL.includes('?') ? '&' : '?';
    const bust = `${sep}_=${Date.now()}`; // evita cache do navegador
    const res = await fetch(CSV_URL + bust);
    if (!res.ok) throw new Error('Falha ao buscar a planilha (' + res.status + ')');

    const text = await res.text();
    const rows = parseCSV(text);
    if (!rows.length) throw new Error('Planilha vazia');

    ALL_PRODUCTS = csvToProducts(rows);
    statusEl.hidden = true;
    applyFilters();
  } catch (err) {
    console.error(err);
    statusEl.classList.add('error');
    statusEl.innerHTML =
      'Não foi possível carregar o catálogo agora. Verifique se a planilha está compartilhada como "Qualquer pessoa com o link".';
  }
}

/* ---------------------------------------------------------
   7) LINKS DE WHATSAPP GERAIS + UI DIVERSA
   --------------------------------------------------------- */
function setupWhatsappLinks() {
  const generalMsg = 'Olá, tenho interesse nos produtos da NerdLab.';
  const link = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, generalMsg);
  ['headerWhatsapp', 'ctaWhatsapp', 'footerWhatsapp', 'floatWhatsapp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = link;
  });
}

function setupNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
  nav.querySelectorAll('a').forEach(a => a.addEventListener('click', () => nav.classList.remove('open')));
}

function setupYear() {
  document.getElementById('year').textContent = new Date().getFullYear();
}

/* ---------------------------------------------------------
   8) INIT
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  setupWhatsappLinks();
  setupNav();
  setupYear();
  loadProducts();
});
