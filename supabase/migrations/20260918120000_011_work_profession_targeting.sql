/*
# Вакансия указывает, КТО требуется

1. Зачем
   В work_opportunities было только свободное поле `title` и грубый
   `audience` ('Актёры' / 'Специалисты'). Из-за этого объявление о работе
   не отвечало на главный вопрос индустрии: какая именно профессия нужна.
   Искать «нужен 1AC» по подстроке в заголовке невозможно.

   Профессии и департаменты уже есть в базе (22 департамента, 81 профессия) —
   вакансия теперь ссылается на них, а не повторяет их текстом.

2. Изменения
   - work_opportunities.department_id → departments(id)
   - work_opportunities.profession_id → professions(id)
   Оба поля необязательные: массовка и разовые подработки не всегда
   ложатся в профессию, и старые строки остаются валидными.

3. Безопасность
   RLS и политики не меняются — таблица уже защищена (публичное чтение,
   запись только владельцем).

4. Повторный запуск
   Безопасен: все операции IF NOT EXISTS.
*/

ALTER TABLE work_opportunities
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES departments(id) ON DELETE SET NULL;

ALTER TABLE work_opportunities
  ADD COLUMN IF NOT EXISTS profession_id uuid REFERENCES professions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS work_opportunities_profession_idx
  ON work_opportunities (profession_id);

CREATE INDEX IF NOT EXISTS work_opportunities_department_idx
  ON work_opportunities (department_id);
