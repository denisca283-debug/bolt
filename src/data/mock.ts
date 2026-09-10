export type ActorCategory = 'Актёр' | 'Актриса' | 'Массовка' | 'Студент' | 'Модель';

export type Actor = {
  id: string;
  name: string;
  age: number;
  gender: 'М' | 'Ж';
  city: string;
  height: number;
  category: ActorCategory;
  status: 'Профессиональный' | 'Начинающий' | 'Студент' | 'Массовка';
  hairColor: string;
  eyeColor: string;
  skills: string[];
  experience: number;
  photo: string;
  gallery: string[];
  bio: string;
  projects: { title: string; role: string; year: string; director: string }[];
  availability: 'Свободен' | 'Занят' | 'Ограниченно';
  featuredScore?: number;
};

export type WorkOpportunity = {
  id: string;
  title: string;
  type: 'Массовка' | 'Главная роль' | 'Вторая роль' | 'Реклама' | 'Эпизод' | 'Оператор' | 'Режиссёр' | 'Художник' | 'Звук' | 'Свет' | 'Грим' | 'Костюм' | 'Монтаж' | 'Продакшн';
  audience: 'Актёрам' | 'Массовка' | 'Специалистам';
  project: string;
  city: string;
  date: string;
  ageRange: string;
  genre: string;
  pay: string;
  spots?: number;
  spotsLeft?: number;
  description: string;
  postedDaysAgo: number;
  applicants: number;
};

export type MarketplaceListing = {
  id: string;
  title: string;
  mode: 'Аренда' | 'Продажа' | 'Услуги';
  category: string;
  city: string;
  price: string;
  image: string;
  description: string;
  postedDaysAgo: number;
};

export type Project = {
  id: string;
  title: string;
  logline: string;
  genre: string;
  stage: string;
  city: string;
  director: string;
  teamSize: number;
  image: string;
  castingRoles: string[];
};

export type Conversation = {
  id: string;
  name: string;
  initials: string;
  role: string;
  lastMessage: string;
  time: string;
  unread: number;
  online: boolean;
};

export type ChatMessage = {
  id: string;
  sender: 'me' | 'them';
  text: string;
  time: string;
};

// Actor portraits (Pexels)
const P = {
  w1: 'https://images.pexels.com/photos/36215318/pexels-photo-36215318.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w2: 'https://images.pexels.com/photos/36665716/pexels-photo-36665716.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w3: 'https://images.pexels.com/photos/31444894/pexels-photo-31444894.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w4: 'https://images.pexels.com/photos/38221227/pexels-photo-38221227.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w5: 'https://images.pexels.com/photos/16961539/pexels-photo-16961539.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w6: 'https://images.pexels.com/photos/8727530/pexels-photo-8727530.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w7: 'https://images.pexels.com/photos/13952577/pexels-photo-13952577.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w8: 'https://images.pexels.com/photos/13316628/pexels-photo-13316628.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w9: 'https://images.pexels.com/photos/8556182/pexels-photo-8556182.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  w10: 'https://images.pexels.com/photos/31762949/pexels-photo-31762949.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m1: 'https://images.pexels.com/photos/35129369/pexels-photo-35129369.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m2: 'https://images.pexels.com/photos/36712225/pexels-photo-36712225.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m3: 'https://images.pexels.com/photos/38670590/pexels-photo-38670590.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m4: 'https://images.pexels.com/photos/17594386/pexels-photo-17594386.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m5: 'https://images.pexels.com/photos/15895254/pexels-photo-15895254.png?auto=compress&cs=tinysrgb&h=650&w=940',
  m6: 'https://images.pexels.com/photos/16886375/pexels-photo-16886375.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m7: 'https://images.pexels.com/photos/6895803/pexels-photo-6895803.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  m8: 'https://images.pexels.com/photos/15369458/pexels-photo-15369458.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Equipment / marketplace
  cam1: 'https://images.pexels.com/photos/3062543/pexels-photo-3062543.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  cam2: 'https://images.pexels.com/photos/4243662/pexels-photo-4243662.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  cam3: 'https://images.pexels.com/photos/28889671/pexels-photo-28889671.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  cam4: 'https://images.pexels.com/photos/10395639/pexels-photo-10395639.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  light1: 'https://images.pexels.com/photos/30332804/pexels-photo-30332804.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  light2: 'https://images.pexels.com/photos/134469/pexels-photo-134469.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  light3: 'https://images.pexels.com/photos/7383644/pexels-photo-7383644.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  mic1: 'https://images.pexels.com/photos/13521352/pexels-photo-13521352.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  mic2: 'https://images.pexels.com/photos/765139/pexels-photo-765139.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  vintage: 'https://images.pexels.com/photos/21274274/pexels-photo-21274274.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Behind the scenes
  bts1: 'https://images.pexels.com/photos/19224452/pexels-photo-19224452.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  bts2: 'https://images.pexels.com/photos/8088386/pexels-photo-8088386.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  bts3: 'https://images.pexels.com/photos/3411420/pexels-photo-3411420.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  bts4: 'https://images.pexels.com/photos/8089650/pexels-photo-8089650.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  // Locations
  loc1: 'https://images.pexels.com/photos/10066639/pexels-photo-10066639.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  loc2: 'https://images.pexels.com/photos/38757808/pexels-photo-38757808.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
  loc3: 'https://images.pexels.com/photos/15037863/pexels-photo-15037863.jpeg?auto=compress&cs=tinysrgb&h=650&w=940',
};

