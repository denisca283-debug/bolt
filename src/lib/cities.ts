/**
 * Suggested cities for every city field in FilmVerse.
 *
 * Offered as suggestions rather than a closed dropdown on purpose: shoots
 * happen in small towns too, so anything typed by hand must still be accepted.
 */
export const CITY_SUGGESTIONS = [
  'Москва', 'Санкт-Петербург', 'Новосибирск', 'Екатеринбург', 'Казань',
  'Нижний Новгород', 'Челябинск', 'Самара', 'Омск', 'Ростов-на-Дону',
  'Уфа', 'Красноярск', 'Воронеж', 'Пермь', 'Волгоград', 'Краснодар',
  'Саратов', 'Тюмень', 'Ижевск', 'Ярославль', 'Иркутск', 'Хабаровск',
  'Владивосток', 'Калининград', 'Сочи', 'Тула', 'Ставрополь', 'Ульяновск',
  'Минск', 'Алматы', 'Астана', 'Ташкент', 'Тбилиси', 'Ереван', 'Баку',
];

/** Shared id so one <datalist> can serve several inputs on a page. */
export const CITY_DATALIST_ID = 'filmverse-city-suggestions';
