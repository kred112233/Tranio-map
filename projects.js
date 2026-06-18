// ============================================================
//  ДАННЫЕ ПРОЕКТОВ — редактируй только этот файл.
//  Чтобы добавить проект, скопируй блок { ... } и заполни поля.
//  coords:   [широта, долгота] — правый клик в Google Maps.
//  img:      ссылка на фото или null (тогда заглушка).
//  eur:      цена «от» примерно в евро — нужна ТОЛЬКО для фильтра по бюджету.
//  typeCat:  категория для фильтра: "Виллы" | "Апартаменты" | "Кондо".
//  stageCat: категория для фильтра: "Строится" | "Готов" | "По запросу".
// ============================================================

const PROJECTS = [
  // ---------- КИПР ----------
  {
    id: "cy-synergy", region: "cyprus",
    name: "Synergy", area: "Ороклини, Ларнака",
    coords: [34.97179655964594, 33.67415866332554],
    type: "Виллы", typeCat: "Виллы",
    stage: "Строится · сдача 2027", stageCat: "Строится",
    price: "от €671 000", eur: 671000,
    size: "3–5 спален · 151 м²",
    desc: "Закрытый посёлок вилл в 300 м от моря: бассейны, спа, фитнес, солнечные панели, тёплые полы.",
    img: null,
    url: "https://tranio.ru/cyprus/adt/residential-complex-in-oroklini-2313761/"
  },
  {
    id: "cy-golf", region: "cyprus",
    name: "Гольф-резорт со спа и конным клубом", area: "Пафос · заповедник Natura 2000",
    coords: [34.82323589133113, 32.49827201349262],
    type: "Виллы и апартаменты", typeCat: "Виллы",
    stage: "Готов · 2020", stageCat: "Готов",
    price: "от €720 000", eur: 720000,
    size: "2–3 спальни · 92–240 м²",
    desc: "Люксовый комплекс на 300 резиденций с гольф-полями, спа, конным клубом и ресторанами в природном заповеднике.",
    img: "https://tranio.ru/photos/adt/5f2314ea/31662503/1310x814.jpg",
    url: "https://tranio.ru/cyprus/adt/residential-complex-in-paphos-2177777/"
  },
  {
    id: "cy-tomb", region: "cyprus",
    name: "Комплекс у Tomb of the Kings", area: "Пафос · Tomb of the Kings",
    coords: [34.78362655215901, 32.40358820632486],
    type: "Виллы и апартаменты", typeCat: "Виллы",
    stage: "По запросу", stageCat: "По запросу",
    price: "от €1 150 000", eur: 1150000,
    size: "2–4 спальни · 148–232 м²",
    desc: "Премиальный комплекс у моря: сады, клуб, рестораны, спортзал, бассейны, консьерж и охрана 24/7.",
    img: "https://tranio.ru/photos/adt/8e0e1f1d/34156441/655x407.jpg",
    url: "https://tranio.ru/cyprus/adt/residential-complex-in-tomb-of-the-kings-2292123/"
  },

  // ---------- ТАИЛАНД (ПХУКЕТ) ----------
  {
    id: "th-modeva", region: "thailand",
    name: "Title Modeva", area: "Банг Тао, Пхукет",
    coords: [7.991233870048419, 98.29632681325812],
    type: "Апартаменты", typeCat: "Апартаменты",
    stage: "Строится · сдача 2027", stageCat: "Строится",
    price: "от $146 000", eur: 135000,
    size: "1–3 спальни · 29–148 м²",
    desc: "Крупный комплекс в пешей доступности от пляжа Банг Тао: бассейны, фитнес, коворкинг, BBQ. Меблировка включена.",
    img: null,
    url: "https://tranio.ru/thailand/adt/residential-complex-in-bang-tao-2395533/"
  },
  {
    id: "th-sierra", region: "thailand",
    name: "Title Sierra", area: "Банг Тао, Пхукет",
    coords: [7.9881679596979005, 98.30817159175486],
    type: "Кондоминиум", typeCat: "Кондо",
    stage: "Строится · сдача 2028", stageCat: "Строится",
    price: "от $96 000", eur: 89000,
    size: "1–2 спальни · 28–63 м²",
    desc: "Комплекс в 500 м от Porto de Phuket по проекту бюро SOM: лагунный бассейн 100+ м, спа, подземный паркинг.",
    img: "https://tranio.ru/photos/adt/357ed959/38966801/1310x814.jpg",
    url: "https://tranio.ru/thailand/adt/residential-complex-in-bang-tao-2488458/"
  },
  {
    id: "th-layan", region: "thailand",
    name: "Layan Green Park (Invest)", area: "Банг Тао (Лаян), Пхукет",
    coords: [8.028896158245262, 98.29607474628942],
    type: "Апартаменты", typeCat: "Апартаменты",
    stage: "Готов · 2025", stageCat: "Готов",
    price: "от $154 000", eur: 143000,
    size: "Студии–2 спальни · 30–144 м²",
    desc: "Курортный комплекс в 700 м от пляжа Банг Тао: лагунные бассейны, фитнес, охрана. Гарантированная доходность 6%.",
    img: "https://tranio.ru/photos/adt/afbfc325/39050591/655x407.jpg",
    url: "https://tranio.ru/thailand/adt/residential-complex-in-bang-tao-2494243/"
  }
];

// Центры регионов для кнопок-переключателей
const REGIONS = {
  all:      { label: "Все",     center: [25, 65],      zoom: 4  },
  thailand: { label: "Таиланд", center: [7.99, 98.30], zoom: 13 },
  cyprus:   { label: "Кипр",    center: [34.86, 33.04], zoom: 9  }
};
