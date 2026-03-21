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