export const photos = P;

export const actors: Actor[] = [
  {
    id: 'a1',
    name: 'Анна Миронова',
    age: 24,
    gender: 'Ж',
    city: 'Москва',
    height: 168,
    category: 'Актриса',
    status: 'Профессиональный',
    hairColor: 'Тёмные',
    eyeColor: 'Карие',
    skills: ['Драма', 'Танцы', 'Плавание', 'Верховая езда'],
    experience: 6,
    photo: P.w1,
    gallery: [P.w1, P.w9, P.w5, P.w3],
    bio: 'Окончила Школу-студию МХАТ. Снималась в короткометражном кино и сериалах. Работаю в драматическом и лирическом жанрах.',
    projects: [
      { title: 'Тихая гавань', role: 'Главная роль', year: '2025', director: 'А. Вороновская' },
      { title: 'Последний автобус', role: 'Вторая роль', year: '2024', director: 'Д. Калугин' },
      { title: 'Снег в апреле', role: 'Эпизод', year: '2023', director: 'Н. Орлов' },
    ],
    availability: 'Свободен',
    featuredScore: 95,
  },
  {
    id: 'a2',
    name: 'Максим Орлов',
    age: 31,
    gender: 'М',
    city: 'Санкт-Петербург',
    height: 184,
    category: 'Актёр',
    status: 'Профессиональный',
    hairColor: 'Русые',
    eyeColor: 'Серые',
    skills: ['Драма', 'Боевики', 'Фехтование', 'Автовождение'],
    experience: 10,
    photo: P.m1,
    gallery: [P.m1, P.m4, P.m6, P.m3],
    bio: 'Выпускник СПбГАТИ. Снимался в полнометражном кино и телевизионных проектах. Открыт к предложениям из других городов.',
    projects: [
      { title: 'Эхо последнего кадра', role: 'Главная роль', year: '2025', director: 'Д. Калугин' },
      { title: 'Северный ветер', role: 'Вторая роль', year: '2024', director: 'А. Вороновская' },
    ],
    availability: 'Ограниченно',
    featuredScore: 90,
  },
  {
    id: 'a3',
    name: 'София Белова',
    age: 22,
    gender: 'Ж',
    city: 'Москва',
    height: 170,
    category: 'Актриса',
    status: 'Студент',
    hairColor: 'Светлые',
    eyeColor: 'Голубые',
    skills: ['Драма', 'Пение', 'Гитара'],
    experience: 2,
    photo: P.w2,
    gallery: [P.w2, P.w6, P.w4],
    bio: 'Студентка 4 курса ВГИК. Участвовала в студенческих короткометражках. Ищу первую профессиональную роль.',
    projects: [
      { title: 'Полынь (короткометражка)', role: 'Главная роль', year: '2024', director: 'Н. Орлов' },
    ],
    availability: 'Свободен',
    featuredScore: 75,
  },
  {
    id: 'a4',
    name: 'Дмитрий Соколов',
    age: 28,
    gender: 'М',
    city: 'Москва',
    height: 178,
    category: 'Актёр',
    status: 'Начинающий',
    hairColor: 'Чёрные',
    eyeColor: 'Карие',
    skills: ['Комедия', 'Импровизация', 'Спорт'],
    experience: 3,
    photo: P.m2,
    gallery: [P.m2, P.m5, P.m8],
    bio: 'Прошёл курсы актёрского мастерства в школе «Импульс». Снимался в рекламе и музыкальных клипах. Хочу перейти в кино.',
    projects: [
      { title: 'Реклама «Тинькофф»', role: 'Главный герой', year: '2024', director: '—' },
      { title: 'Клип «Баста — Сансара»', role: 'Эпизод', year: '2023', director: '—' },
    ],
    availability: 'Свободен',
  },
  {
    id: 'a5',
    name: 'Виктория Жукова',
    age: 26,
    gender: 'Ж',
    city: 'Казань',
    height: 172,
    category: 'Актриса',
    status: 'Профессиональный',
    hairColor: 'Рыжие',
    eyeColor: 'Зелёные',
    skills: ['Драма', 'Танцы', 'Йога', 'Катание на коньках'],
    experience: 7,
    photo: P.w4,
    gallery: [P.w4, P.w7, P.w10],
    bio: 'Окончила Казанский государственный институт культуры. Работаю в театре и кино. Открыта к копродукции и фестивальным проектам.',
    projects: [
      { title: 'Полынь', role: 'Вторая роль', year: '2025', director: 'Н. Орлов' },
      { title: 'Река забвения', role: 'Главная роль', year: '2023', director: 'А. Вороновская' },
    ],
    availability: 'Занят',
    featuredScore: 88,
  },
  {
    id: 'a6',
    name: 'Игорь Петров',
    age: 35,
    gender: 'М',
    city: 'Екатеринбург',
    height: 180,
    category: 'Актёр',
    status: 'Профессиональный',
    hairColor: 'Тёмные',
    eyeColor: 'Карие',
    skills: ['Драма', 'Боевики', 'Огнестрельное оружие', 'Мотоцикл'],
    experience: 12,
    photo: P.m3,
    gallery: [P.m3, P.m1, P.m7],
    bio: 'Опыт работы в кино и театре более 10 лет. Снимался в сериалах и полнометражных фильмах. Готов к переездам на съёмки.',
    projects: [
      { title: 'Урал', role: 'Главная роль', year: '2024', director: 'Д. Калугин' },
      { title: 'Городок', role: 'Вторая роль', year: '2022', director: 'Н. Орлов' },
    ],
    availability: 'Ограниченно',
    featuredScore: 82,
  },
  {
    id: 'a7',
    name: 'Елена Зайцева',
    age: 19,
    gender: 'Ж',
    city: 'Москва',
    height: 165,
    category: 'Массовка',
    status: 'Массовка',
    hairColor: 'Блонд',
    eyeColor: 'Голубые',
    skills: ['Массовка', 'Танцы'],
    experience: 1,
    photo: P.w6,
    gallery: [P.w6, P.w2],
    bio: 'Студентка. Хочу попробовать себя в кино, начиная с массовки. Открыта к любым предложениям и готова учиться.',
    projects: [
      { title: 'Массовка в сериале «Москвичи»', role: 'Массовка', year: '2025', director: '—' },
    ],
    availability: 'Свободен',
  },
  {
    id: 'a8',
    name: 'Артём Волков',
    age: 23,
    gender: 'М',
    city: 'Санкт-Петербург',
    height: 186,
    category: 'Актёр',
    status: 'Студент',
    hairColor: 'Русые',
    eyeColor: 'Серые',
    skills: ['Драма', 'Спорт', 'Плавание', 'Бокс'],
    experience: 2,
    photo: P.m5,
    gallery: [P.m5, P.m2, P.m6],
    bio: 'Студент СПбГИКиТ. Снимался в студенческих проектах. Ищу возможности для профессионального роста.',
    projects: [
      { title: 'Невский (короткометражка)', role: 'Главная роль', year: '2024', director: '—' },
    ],
    availability: 'Свободен',
    featuredScore: 70,
  },
  {
    id: 'a9',
    name: 'Марина Лебедева',
    age: 29,
    gender: 'Ж',
    city: 'Москва',
    height: 174,
    category: 'Модель',
    status: 'Профессиональный',
    hairColor: 'Тёмные',
    eyeColor: 'Карие',
    skills: ['Модель', 'Реклама', 'Дефиле', 'Плавание'],
    experience: 8,
    photo: P.w5,
    gallery: [P.w5, P.w1, P.w9],
    bio: 'Профессиональная модель и актриса рекламы. Снималась для журналов и брендов. Интересует кино и музыкальные клипы.',
    projects: [
      { title: 'Реклама «Gloria Jeans»', role: 'Модель', year: '2024', director: '—' },
      { title: 'Обложка «Cosmo»', role: 'Модель', year: '2023', director: '—' },
    ],
    availability: 'Свободен',
  },
  {
    id: 'a10',
    name: 'Павел Морозов',
    age: 42,
    gender: 'М',
    city: 'Москва',
    height: 176,
    category: 'Актёр',
    status: 'Профессиональный',
    hairColor: 'Седые',
    eyeColor: 'Серые',
    skills: ['Драма', 'Исторический', 'Военный', 'Верховая езда'],
    experience: 20,
    photo: P.m7,
    gallery: [P.m7, P.m1, P.m8],
    bio: 'Заслуженный артил. Опыт в театре, кино и телевизионных проектах. Открыт к серьёзным драматическим ролям.',
    projects: [
      { title: 'Тихая гавань', role: 'Отец', year: '2025', director: 'А. Вороновская' },
      { title: 'Окоп', role: 'Главная роль', year: '2023', director: 'Д. Калугин' },
    ],
    availability: 'Ограниченно',
    featuredScore: 85,
  },
  {
    id: 'a11',
    name: 'Ольга Сорокина',
    age: 27,
    gender: 'Ж',
    city: 'Новосибирск',
    height: 169,
    category: 'Актриса',
    status: 'Начинающий',
    hairColor: 'Русые',
    eyeColor: 'Зелёные',
    skills: ['Драма', 'Пение', 'Хореография'],
    experience: 3,
    photo: P.w3,
    gallery: [P.w3, P.w4, P.w8],
    bio: 'Окончила театральную студию. Снималась в региональных проектах. Готова к переездам ради интересной роли.',
    projects: [
      { title: 'Сибирь (короткометражка)', role: 'Вторая роль', year: '2024', director: '—' },
    ],
    availability: 'Свободен',
  },
  {
    id: 'a12',
    name: 'Роман Ким',
    age: 21,
    gender: 'М',
    city: 'Владивосток',
    height: 182,
    category: 'Студент',
    status: 'Студент',
    hairColor: 'Чёрные',
    eyeColor: 'Тёмные',
    skills: ['Драма', 'Боевые искусства', 'Сноуборд'],
    experience: 1,
    photo: P.m6,
    gallery: [P.m6, P.m5, P.m3],
    bio: 'Студент ВГИК. Хочу найти первые серьёзные съёмки. Открыт к экспериментам и новым жанрам.',
    projects: [
      { title: 'Море (студенческая работа)', role: 'Главная роль', year: '2024', director: '—' },
    ],
    availability: 'Свободен',
  },
];

