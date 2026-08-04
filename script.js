/* =========================================================
   Nerd Lab — script.js (v2)
   Loja 100% estática. Catálogo carregado de uma planilha
   pública do Google Sheets (convertida para CSV) e imagens
   servidas a partir de uma pasta pública do Google Drive.
   Carrinho guardado em localStorage (sem backend/banco).
   ========================================================= */

/* ---------------------------------------------------------
   1) CONFIGURAÇÃO
   --------------------------------------------------------- */
const CONFIG = {
  SHEET_ID: '1Cx63e7xOVnNJjTV_JCnW8Xqe18MfdpvxI3AuRwU7DAI',
  SHEET_GID: '0',
  WHATSAPP_NUMBER: '5521978721561',
};

const CSV_URL =
  `https://docs.google.com/spreadsheets/d/${CONFIG.SHEET_ID}/export?format=csv&gid=${CONFIG.SHEET_GID}`;

const CART_STORAGE_KEY = 'nerdlab_cart_v1';

/* ---------------------------------------------------------
   2) UTILITÁRIOS
   --------------------------------------------------------- */
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

function csvToProducts(rows) {
  const header = rows[0].map(h => h.trim().toUpperCase());
  return rows.slice(1).map(cols => {
    const obj = {};
    header.forEach((key, i) => { obj[key] = (cols[i] || '').trim(); });
    return obj;
  });
}

function driveImageUrl(rawUrl) {
  if (!rawUrl) return '';
  const url = rawUrl.trim();
  let match = url.match(/\/d\/([a-zA-Z0-9_-]{15,})/);
  if (!match) match = url.match(/[?&]id=([a-zA-Z0-9_-]{15,})/);
  if (match) return `https://lh3.googleusercontent.com/d/${match[1]}=w800`;
  return url;
}

function driveImageFallback(rawUrl) {
  const match = (rawUrl && rawUrl.match(/\/d\/([a-zA-Z0-9_-]{15,})/)) || (rawUrl && rawUrl.match(/[?&]id=([a-zA-Z0-9_-]{15,})/));
  if (match) return `https://drive.google.com/uc?export=view&id=${match[1]}`;
  return PLACEHOLDER_IMG;
}

const PLACEHOLDER_IMG =
  'data:image/svg+xml;utf8,' + encodeURIComponent(`
  <svg xmlns="http://www.w3.org/2000/svg" width="600" height="600">
    <rect width="600" height="600" fill="#232323"/>
    <text x="50%" y="50%" fill="#6b6b6b" font-family="sans-serif" font-size="20"
      text-anchor="middle" dominant-baseline="middle">imagem indisponível</text>
  </svg>`);

function formatBRL(value) {
  const n = parseFloat(String(value).replace(/[^\d,.-]/g, '').replace(',', '.'));
  if (isNaN(n)) return value || '';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parsePrice(value) {
  const n = parseFloat(String(value).replace(/[^\d,.-]/g, '').replace(',', '.'));
  return isNaN(n) ? 0 : n;
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
let CART = loadCart();

/* ---------------------------------------------------------
   4) RENDERIZAÇÃO DOS CARDS
   --------------------------------------------------------- */
const grid = document.getElementById('productGrid');
const template = document.getElementById('cardTemplate');
const statusEl = document.getElementById('catalogStatus');
const emptyEl = document.getElementById('emptyState');

function statusIsActive(status) {
  const s = normalize(status);
  if (!s) return true;
  return !['inativo', 'pausado', 'oculto', 'desativado'].includes(s);
}

function productKey(p) {
  return (p.ID && p.ID.trim()) || normalize(p.NOME_PRODUTO);
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

    img.alt = p.NOME_PRODUTO || 'Produto Nerd Lab';
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
    const msg = `Olá, tenho interesse no produto ${p.NOME_PRODUTO} da Nerd Lab.`;
    buyBtn.href = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, msg);

    const addBtn = node.querySelector('.card-add');
    addBtn.addEventListener('click', () => {
      addToCart(p, primarySrc);
      addBtn.classList.add('added');
      setTimeout(() => addBtn.classList.remove('added'), 900);
    });

    frag.appendChild(node);
  });

  grid.appendChild(frag);
}

function applyFilters() {
  const filtered = ALL_PRODUCTS.filter(p => {
    if (!statusIsActive(p.STATUS)) return false;

    let matchesFilter;
    if (currentFilter === 'todos') matchesFilter = true;
    else if (currentFilter === 'lançamentos' || currentFilter === 'lancamentos') {
      matchesFilter = normalize(p.DESTAQUE) === 'sim' || normalize(p.CATEGORIA).includes('lancamento');
    } else {
      matchesFilter = normalize(p.CATEGORIA).includes(normalize(currentFilter));
    }

    const matchesSearch =
      !currentSearch ||
      normalize(p.NOME_PRODUTO).includes(currentSearch) ||
      normalize(p.DESCRICAO).includes(currentSearch);

    return matchesFilter && matchesSearch;
  });

  filtered.sort((a, b) => (normalize(b.DESTAQUE) === 'sim') - (normalize(a.DESTAQUE) === 'sim'));

  renderProducts(filtered);
}

