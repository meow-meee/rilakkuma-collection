'use strict';

const DATA_URL = './data/collection.json';
const PLACEHOLDER_URL = './images/placeholder.svg';
const CATEGORY_LABELS = Object.freeze({ rilakkuma: '拉拉熊', kiiroitori: '小雞', other: '其他夥伴' });
const IMAGE_LABELS = Object.freeze({ photo: '實際照片', illustration: '示意圖', placeholder: '照片待補' });

const grid = document.querySelector('#collection-grid');
const statusMessage = document.querySelector('#status-message');
const searchInput = document.querySelector('#search-input');
const filterButtons = [...document.querySelectorAll('.filter-button')];
const resultCount = document.querySelector('#result-count');
const totalCount = document.querySelector('#total-count');
const dialog = document.querySelector('#detail-dialog');
const dialogClose = document.querySelector('#dialog-close');

let collection = [];
let activeCategory = 'all';
let lastFocusedCard = null;

function safeImagePath(value) {
  // Only local images inside images/ are accepted; no remote URLs or parent traversal.
  return typeof value === 'string' && /^\.?\/?images\/[a-z0-9][a-z0-9-]*\.(?:png|jpg|jpeg|webp|gif|svg)$/i.test(value)
    ? (value.startsWith('./') ? value : `./${value}`)
    : PLACEHOLDER_URL;
}

function isValidItem(item) {
  return item && typeof item === 'object' && !Array.isArray(item) &&
    typeof item.id === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.id) &&
    ['name', 'location', 'description', 'image'].every(key => typeof item[key] === 'string' && item[key].trim().length > 0);
}

function normalizedCategory(item) {
  return Object.hasOwn(CATEGORY_LABELS, item.category) ? item.category : 'other';
}

function normalizedImageType(item) {
  return Object.hasOwn(IMAGE_LABELS, item.imageType) ? item.imageType : null;
}

function imageWithFallback(source, alt, lazy = true) {
  const img = document.createElement('img');
  img.src = safeImagePath(source);
  img.alt = alt;
  img.loading = lazy ? 'lazy' : 'eager';
  img.decoding = 'async';
  img.addEventListener('error', () => {
    if (!img.src.endsWith('/images/placeholder.svg')) img.src = PLACEHOLDER_URL;
  });
  return img;
}

function locationIcon() {
  const span = document.createElement('span');
  span.setAttribute('aria-hidden', 'true');
  span.textContent = '⌖';
  return span;
}

function buildCard(item) {
  const card = document.createElement('button');
  card.className = 'collection-card';
  card.type = 'button';
  card.setAttribute('aria-label', `查看${item.name}的收藏詳情`);

  const picture = document.createElement('span');
  picture.className = 'card-picture';
  picture.append(imageWithFallback(item.image, `${item.name}的收藏圖片`));

  const tag = document.createElement('span');
  tag.className = 'card-tag';
  tag.textContent = CATEGORY_LABELS[normalizedCategory(item)];
  picture.append(tag);

  const body = document.createElement('span');
  body.className = 'card-body';
  const name = document.createElement('span');
  name.className = 'card-name';
  name.textContent = item.name;
  const location = document.createElement('span');
  location.className = 'card-location';
  location.append(locationIcon(), document.createTextNode(item.location));
  const footer = document.createElement('span');
  footer.className = 'card-footer';
  const footerText = document.createElement('span');
  footerText.textContent = '看看我的故事';
  const arrow = document.createElement('span');
  arrow.className = 'arrow';
  arrow.setAttribute('aria-hidden', 'true');
  arrow.textContent = '↗';
  footer.append(footerText, arrow);
  body.append(name, location, footer);
  card.append(picture, body);
  card.addEventListener('click', () => openDetails(item, card));
  return card;
}

function setStatus(title, detail, withRetry = false) {
  statusMessage.replaceChildren();
  const icon = document.createElement('span');
  icon.className = 'status-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = withRetry ? '☁' : '♡';
  const heading = document.createElement('strong');
  heading.textContent = title;
  const text = document.createElement('p');
  text.textContent = detail;
  statusMessage.append(icon, heading, text);
  if (withRetry) {
    const retry = document.createElement('button');
    retry.className = 'status-retry';
    retry.type = 'button';
    retry.textContent = '再試一次';
    retry.addEventListener('click', loadCollection);
    statusMessage.append(retry);
  }
  statusMessage.hidden = false;
}