export const workOpportunities: WorkOpportunity[] = [
  {
    id: 'w1',
    title: 'Массовка в полнометражный фильм',
    type: 'Массовка',
    audience: 'Массовка',
    project: 'Тихая гавань',
    city: 'Москва',
    date: '14 сентября',
    ageRange: '18–35 лет',
    genre: 'Драма',
    pay: '4 000 ₽ / смена',
    spots: 30,
    spotsLeft: 12,
    description: 'Съёмки сцены на рыбном рынке. Нужно 30 человек массовки. Съёмочный день с 8:00 до 18:00. Одежда — осенняя, тёмных тонов. Кормят обедом.',
    postedDaysAgo: 1,
    applicants: 18,
  },
  {
    id: 'w2',
    title: 'Главная женская роль',
    type: 'Главная роль',
    audience: 'Актёрам',
    project: 'Полынь',
    city: 'Астрахань',
    date: 'Октябрь 2025',
    ageRange: '23–28 лет',
    genre: 'Драма · Артхаус',
    pay: 'По договорённости',
    description: 'Ищем актрису на главную роль в авторском фильме. Степные пейзажи, съёмки 3 недели в Астраханской области. Нужен опыт в драматических ролях. Готовность к проживанию на локации.',
    postedDaysAgo: 2,
    applicants: 47,
  },
  {
    id: 'w3',
    title: 'Актёр на рекламную съёмку',
    type: 'Реклама',
    audience: 'Актёрам',
    project: 'Реклама банка',
    city: 'Санкт-Петербург',
    date: '20 сентября',
    ageRange: '30–40 лет',
    genre: 'Реклама',
    pay: '25 000 ₽ / смена',
    description: 'Один съёмочный день. Роль: уверенный деловой человек. Опыт в рекламе приветствуется. Фото в деловом стиле — преимущество.',
    postedDaysAgo: 3,
    applicants: 31,
  },
  {
    id: 'w4',
    title: 'Актёр на эпизод в сериал',
    type: 'Эпизод',
    audience: 'Актёрам',
    project: 'Москвичи (сериал)',
    city: 'Москва',
    date: '25–27 сентября',
    ageRange: '25–45 лет',
    genre: 'Комедия',
    pay: '8 000 ₽ / смена',
    description: 'Три съёмочных дня. Роль: сосед по подъезду. Несколько реплик. Сопровождение кастинг-директора на площадке.',
    postedDaysAgo: 4,
    applicants: 22,
  },
  {
    id: 'w5',
    title: 'Массовка для военной сцены',
    type: 'Массовка',
    audience: 'Массовка',
    project: 'Исторический фильм',
    city: 'Калининград',
    date: '5–8 октября',
    ageRange: '20–50 лет',
    genre: 'Исторический',
    pay: '5 000 ₽ / смена',
    spots: 50,
    spotsLeft: 23,
    description: 'Четыре съёмочных дня. Воссоздание сцены времён Великой Отечественной войны. Военная форма предоставляется. Нужна стрижка соответствующая эпохе.',
    postedDaysAgo: 5,
    applicants: 27,
  },
  {
    id: 'w6',
    title: 'Актриса на вторую роль',
    type: 'Вторая роль',
    audience: 'Актёрам',
    project: 'Эхо последнего кадра',
    city: 'Санкт-Петербург',
    date: 'Ноябрь 2025',
    ageRange: '35–50 лет',
    genre: 'Биографический',
    pay: 'По договорённости',
    description: 'Роль жены главного героя. Драматический фильм о монтажёре советского кино. Съёмки 2 недели. Опыт в драматических ролях обязателен.',
    postedDaysAgo: 6,
    applicants: 15,
  },
  {
    id: 'w7',
    title: 'Оператор-постановщик',
    type: 'Оператор',
    audience: 'Специалистам',
    project: 'После полуночи',
    city: 'Москва',
    date: 'Октябрь 2025',
    ageRange: '—',
    genre: 'Триллер',
    pay: 'от 20 000 ₽ / смена',
    description: 'Ищем оператора-постановщика на полнометражный триллер. Съёмки 4 недели в Москве и области. Опыт в жанре обязателен. Комплект не требуется, но приветствуется.',
    postedDaysAgo: 1,
    applicants: 12,
  },
  {
    id: 'w8',
    title: 'Звукорежиссёр на съёмочную площадку',
    type: 'Звук',
    audience: 'Специалистам',
    project: 'Тихая гавань',
    city: 'Мурманск',
    date: 'Сентябрь–октябрь',
    ageRange: '—',
    genre: 'Драма',
    pay: '12 000 ₽ / смена',
    description: 'Звукорежиссёр с собственным комплектом (рекордер, петлички, бум). Съёмки на натуре в Мурманской области. 12 съёмочных дней.',
    postedDaysAgo: 2,
    applicants: 8,
  },
  {
    id: 'w9',
    title: 'Художник-постановщик',
    type: 'Художник',
    audience: 'Специалистам',
    project: 'Полынь',
    city: 'Астрахань',
    date: 'Сентябрь 2025',
    ageRange: '—',
    genre: 'Артхаус',
    pay: 'по договорённости',
    description: 'Художник-постановщик на авторский фильм. Степные пейзажи, деревенский быт. Нужно декорирование интерьеров под конец 1990-х.',
    postedDaysAgo: 3,
    applicants: 5,
  },
  {
    id: 'w10',
    title: 'Монтажёр для полнометражного фильма',
    type: 'Монтаж',
    audience: 'Специалистам',
    project: 'Эхо последнего кадра',
    city: 'Санкт-Петербург',
    date: 'Ноябрь–декабрь',
    ageRange: '—',
    genre: 'Биографический',
    pay: '120 000 ₽ / проект',
    description: 'Монтажёр на биографический фильм. Срок работы 6 недель. Материал снят на ARRI. Опыт с художественным кино обязателен.',
    postedDaysAgo: 4,
    applicants: 14,
  },
];