function setFilter(filter) {
  currentFilter = filter;
  document.querySelectorAll('.chip').forEach(c => c.classList.toggle('active', c.dataset.filter === filter));
  const select = document.getElementById('categorySelect');
  if (select) select.value = filter;
  applyFilters();
}

/* ---------------------------------------------------------
   5) BUSCA, FILTROS E ATALHOS DE CATEGORIA
   --------------------------------------------------------- */
function setupSearchAndFilters() {
  const searchInput = document.getElementById('searchInput');
  const categorySelect = document.getElementById('categorySelect');
  const searchBtn = document.getElementById('searchBtn');

  function runSearch() {
    currentSearch = normalize(searchInput.value.trim());
    setFilter(categorySelect.value);
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  }

  searchBtn.addEventListener('click', runSearch);
  searchInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runSearch(); });

  document.getElementById('searchInputMirror'); // no-op guard

  document.querySelectorAll('.chip').forEach(chip => {
    chip.addEventListener('click', () => setFilter(chip.dataset.filter));
  });

  // qualquer elemento com data-filter (categorias, promo band, footer, nav) filtra o catálogo
  document.querySelectorAll('[data-filter]:not(.chip)').forEach(el => {
    el.addEventListener('click', (e) => {
      const filter = el.dataset.filter;
      if (!filter) return;
      e.preventDefault();
      setFilter(filter);
      document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
      document.getElementById('mainNav').classList.remove('open');
    });
  });

  document.getElementById('allCategoriesBtn').addEventListener('click', () => {
    setFilter('todos');
    document.getElementById('catalogo').scrollIntoView({ behavior: 'smooth' });
  });

  // busca ao vivo também
  searchInput.addEventListener('input', () => {
    currentSearch = normalize(searchInput.value.trim());
    applyFilters();
  });
}

/* ---------------------------------------------------------
   6) CARREGAMENTO DA PLANILHA
   --------------------------------------------------------- */
async function loadProducts() {
  try {
    const sep = CSV_URL.includes('?') ? '&' : '?';
    const bust = `${sep}_=${Date.now()}`;
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
   7) CARRINHO (localStorage — sem backend)
   --------------------------------------------------------- */
function loadCart() {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

function saveCart() {
  try { localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(CART)); } catch { /* ignore */ }
}

function addToCart(p, imgSrc) {
  const key = productKey(p);
  if (CART[key]) {
    CART[key].qty += 1;
  } else {
    CART[key] = {
      name: p.NOME_PRODUTO || 'Produto',
      price: parsePrice(p.PRECO),
      img: imgSrc || PLACEHOLDER_IMG,
      qty: 1,
    };
  }
  saveCart();
  renderCart();
  openCart();
}

function changeQty(key, delta) {
  if (!CART[key]) return;
  CART[key].qty += delta;
  if (CART[key].qty <= 0) delete CART[key];
  saveCart();
  renderCart();
}

function removeFromCart(key) {
  delete CART[key];
  saveCart();
  renderCart();
}

function cartCount() {
  return Object.values(CART).reduce((sum, item) => sum + item.qty, 0);
}

function cartSubtotal() {
  return Object.values(CART).reduce((sum, item) => sum + item.qty * item.price, 0);
}

function renderCart() {
  const itemsEl = document.getElementById('cartItems');
  const emptyMsg = document.getElementById('cartEmptyMsg');
  const footer = document.getElementById('cartFooter');
  const countBadge = document.getElementById('cartCount');

  const keys = Object.keys(CART);
  const count = cartCount();

  countBadge.textContent = count;
  countBadge.hidden = count === 0;

  itemsEl.innerHTML = '';

  if (!keys.length) {
    emptyMsg.hidden = false;
    footer.hidden = true;
    return;
  }
  emptyMsg.hidden = true;
  footer.hidden = false;

  keys.forEach(key => {
    const item = CART[key];
    const row = document.createElement('div');
    row.className = 'cart-item';
    row.innerHTML = `
      <img src="${item.img}" alt="${item.name}">
      <div class="cart-item-info">
        <h4>${item.name}</h4>
        <span class="cart-item-price">${formatBRL(item.price)}</span>
        <div class="cart-item-qty">
          <button type="button" data-action="dec">−</button>
          <span>${item.qty}</span>
          <button type="button" data-action="inc">+</button>
        </div>
        <button type="button" class="cart-item-remove">remover</button>
      </div>
    `;
    row.querySelector('[data-action="inc"]').addEventListener('click', () => changeQty(key, 1));
    row.querySelector('[data-action="dec"]').addEventListener('click', () => changeQty(key, -1));
    row.querySelector('.cart-item-remove').addEventListener('click', () => removeFromCart(key));
    itemsEl.appendChild(row);
  });

  document.getElementById('cartSubtotal').textContent = formatBRL(cartSubtotal());

  const lines = keys.map(key => {
    const item = CART[key];
    return `• ${item.qty}x ${item.name} — ${formatBRL(item.price)}`;
  });
  const msg =
    `Olá! Quero fechar esse pedido na Nerd Lab:\n\n${lines.join('\n')}\n\nSubtotal: ${formatBRL(cartSubtotal())}`;
  document.getElementById('cartCheckout').href = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, msg);
}

