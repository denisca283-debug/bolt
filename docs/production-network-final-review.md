# FilmVerse — архитектурный отчёт по 55 пунктам

> Исторический checkpoint до correction review. Актуальные изменения PR6/PR7, границы безопасности, точный список файлов и ограничения: [pr7-architecture-correction-review.md](pr7-architecture-correction-review.md). PR5 остаётся frozen. Старые формулировки о guardian DM и публичности графа ниже заменены корректирующими контрактами; это не разрешение на merge/production SQL.

## Стек и границы

- Stage A: `epic/models-students`, PR #5, зафиксированный head `b0e46cf2754b74a23d3e8a8f13c6fe1eda036305`.
- Stage B: `epic/production-network-foundation`, draft PR #6, head `62a57950b9641c126333524994be45ca76d04a44`.
- Stage C: `epic/sourcing-ai-foundation`, основана строго на указанном head Stage B. Отдельный draft PR; актуальный hash находится в PR.
- Ни одна ветка не объединена. Production SQL, seeds, разрешения и пользовательские данные не изменялись. Предыдущая работа сохранена.
- IMPLEMENTED означает проверенный локальный код/SQL; FOUNDATION ONLY — контракт/схема без полного рабочего продукта. Это не разрешение на production-релиз.

## Исправление PR5

1. **Что исправлено.** Новая корректирующая миграция, без правок рассмотренной истории. Детали: `pr5-correction-review.md`.
2. **Политики поддержки.** Basic и verified лимиты раздельны и хранятся в БД; базовая помощь доступна неподтверждённому студенческому проекту.
3. **Студенты.** Программа организации выбирает all_student_projects или verified_only. Очередь проверки содержит безопасную идентификацию; решение требует причины, независимого проверяющего и срока.
4. **Модели.** Модель — специализация того же человека. Типовые параметры кастинга валидируются; создание вакансии не переключается автоматически на модель. Нерелевантные права использования не обязательны для наставничества/транспорта.
5. **Блокировки.** user_blocks — канонический источник для новых сообщений, приглашений и контактов. История переписки сохраняется.
6. **Проверки.** Stage A: 88 автотестов и 38 desktop/mobile сценариев, typecheck/lint/build успешны. Локальный replay; без production-миграции.

## Production Network