export const marketplaceListings: MarketplaceListing[] = [
  {
    id: 'mk1',
    title: 'ARRI Alexa Mini LF',
    mode: 'Аренда',
    category: 'Камеры',
    city: 'Москва',
    price: '18 000 ₽ / смена',
    image: P.cam1,
    description: 'Комплект: камера, 2 аккумулятора, карточки 512 ГБ. Сплектраки ARRI. Полностью готова к съёмке.',
    postedDaysAgo: 1,
  },
  {
    id: 'mk2',
    title: 'Sony FX6',
    mode: 'Продажа',
    category: 'Камеры',
    city: 'Москва',
    price: '420 000 ₽',
    image: P.cam2,
    description: 'Состояние отличное, наработка 200 часов. Комплект: 3 аккумулятора, зарядка, плечо. Гарантия 3 месяца.',
    postedDaysAgo: 2,
  },
  {
    id: 'mk3',
    title: 'Комплект света Aputure 600D',
    mode: 'Аренда',
    category: 'Свет',
    city: 'Москва',
    price: '6 000 ₽ / смена',
    image: P.light1,
    description: '2 прибора Aputure 600D Pro, стойки, софтбоксы, пески. Возможна доставка по Москве.',
    postedDaysAgo: 3,
  },
  {
    id: 'mk4',
    title: 'Гримёрный автобус',
    mode: 'Аренда',
    category: 'Транспорт',
    city: 'Москва',
    price: 'Цена по запросу',
    image: P.bts2,
    description: 'Полностью оборудованный гримёрный автобус. 4 кресла, зеркала с подсветкой, климат-контроль. Доставка на площадку.',
    postedDaysAgo: 4,
  },
  {
    id: 'mk5',
    title: 'Комплект звукозаписи Sennheiser',
    mode: 'Аренда',
    category: 'Звук',
    city: 'Санкт-Петербург',
    price: '3 500 ₽ / смена',
    image: P.mic1,
    description: 'Sennheiser MKH 416, петличный радиокомплект, рекордер Zoom F8n. Бум-пол в комплекте.',
    postedDaysAgo: 5,
  },
  {
    id: 'mk6',
    title: 'RED Komodo 6K',
    mode: 'Продажа',
    category: 'Камеры',
    city: 'Казань',
    price: '680 000 ₽',
    image: P.cam3,
    description: 'Состояние нового. Наработка менее 50 часов. В комплекте: 4 аккумулятора, карточки, кейс Pelican.',
    postedDaysAgo: 6,
  },
  {
    id: 'mk7',
    title: 'Локация: заброшенный завод',
    mode: 'Услуги',
    category: 'Локации',
    city: 'Тверь',
    price: '15 000 ₽ / смена',
    image: P.loc1,
    description: 'Производственное здание 1908 года. Высокие потолки, кирпичные стены, естественный свет. Подходит для съёмок.',
    postedDaysAgo: 7,
  },
  {
    id: 'mk8',
    title: 'Оператор-постановщик на проект',
    mode: 'Услуги',
    category: 'Услуги',
    city: 'Москва',
    price: 'от 15 000 ₽ / смена',
    image: P.bts3,
    description: 'Оператор с собственным комплектом (Sony FX6, набор объективов, стедикам). Опыт в короткометражном и рекламном кино.',
    postedDaysAgo: 1,
  },
  {
    id: 'mk9',
    title: 'Canon EOS R5 + объективы',
    mode: 'Продажа',
    category: 'Камеры',
    city: 'Екатеринбург',
    price: '290 000 ₽',
    image: P.cam4,
    description: 'Корпус Canon R5 + 24-70 f/2.8 + 50 f/1.2. Всё в идеальном состоянии. Продам комплектом или раздельно.',
    postedDaysAgo: 3,
  },
];