function openCart() {
  document.getElementById('cartDrawer').classList.add('open');
  document.getElementById('cartOverlay').classList.add('open');
}
function closeCart() {
  document.getElementById('cartDrawer').classList.remove('open');
  document.getElementById('cartOverlay').classList.remove('open');
}

function setupCart() {
  renderCart();
  document.getElementById('cartBtn').addEventListener('click', openCart);
  document.getElementById('cartClose').addEventListener('click', closeCart);
  document.getElementById('cartOverlay').addEventListener('click', closeCart);
}

/* ---------------------------------------------------------
   8) MODAL "ENTRAR"
   --------------------------------------------------------- */
function setupAccountModal() {
  const modal = document.getElementById('accountModal');
  const overlay = document.getElementById('accountOverlay');

  function open() { modal.classList.add('open'); overlay.classList.add('open'); }
  function close() { modal.classList.remove('open'); overlay.classList.remove('open'); }

  document.getElementById('accountBtn').addEventListener('click', open);
  document.getElementById('accountClose').addEventListener('click', close);
  overlay.addEventListener('click', close);
}

/* ---------------------------------------------------------
   9) CARROSSEL DO HERO
   --------------------------------------------------------- */
function setupHeroCarousel() {
  const track = document.getElementById('heroTrack');
  const slides = track.children.length;
  const dotsWrap = document.getElementById('heroDots');
  let index = 0;
  let timer;

  for (let i = 0; i < slides; i++) {
    const dot = document.createElement('button');
    if (i === 0) dot.classList.add('active');
    dot.addEventListener('click', () => goTo(i));
    dotsWrap.appendChild(dot);
  }

  function goTo(i) {
    index = (i + slides) % slides;
    track.style.transform = `translateX(-${index * 100}%)`;
    [...dotsWrap.children].forEach((d, di) => d.classList.toggle('active', di === index));
    restart();
  }

  function restart() {
    clearInterval(timer);
    timer = setInterval(() => goTo(index + 1), 5500);
  }

  document.getElementById('heroPrev').addEventListener('click', () => goTo(index - 1));
  document.getElementById('heroNext').addEventListener('click', () => goTo(index + 1));

  const carousel = document.getElementById('heroCarousel');
  carousel.addEventListener('mouseenter', () => clearInterval(timer));
  carousel.addEventListener('mouseleave', restart);

  if (slides > 1) restart();
}

/* ---------------------------------------------------------
   10) LINKS DE WHATSAPP GERAIS + UI DIVERSA
   --------------------------------------------------------- */
function setupWhatsappLinks() {
  const generalMsg = 'Olá, tenho interesse nos produtos da Nerd Lab.';
  const customMsg = 'Olá! Quero fazer uma encomenda personalizada na Nerd Lab.';
  const link = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, generalMsg);
  const customLink = buildWhatsappLink(CONFIG.WHATSAPP_NUMBER, customMsg);

  ['footerWhatsapp', 'floatWhatsapp', 'promoWhatsapp', 'accountWhatsapp'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.href = link;
  });
  document.getElementById('customWhatsapp').href = customLink;
}

function setupNav() {
  const toggle = document.getElementById('navToggle');
  const nav = document.getElementById('mainNav');
  toggle.addEventListener('click', () => nav.classList.toggle('open'));
}

function setupYear() {
  document.getElementById('year').textContent = new Date().getFullYear();
}

/* ---------------------------------------------------------
   11) INIT
   --------------------------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  setupWhatsappLinks();
  setupNav();
  setupYear();
  setupSearchAndFilters();
  setupCart();
  setupAccountModal();
  setupHeroCarousel();
  loadProducts();
});
