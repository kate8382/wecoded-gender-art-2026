export const icons = [
  'img/laptop.svg',
  'img/house.svg',
  'img/baby-carriage.svg',
  'img/cooking-pot.svg',
  'img/shopping-cart.svg',
  'img/wash-machine.svg',
  'img/ironing-2.svg'
];

export const defaultSequence = [
  { src: 'img/laptop.svg', side: 'female', darken: 0, delay: 400 },
  { src: 'img/laptop.svg', side: 'male', darken: 0, delay: 600 },
  { src: 'img/house.svg', side: 'female', darken: 1, delay: 700 },
  { src: 'img/baby-carriage.svg', side: 'female', darken: 1, delay: 700 },
  { src: 'img/cooking-pot.svg', side: 'female', darken: 1, delay: 700 },
  { src: 'img/shopping-cart.svg', side: 'female', darken: 1, delay: 700 },
  { src: 'img/wash-machine.svg', side: 'female', darken: 1, delay: 700 },
  { src: 'img/ironing-2.svg', side: 'female', darken: 1, delay: 700 }
];

// по умолчанию zoom timeline для начального интро (используется MainApp/AudioDirector)
export const zoomTimeline = {
  // общая продолжительность фазы увеличения в секундах
  duration: 3.0,
  // дискретные шаги масштаба от маленького -> 1.0 (финальный)
  scales: [0.20, 0.40, 0.60, 0.80, 1.0],
  // если true — использовать плавную интерполяцию по audio.currentTime вместо дискретных шагов
  continuous: true,
  // frontloadFactor < 1.0 ускоряет прогресс в начале фазы зума (значения ~0.7-0.9)
  // уменьшите если хотите сильнее ускорить первые шаги
  frontloadFactor: 0.65,
  leadSeconds: 0.08, // сколько секунд до начала фазы зума начинать прогрессировать (может быть 0 или даже отрицательным)
  leadFirstSeconds: 0.35, // сколько секунд до начала фазы зума начинать прогрессировать для первого шага (может быть 0 или даже отрицательным)
};