export const projects: Project[] = [
  {
    id: 'pr1',
    title: 'Тихая гавань',
    logline: 'История рыбака, который возвращается в родной посёлок после двадцати лет молчания и сталкивается с тайной, разрушающей его семью.',
    genre: 'Драма',
    stage: 'Препродакшн',
    city: 'Мурманск',
    director: 'Алиса Вороновская',
    teamSize: 8,
    image: P.loc3,
    castingRoles: ['Актёр (главная роль)', 'Звукорежиссёр'],
  },
  {
    id: 'pr2',
    title: 'Эхо последнего кадра',
    logline: 'Пожилой монтажёр находит забытую плёнку, которая меняет его взгляд на собственную жизнь и карьеру в советском кино.',
    genre: 'Биографический',
    stage: 'Постпродакшн',
    city: 'Санкт-Петербург',
    director: 'Дмитрий Калугин',
    teamSize: 12,
    image: P.bts1,
    castingRoles: ['Композитор', 'Цветокорректор'],
  },
  {
    id: 'pr3',
    title: 'Полынь',
    logline: 'Молодая женщина в степном селе ведёт дневник, который становится летописью исчезающего поколения.',
    genre: 'Артхаус',
    stage: 'Разработка сценария',
    city: 'Астрахань',
    director: 'Никита Орлов',
    teamSize: 5,
    image: P.loc2,
    castingRoles: ['Актриса (главная роль)', 'Художник по гриму'],
  },
];

