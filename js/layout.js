import { accentColor } from './config.js';

// функция для вычисления количества рядов, необходимых для размещения заданного количества элементов с учетом ширины контейнера и отступов
export function getRowCount(total, containerWidth, opts) {
  const itemW = opts.itemW;
  const gap = opts.gap;
  const maxCols = Math.max(1, Math.floor(containerWidth / (itemW + gap)));
  let remaining = total;
  let maxCap = maxCols;
  let rows = 0;
  while (remaining > 0) {
    const rowCount = Math.min(maxCap, remaining);
    remaining -= rowCount;
    maxCap = Math.max(1, maxCap - 1);
    rows++;
  }
  return rows;
}

// функция для расположения элементов внутри контейнера, распределяя их по рядам с уменьшающимся количеством элементов в каждом последующем ряду и добавляя случайный наклон для более естественного вида
export function layoutPanItems(list, opts) {
  if (!list) return;
  const items = Array.from(list.querySelectorAll('.pan-target__item'));
  const total = items.length;
  if (!total) return;

  const itemW = opts.itemW; // ширина одного элемента, включая отступ
  const gap = opts.gap; // горизонтальный отступ между элементами
  const rowSpacing = opts.rowSpacing; // вертикальный отступ между рядами
  const baseBottom = opts.baseBottom; // базовое расстояние от нижней части контейнера до первого ряда
  // вычисляем, сколько элементов может поместиться в самом широком ряду
  const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
  const maxBottomCapacity = Math.max(1, Math.floor(containerWidth / (itemW + gap)));

  // распределяем элементы по рядам, уменьшая количество элементов в каждом последующем ряду
  let remaining = total;
  let maxCap = maxBottomCapacity;
  const rows = [];
  while (remaining > 0) {
    const rowCount = Math.min(maxCap, remaining);
    rows.push(rowCount);
    remaining -= rowCount;
    maxCap = Math.max(1, maxCap - 1);
  }

  // позиционируем элементы в каждом ряду, центрируя их относительно контейнера и добавляя случайный наклон для естественности
  for (let i = 0; i < total; i++) {
    let rowIndex = 0;
    let cum = 0;
    for (let r = 0; r < rows.length; r++) {
      if (i < cum + rows[r]) {
        rowIndex = r;
        break;
      }
      cum += rows[r];
    }
    const col = i - cum;
    const cols = rows[rowIndex];
    // вычисляем горизонтальное смещение для центрирования ряда и добавляем небольшой случайный наклон для более естественного вида
    const offsetX = (col - (cols - 1) / 2) * (itemW + gap);
    // для верхнего ряда добавляем небольшой вертикальный сдвиг центральным элементам для более естественного вида
    let rowOffset = 0;
    if (rowIndex === 0) {
      const isCenter = col > 0 && col < cols - 1;
      if (isCenter) rowOffset = -6;
    }
    // добавляем случайный наклон от -20 до +20 градусов для более естественного вида
    const angle = Math.round((Math.random() * 40) - 20);

    const li = items[i];
    li.style.left = `calc(50% + ${offsetX}px)`;
    const bottom = baseBottom + rowIndex * rowSpacing + rowOffset;
    li.style.bottom = `${bottom}px`;
    // сохраняем угол и индекс в стеке для использования при анимации падения
    li.style.setProperty('--item-rotation', `${angle}deg`);
    li.style.setProperty('--stack-index', String(i - cum));
  }
}

// функция для вычисления целевой позиции для анимации падения элемента, основываясь на центральной точке контейнера и заданных смещениях, которые могут быть определены через атрибуты данных элемента или переданы явно
export function computeTargetPosition(pan, offsets = {}) {
  // вычисляем центральную точку контейнера и добавляем к ней заданные смещения, чтобы получить целевую позицию для анимации падения
  const panRect = pan.getBoundingClientRect();
  const cx = panRect.left + panRect.width / 2;
  const cy = panRect.top + panRect.height / 2;
  const offX = Number(offsets.offsetX ?? pan.dataset.offsetX ?? 0);
  const offY = Number(offsets.offsetY ?? pan.dataset.offsetY ?? 0);
  return { x: Math.round(cx + offX), y: Math.round(cy + offY) };
}