7. **Casting Subject — IMPLEMENTED.** casting_subjects отделяет взрослую учётную запись, детский профиль и будущий внешний объект. Исторические отклики дополнены без потери идентичности.
8. **Young Talent — IMPLEMENTED / ограниченный запуск.** Защищённый поиск, страницы без индексации, отдельное reviewed-разрешение; PRO не даёт доступа.
9. **Представители — IMPLEMENTED / FOUNDATION.** Pending/approved/revoked, основной представитель, срок, независимый review RPC. Вторичный представитель предусмотрен схемой; полный evidence/onboarding процесс ещё не готов.
10. **Детская приватность — IMPLEMENTED.** Нет анонимного каталога, детского DM, публичной даты рождения или контактов. Медиа private; клиентская загрузка запрещена до sanitation. Это release blocker.
11. **Кастинг — IMPLEMENTED / FOUNDATION.** Роли, кандидаты, статусы, заметки и комментарии сохраняются; application-source проверяется по проекту/субъекту. Auditions, ensembles и закрытые media versions — foundation. Adult share API ограничен выбранными кандидатами, хешем токена, сроком и отзывом; полного UI просмотров/проб пока нет.
12. **Professional Graph — IMPLEMENTED.** Обе стороны подтверждают связь; клиент не пишет timestamps/status напрямую. Человек управляет публичностью. Завершённые/скрытые связи исключаются из публичной проекции.
13. **Rental Crew Network — IMPLEMENTED.** Компания показывает безопасную сеть реальных связей. Связь не означает FilmVerse Verification, доступность или обязательство участвовать в коммерческом предложении.
14. **Образовательная организация — IMPLEMENTED.** Используется существующий тип education, без параллельных школьных аккаунтов; профиль содержит специализированные вкладки.
15. **Программы — IMPLEMENTED / FOUNDATION.** Реальное создание/чтение, тип/формат/цена/ссылка/видимость; преподаватель — существующий человек с согласованной связью. Регистрация/оплата курса не подключены.
16. **События — IMPLEMENTED / FOUNDATION.** Календарные данные, формы публикации, фильтры, публичная карточка, ошибки сохранения. Повторяющиеся сессии, запись и модераторский кабинет — дальнейшая работа.
17. **Навигация — IMPLEMENTED.** Работа, Проекты, Люди, Компании, Маркет, Индустрия. Личные сообщения/связи/партнёрский кабинет — личные инструменты. Фиктивные числа удалены из бокового меню.
18. **Referral engine — IMPLEMENTED / FOUNDATION.** Кампания, код, первая атрибуция, trusted activation, конфигурируемые правила; регистрация сама не начисляет награду.
19. **Типы партнёров — IMPLEMENTED.** Individual, film_school, casting/rental/production/agency partner, ambassador, other; статус партнёра не даёт верификации.
20. **Reward ledger — IMPLEMENTED.** Append-only записи и отдельные компенсационные отмены; обе стороны могут иметь разные значения награды. Approved — ещё не выданные в AI/PRO бонусы.
21. **Антифрод — IMPLEMENTED / ограничение.** Self-referral, собственная организация, повтор аккаунта/награды, replay и отмена проверяются. Нет device fingerprinting. Подлинность activation должен гарантировать будущий server worker.
22. **Школьный партнёрский поток — FOUNDATION.** Cohort/campaign/link и агрегированный кабинет; ссылка не подтверждает студента. Самостоятельное создание партнёра/кампании ещё не открыто.
23. **Rental/casting referrals — FOUNDATION.** Поддержаны виды кампаний и атрибуция; за подтверждение связи и привлечение ребёнка награда невозможна. Нет комиссии от заработка актёра.
24. **Органические приглашения — частично IMPLEMENTED.** Действующие проектные приглашения и запросы профессиональных связей; contextual referral landing. Общая attribution-интеграция каждого будущего invitation flow ещё не завершена.
25. **SEO/share — FOUNDATION.** Безопасные hash detail/share routes, noindex защищённых страниц, revocable selected-only casting API. Настоящие серверные OG/canonical/sitemap не реализованы.
26. **Проверки B.** 96 автотестов, 46 desktop/mobile сценариев, npm ci/typecheck/lint/test/build и полный replay успешны. GitHub CI и Foundation checks для head PR6 — success. Браузер использует изолированные HTTP fixtures, не production.

## Sourcing / AI

27. **Sourcing event — IMPLEMENTED.** Канонические событие/лоты/участники, проект/организация, тип, режим, валюта, сроки, версия, scope и правила. Состояния будущих процессов подготовлены, но все переходы UI ещё не реализованы.
28. **Sealed RFQ — IMPLEMENTED.** Участник не читает чужие предложения/items. При buyer_sealed_until_close заказчик тоже не видит их до серверного срока.
29. **Reverse auction — IMPLEMENTED.** Только разрешённые типы; decrement, правила обратной связи, серверное время, ограниченное продление, блокировка события при транзакции.
30. **Предложения специалистов — IMPLEMENTED.** Individual crew только sealed_person_proposal. Casting Subject/дети исключены. Need типа person нельзя прикрепить к аукциону оборудования.
31. **Приватность ставок — IMPLEMENTED.** RLS, отдельная безопасная feedback-проекция; участники скрыты друг от друга. Target budget приватный; ceiling — открытое заранее заданное правило.
32. **Awards — IMPLEMENTED / FOUNDATION.** Manual best value по умолчанию, rationale, lowest compliant/manual multifactor, split по лотам. Решение не заключает договор и не бронирует специалиста.
33. **Fairness — IMPLEMENTED / ограничение.** Материальное изменение увеличивает версию, сохраняет общую notice, требует acknowledgement/reopen. Старые ставки неизменны; открытые лоты нельзя тайно переписать. Email/push уведомления ещё не подключены.
34. **AI-архитектура — FOUNDATION ONLY.** Один Production Agent, typed gateway, domain-owned authority/facts. LLM/provider/hosted executor не подключены.
35. **Tool registry — IMPLEMENTED как контракт.** Явный allowlist, READ/PROPOSE/WRITE, evidence и unknown/conflicts. Нет arbitrary SQL, скрытых action tools или swarm.
36. **AI risk approvals — IMPLEMENTED / FOUNDATION.** SQL approval привязан к инициатору, проекту, неизменяемым аргументам/hash и сроку. Атомарный исполнитель одобренных действий пока не подключён.
37. **AI и дети — ограниченный контракт.** Только reviewed search/guardian domain. Child contact, compliance approval, grant permission, auto-book отсутствуют в allowlist. Живой gateway ещё требует независимой проверки redaction.
38. **AI wallets — IMPLEMENTED.** Персональный/корпоративный кошелёк, неизменяемый ledger/usage, серверная стоимость, идемпотентные debit/refund и блокировки.
39. **Free allowance — FOUNDATION.** Welcome/monthly политика и одноразовое начисление на период реализованы; по умолчанию отключены вместе с операциями до подключения настоящей AI-пользы.
40. **Company AI wallet — IMPLEMENTED.** use_ai, актуальное членство и проект той же компании; увольнение закрывает доступ. Расход записывает инициатора/проект/operation/catalog version/credits/инфраструктурную оценку.
41. **Project Need — IMPLEMENTED.** Каноническая таблица и ручная форма проекта с persistence/reload/error state; SQL проверяет соответствие target/route.
42. **Crew Builder — FOUNDATION ONLY.** Общий контракт маршрутов для ручного UI, AI и будущего Student Guided Mode. Полный Crew Builder и автобронирование не строились.
43. **Проверки C.** Итоговые результаты и оговорки — в `sourcing-ai-review.md`. Включены полный replay, RLS/approval/wallet adversarial tests и отдельные гонки в настоящем socket-only PostgreSQL.