export const conversations: Conversation[] = [
  {
    id: 'c1',
    name: 'Алиса Вороновская',
    initials: 'АВ',
    role: 'Режиссёр',
    lastMessage: 'Здравствуйте! Видел вашу заявку на роль в «Тихой гавани»…',
    time: '14:32',
    unread: 2,
    online: true,
  },
  {
    id: 'c2',
    name: 'Никита Орлов',
    initials: 'НО',
    role: 'Продюсер',
    lastMessage: 'Отправил вам детали кастинга на «Полынь»',
    time: '12:15',
    unread: 1,
    online: false,
  },
  {
    id: 'c3',
    name: 'Дмитрий Калугин',
    initials: 'ДК',
    role: 'Оператор',
    lastMessage: 'Спасибо за портфолио, обсудим на следующей неделе',
    time: 'Вчера',
    unread: 0,
    online: false,
  },
  {
    id: 'c4',
    name: 'Марина Лебедева',
    initials: 'МЛ',
    role: 'Актриса',
    lastMessage: 'Добрый день! Интересует роль в рекламе, вы ещё ищете?',
    time: 'Вчера',
    unread: 0,
    online: true,
  },
];

export const chatMessages: ChatMessage[] = [
  { id: 'm1', sender: 'them', text: 'Здравствуйте! Видел вашу заявку на роль в «Тихой гавани».', time: '14:28' },
  { id: 'm2', sender: 'them', text: 'Ваш типаж очень подходит. Можете прислать шоурил?', time: '14:30' },
  { id: 'm3', sender: 'me', text: 'Добрый день, Алиса! Спасибо за отклик. Шоурил отправлю сегодня вечером.', time: '14:32' },
  { id: 'm4', sender: 'me', text: 'Также есть несколько фото в драматическом амплуа — приложу к сообщению.', time: '14:32' },
];

export const currentUser = {
  name: 'Илья Северцев',
  role: 'Режиссёр · Продюсер',
  initials: 'ИС',
  city: 'Москва',
};

export const notifications = [
  { id: 'n1', icon: 'mail', title: 'Новое сообщение', text: 'Алиса Вороновская написала вам', time: '12 минут назад' },
  { id: 'n2', icon: 'briefcase', title: 'Новая роль', text: 'Открыт кастинг на «Полынь» — главная женская роль', time: '1 час назад' },
  { id: 'n3', icon: 'users', title: 'Отклик на проект', text: 'Максим Орлов откликнулся на роль в «Тихая гавань»', time: '3 часа назад' },
  { id: 'n4', icon: 'star', title: 'Профиль просмотрен', text: 'Ваш профиль посмотрел продюсер Никита Орлов', time: '5 часов назад' },
  { id: 'n5', icon: 'briefcase', title: 'Новая возможность', text: 'Актёр на рекламную съёмку в Санкт-Петербурге', time: 'Вчера' },
];

export type PulseItem = {
  id: string;
  kind: 'role' | 'crew-search' | 'portfolio' | 'join' | 'spots' | 'marketplace' | 'team-complete';
  person: string;
  initials: string;
  photo?: string;
  action: string;
  target: string;
  time: string;
};