// Устанавливает явную высоту для контейнера элементов внутри панели, аналогично логике в Dropper._updatePanItemsContainerHeight
export function updatePanItemsContainerHeight(list, pan, opts) {
  if (!list) return;
  const items = Array.from(list.querySelectorAll('.pan-target__item'));
  const total = items.length;
  if (!total) {
    list.style.height = '';
    list.style.top = '';
    list.style.bottom = '';
    return;
  }

  const rowSpacing = opts.rowSpacing;
  const baseBottom = opts.baseBottom;
  const itemH = opts.itemH;

  const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
  const rows = getRowCount(total, containerWidth, opts);

  // требуемая высота: смещение снизу верхнего ряда + высота элемента + небольшой запас (6px) для предотвращения обрезки из-за округлений или стилей
  const required = baseBottom + (rows - 1) * rowSpacing + itemH + 6;

  // устанавливаем явную высоту для контейнера элементов, чтобы предотвратить обрезку при позиционировании элементов с отрицательным смещением и обеспечиваем правильное позиционирование относительно нижней части панели
  list.style.height = required + 'px';
  list.style.top = 'auto';
  list.style.bottom = baseBottom + 'px';
  if (pan) {
    pan.style.minHeight = pan.style.minHeight || getComputedStyle(pan).minHeight;
  }
}

// Позиционирование основного блока над стопкой — выносит логику из Dropper._adjustMainForPile
export function adjustMainForPile(pan, opts) {
  if (!pan) return;
  const list = pan.querySelector('.pan-target__items');
  const mainWrap = pan.querySelector('.pan-target__main');
  if (!list || !mainWrap) return;

  // убедиться, что обертка позиционирована (она уже должна быть на CSS)
  mainWrap.style.position = mainWrap.style.position;

  const items = Array.from(list.querySelectorAll('.pan-target__item'));
  const total = items.length;
  const baseBottom = opts.baseBottom;
  const rowSpacing = opts.rowSpacing;
  const itemH = opts.itemH;

  if (!total) {
    mainWrap.style.bottom = baseBottom + 'px';
    return;
  }

  // вычислить количество рядов ,используя тот же алгоритм, что и для layoutPanItems
  const containerWidth = list.clientWidth || list.getBoundingClientRect().width;
  const rows = getRowCount(total, containerWidth, opts);

  const topRowBottom = baseBottom + (rows - 1) * rowSpacing;
  // позиционировать обертку так, чтобы основной элемент располагался над верхним рядом, с учетом заданного перекрытия для создания эффекта стопки
  const overlap = opts.overlap; // сколько пикселей основной элемент должен перекрывать верхний ряд для создания эффекта стопки
  const targetBottom = topRowBottom + itemH - overlap;
  mainWrap.style.bottom = Math.max(baseBottom, targetBottom) + 'px';
}

// Рассчитывает и применяет ширину основного изображения ноутбука для панели (вынесено из Dropper._updateLaptopScaleForPan)
export function updateLaptopScaleForPan(pan, opts) {
  if (!pan) return;
  const mainImg = pan.querySelector('.pan-target__main img');
  if (!mainImg) return;
  // только уменьшать ноутбук на левой панели (female)
  const side = pan.dataset && pan.dataset.side;
  const initial = opts.laptopInitialWidth;
  if (side !== 'female') {
    mainImg.style.width = initial + 'px';
    return;
  }
  const list = pan.querySelector('.pan-target__items');
  const count = list ? list.querySelectorAll('.pan-target__item').length : 0;
  const min = opts.laptopMinWidth;
  const maxCount = opts.laptopMaxCount;
  const diff = initial - min;
  const perItem = diff / maxCount;
  const newWidth = Math.max(min, Math.round(initial - count * perItem));
  mainImg.style.width = newWidth + 'px';
}

// Утилиты: парсинг цветов и easing
export function parseColor(str) {
  if (!str) return null;
  str = String(str).trim();
  if (str[0] === '#') {
    const hex = str.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16)
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16)
      ];
    }
  }
  const m = str.match(/rgb\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/i);
  if (m) return [Number(m[1]), Number(m[2]), Number(m[3])];
  return null;
}

// easing: easeInOutCubic для более плавного прогресса зума и затемнения
export function ease(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// чтение нескольких CSS-переменных из :root за один вызов getComputedStyle
export function readRootVars(...names) {
  try {
    const css = getComputedStyle(document.documentElement);
    const out = {};
    for (const n of names) {
      out[n] = css.getPropertyValue(n);
    }
    return out;
  } catch (e) { return {}; }
}

// установка фонового цвета левой панели с учетом заданного eased фактора (0..1)
export function applyLeftBg(eased) {
  try {
    const vars = readRootVars('--left');
    const baseLeft = parseColor(vars['--left'] || '#ffe6f3') || [255, 230, 243];
    const target = Array.isArray(accentColor) ? accentColor : parseColor(accentColor) || [255, 111, 168];
    const mix = (a, b, t) => Math.round(a * (1 - t) + b * t);
    const r = mix(baseLeft[0], target[0], eased);
    const g = mix(baseLeft[1], target[1], eased);
    const b = mix(baseLeft[2], target[2], eased);
    document.documentElement.style.setProperty('--left-bg', `rgb(${r}, ${g}, ${b})`);
  } catch (e) { }
}