## Release review

44. **Оставшиеся mocks.** Прежние Home/Notifications/части actor UI и другие исторические заглушки не превращены автоматически в real data этой задачей. Новые формы не сообщают об успешной записи при ошибке. Playwright fixtures — тестовые данные, не production-функциональность.
45. **Safety blockers.** Child evidence/age/retention/representative workflow, sanitation, moderation/rate limits, source/provider integration, hosted security acceptance. Dependency audit остаётся 21 (3 low/5 moderate/13 high), lint — 7 прежних предупреждений.
46. **Staging.** Backup/restore rehearsal, полный стек на PostgreSQL 15+, Supabase Auth/JWT/RLS/Storage/Realtime проверки реальными отдельными тестовыми пользователями, проверка миграции исторических данных и независимый review. Production advisor старого deployed стека не заменяет это.
47. **SEO.** Hash-SPA остаётся blocker для качественных публичных карточек и поискового продвижения. Noindex hint не является защитой; защита обеспечивается БД.
48. **Payments.** Провайдер, checkout/webhooks, контракты, подписочные allowance jobs и платное продвижение не подключены. Ни цены денег, ни платёжный успех не придуманы.
49. **Referral cash payout.** Не реализован; нужны provider, договоры, налоговый/KYC/accounting процесс. Cash_future нельзя квалифицировать текущим RPC.
50. **Actor/Model/Young Talent readiness.** Adult специализации/отклики имеют проверенный фундамент; Young Talent — только закрытая staging-проверка, не публичный запуск.
51. **Education/Events readiness.** Реальные базовые публикации есть; для запуска нужны модерация/антиспам и доработка organizer/roster/date UX. Школьная вкладка проектов пока показывает публичные проекты организации без полной связи школы со всеми student projects.
52. **Referral/Partner readiness.** Схема/ledger/кабинет есть; нет доверенного activation/fulfillment worker и самостоятельного partner onboarding. Не рекламировать бонус как уже доступный для расходования.
53. **Sourcing readiness.** Проверенное транзакционное ядро; ещё не полноценный тендерный продукт: нужны рабочие supplier/buyer UI, доставки notices, вложения и lifecycle-проверка.
54. **AI readiness.** Архитектура и учёт, не работающий AI-сервис. Операции выключены; production gateway/LLM/payment/approval execution — release blockers.
55. **Crew Builder readiness.** Контракт и каноническая потребность готовы к review; полная сборка команды сознательно не реализована.

## Следующее действие

Архитектурное ревью отдельных PR по порядку A → B → C. Не merge и не применять production migrations автоматически. Доменные файлы разделяют IMPLEMENTED / FOUNDATION ONLY / FUTURE DEPENDENCY / RELEASE BLOCKER.