export const pulseFeed: PulseItem[] = [
  {
    id: 'pf1',
    kind: 'role',
    person: 'Анна Миронова',
    initials: 'АМ',
    photo: P.w1,
    action: 'получила роль в проекте',
    target: '«Тихая гавань»',
    time: '8 минут назад',
  },
  {
    id: 'pf2',
    kind: 'crew-search',
    person: 'Проект «После полуночи»',
    initials: 'П',
    action: 'начал поиск съёмочной группы',
    target: 'оператор, звук, свет',
    time: '32 минуты назад',
  },
  {
    id: 'pf3',
    kind: 'portfolio',
    person: 'Максим Орлов',
    initials: 'МО',
    photo: P.m1,
    action: 'обновил актёрское портфолио',
    target: '4 новых фото',
    time: '1 час назад',
  },
  {
    id: 'pf4',
    kind: 'join',
    person: 'Ирина Белова',
    initials: 'ИБ',
    photo: P.w4,
    action: 'присоединилась к проекту как',
    target: 'художник-постановщик',
    time: '2 часа назад',
  },
  {
    id: 'pf5',
    kind: 'spots',
    person: 'Массовка 14 сентября',
    initials: 'М',
    action: 'на съёмку',
    target: 'осталось 12 мест в массовке',
    time: '3 часа назад',
  },
  {
    id: 'pf6',
    kind: 'marketplace',
    person: 'Александр Волков',
    initials: 'АВ',
    photo: P.m3,
    action: 'разместил камеру в Кинобарахолке',
    target: 'ARRI Alexa Mini LF',
    time: '5 часов назад',
  },
  {
    id: 'pf7',
    kind: 'team-complete',
    person: 'Проект «Полынь»',
    initials: 'П',
    action: 'команда полностью собрана',
    target: '5 человек в съёмочной группе',
    time: '7 часов назад',
  },
  {
    id: 'pf8',
    kind: 'role',
    person: 'София Белова',
    initials: 'СБ',
    photo: P.w2,
    action: 'получила роль в студенческом проекте',
    target: '«Невский»',
    time: 'Вчера',
  },
  {
    id: 'pf9',
    kind: 'portfolio',
    person: 'Дмитрий Калугин',
    initials: 'ДК',
    photo: P.m4,
    action: 'обновил портфолио',
    target: 'новый шоурил',
    time: 'Вчера',
  },
  {
    id: 'pf10',
    kind: 'crew-search',
    person: 'Проект «Эхо последнего кадра»',
    initials: 'Э',
    action: 'ищет монтажёра',
    target: '6 недель работы',
    time: 'Вчера',
  },
];

export type Department = {
  id: string;
  name: string;
  professions: string[];
};

export const departments: Department[] = [
  {
    id: 'd1',
    name: 'Режиссура',
    professions: ['Режиссёр', 'Второй режиссёр', 'Ассистент режиссёра', 'Скрипт-супервайзер'],
  },
  {
    id: 'd2',
    name: 'Продюсерская группа',
    professions: ['Продюсер', 'Исполнительный продюсер', 'Линейный продюсер', 'Директор картины', 'Координатор производства'],
  },
  {
    id: 'd3',
    name: 'Операторская группа',
    professions: ['Оператор-постановщик', 'Камероператор', '1AC / Фокус-пуллер', '2AC', 'DIT', 'Механик камеры'],
  },
  {
    id: 'd4',
    name: 'Художественный департамент',
    professions: ['Художник-постановщик', 'Арт-директор', 'Декоратор', 'Реквизитор', 'Художник по графике'],
  },
  {
    id: 'd5',
    name: 'Звук',
    professions: ['Звукорежиссёр', 'Звукооператор', 'Бум-оператор'],
  },
  {
    id: 'd6',
    name: 'Свет',
    professions: ['Гафер', 'Осветитель'],
  },
  {
    id: 'd7',
    name: 'Грим',
    professions: ['Художник по гриму', 'Гримёр'],
  },
  {
    id: 'd8',
    name: 'Костюм',
    professions: ['Художник по костюмам', 'Костюмер'],
  },
  {
    id: 'd9',
    name: 'Реквизит',
    professions: ['Реквизитор', 'Художник по реквизиту'],
  },
  {
    id: 'd10',
    name: 'Монтаж и постпродакшн',
    professions: ['Монтажёр', 'Колорист', 'Саунд-дизайнер'],
  },
  {
    id: 'd11',
    name: 'VFX / CGI',
    professions: ['VFX Supervisor', 'VFX Artist', 'CGI Artist'],
  },
  {
    id: 'd12',
    name: 'Каскадёрская группа',
    professions: ['Постановщик трюков', 'Каскадёр'],
  },
  {
    id: 'd13',
    name: 'Транспорт',
    professions: ['Водитель', 'Координатор транспорта'],
  },
  {
    id: 'd14',
    name: 'Локации',
    professions: ['Локейшн-менеджер', 'Скаут локаций'],
  },
  {
    id: 'd15',
    name: 'Административная группа',
    professions: ['Кастинг-директор', 'Ассистент по кастингу', 'Продуктовый координатор', 'Координатор площадки'],
  },
  {
    id: 'd16',
    name: 'Другое',
    professions: ['Другое'],
  },
];

export type Professional = {
  id: string;
  name: string;
  profession: string;
  departmentId: string;
  city: string;
  experience: number;
  skills: string[];
  photo: string;
  availability: 'Свободен' | 'Занят' | 'Ограниченно';
  bio: string;
  featuredScore?: number;
};