function renderCollection() {
  const keyword = searchInput.value.trim().toLocaleLowerCase();
  const filtered = collection.filter(item =>
    (activeCategory === 'all' || normalizedCategory(item) === activeCategory) &&
    item.name.toLocaleLowerCase().includes(keyword)
  );
  const fragment = document.createDocumentFragment();
  for (const item of filtered) fragment.append(buildCard(item));
  grid.replaceChildren(fragment);
  grid.setAttribute('aria-busy', 'false');
  resultCount.textContent = `找到 ${filtered.length} 個小夥伴`;
  statusMessage.hidden = true;
  if (collection.length === 0) setStatus('收藏室還是空的', '可以在 data/collection.json 新增第一筆收藏。');
  else if (filtered.length === 0) setStatus('這次沒有找到小夥伴', '換個名字，或試試其他分類吧！');
}

function openDetails(item, card) {
  lastFocusedCard = card;
  document.querySelector('#detail-title').textContent = item.name;
  document.querySelector('#detail-location').textContent = item.location;
  document.querySelector('#detail-description').textContent = item.description;
  document.querySelector('#detail-category').textContent = CATEGORY_LABELS[normalizedCategory(item)];
  const imageWrap = document.querySelector('.detail-image-wrap');
  const oldImage = document.querySelector('#detail-image');
  const replacement = imageWithFallback(item.image, `${item.name}的收藏圖片`, false);
  replacement.id = 'detail-image';
  oldImage.replaceWith(replacement);
  const typeBadge = document.querySelector('#detail-image-type');
  const imageType = normalizedImageType(item);
  typeBadge.hidden = !imageType;
  typeBadge.textContent = imageType ? IMAGE_LABELS[imageType] : '';
  // The image wrapper is intentionally shared by every item.
  if (!imageWrap.contains(replacement)) imageWrap.prepend(replacement);
  dialog.showModal();
  dialogClose.focus();
}

function closeDetails() { if (dialog.open) dialog.close(); }
dialogClose.addEventListener('click', closeDetails);
dialog.addEventListener('click', event => { if (event.target === dialog) closeDetails(); });
dialog.addEventListener('close', () => {
  if (lastFocusedCard && lastFocusedCard.isConnected) lastFocusedCard.focus();
  lastFocusedCard = null;
});

searchInput.addEventListener('input', renderCollection);
filterButtons.forEach(button => button.addEventListener('click', () => {
  activeCategory = button.dataset.category;
  filterButtons.forEach(filter => {
    const selected = filter === button;
    filter.classList.toggle('is-active', selected);
    filter.setAttribute('aria-pressed', String(selected));
  });
  renderCollection();
}));

async function loadCollection() {
  grid.setAttribute('aria-busy', 'true');
  statusMessage.hidden = true;
  resultCount.textContent = '正在整理收藏中…';
  try {
    const response = await fetch(DATA_URL, { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (!Array.isArray(data)) throw new Error('收藏資料必須是 JSON 陣列');
    const ids = new Set();
    for (const [index, item] of data.entries()) {
      if (!isValidItem(item)) throw new Error(`第 ${index + 1} 筆收藏格式不正確`);
      if (ids.has(item.id)) throw new Error(`重複的收藏 ID：${item.id}`);
      ids.add(item.id);
    }
    collection = data;
    totalCount.textContent = String(collection.length).padStart(2, '0');
    renderCollection();
  } catch (error) {
    console.error('無法載入收藏資料：', error);
    collection = [];
    grid.replaceChildren();
    grid.setAttribute('aria-busy', 'false');
    totalCount.textContent = '—';
    resultCount.textContent = '收藏資料無法顯示';
    setStatus('收藏室暫時打不開', '請確認 data/collection.json 存在、格式正確，並使用網頁伺服器開啟。', true);
  }
}

loadCollection();