export const professionals: Professional[] = [
  {
    id: 'pr1',
    name: 'Алиса Вороновская',
    profession: 'Режиссёр',
    departmentId: 'd1',
    city: 'Москва',
    experience: 14,
    skills: ['Драма', 'Артхаус', 'Социальное кино'],
    photo: P.w1,
    availability: 'Ограниченно',
    bio: 'Режиссёр авторского кино. Финалист питчинга «Кино+» 2024.',
    featuredScore: 95,
  },
  {
    id: 'pr2',
    name: 'Дмитрий Калугин',
    profession: 'Оператор-постановщик',
    departmentId: 'd3',
    city: 'Санкт-Петербург',
    experience: 12,
    skills: ['RED', 'ARRI', 'Стедикам', 'Художественная операторская работа'],
    photo: P.m1,
    availability: 'Занят',
    bio: 'Оператор-постановщик. Снимал 15 полнометражных проектов.',
    featuredScore: 92,
  },
  {
    id: 'pr3',
    name: 'Никита Орлов',
    profession: 'Продюсер',
    departmentId: 'd2',
    city: 'Казань',
    experience: 10,
    skills: ['Копродукция', 'Артхаус', 'Фестивали'],
    photo: P.m3,
    availability: 'Свободен',
    bio: 'Продюсер, фокус на фестивальном и авторском кино.',
    featuredScore: 88,
  },
  {
    id: 'pr4',
    name: 'Ирина Белова',
    profession: 'Художник-постановщик',
    departmentId: 'd4',
    city: 'Москва',
    experience: 8,
    skills: ['Декорации', 'Реквизит', 'Исторический'],
    photo: P.w4,
    availability: 'Свободен',
    bio: 'Художник-постановщик. Работает в историческом и современном кино.',
    featuredScore: 80,
  },
  {
    id: 'pr5',
    name: 'Сергей Громов',
    profession: 'Звукорежиссёр',
    departmentId: 'd5',
    city: 'Москва',
    experience: 15,
    skills: ['Звук на площадке', 'Звуковой дизайн', 'Dolby Atmos'],
    photo: P.m4,
    availability: 'Ограниченно',
    bio: 'Звукорежиссёр с 15-летним опытом. Собственный комплект оборудования.',
    featuredScore: 85,
  },
  {
    id: 'pr6',
    name: 'Мария Светлова',
    profession: 'Монтажёр',
    departmentId: 'd10',
    city: 'Санкт-Петербург',
    experience: 9,
    skills: ['Avid', 'DaVinci Resolve', 'Художественный монтаж', 'Premiere'],
    photo: P.w5,
    availability: 'Свободен',
    bio: 'Монтажёр художественного и документального кино.',
    featuredScore: 82,
  },
  {
    id: 'pr7',
    name: 'Олег Дрягин',
    profession: 'Гафер',
    departmentId: 'd6',
    city: 'Москва',
    experience: 11,
    skills: ['Aputure', 'ARRI', 'Свет на натуре', 'Электрика'],
    photo: P.m2,
    availability: 'Свободен',
    bio: 'Гафер с собственным комплектом света.',
  },
  {
    id: 'pr8',
    name: 'Екатерина Лоза',
    profession: 'Художник по гриму',
    departmentId: 'd7',
    city: 'Москва',
    experience: 7,
    skills: ['Возрастной грим', 'Спецэффекты грима', 'Исторический'],
    photo: P.w3,
    availability: 'Свободен',
    bio: 'Художник по гриму. Опыт в историческом и фэнтези кино.',
  },
  {
    id: 'pr9',
    name: 'Павел Котов',
    profession: 'Колорист',
    departmentId: 'd10',
    city: 'Екатеринбург',
    experience: 6,
    skills: ['DaVinci Resolve', 'Цветокоррекция', 'HDR', 'Кино'],
    photo: P.m5,
    availability: 'Свободен',
    bio: 'Колорист, работает удалённо и в студии.',
  },
  {
    id: 'pr10',
    name: 'Анна Древко',
    profession: 'Художник по костюмам',
    departmentId: 'd8',
    city: 'Санкт-Петербург',
    experience: 10,
    skills: ['Исторический', 'Современный', 'Фэнтези', 'Пошив'],
    photo: P.w6,
    availability: 'Ограниченно',
    bio: 'Художник по костюмам. 20+ проектов в кино и сериалах.',
  },
  {
    id: 'pr11',
    name: 'Виктор Бай',
    profession: 'Каскадёр',
    departmentId: 'd12',
    city: 'Москва',
    experience: 8,
    skills: ['Боевые искусства', 'Огнестрельное оружие', 'Мотоцикл', 'Высота'],
    photo: P.m6,
    availability: 'Свободен',
    bio: 'Каскадёр и постановщик трюков.',
  },
  {
    id: 'pr12',
    name: 'Лариса Чудова',
    profession: 'Кастинг-директор',
    departmentId: 'd15',
    city: 'Москва',
    experience: 13,
    skills: ['Художественное кино', 'Сериалы', 'Реклама', 'Кастинг'],
    photo: P.w7,
    availability: 'Свободен',
    bio: 'Кастинг-директор. Работала с ведущими студиями.',
  },
];
