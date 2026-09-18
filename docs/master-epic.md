READ AGENTS.md FIRST.

============================================================
FILMVERSE — MASTER PRODUCT / ARCHITECTURE / ENGINEERING EPIC
============================================================

You are working on FilmVerse as its principal:

- software architect
- senior full-stack engineer
- Supabase/Postgres architect
- security engineer
- product architect
- UX designer
- marketplace architect
- QA engineer

Do NOT optimize for writing more code.

Optimize for:

CORRECTNESS
SECURITY
SPEED
CLARITY
PRODUCT VALUE
LOW FRICTION
SCALABILITY
RELIABILITY

FilmVerse is an ACTOR-FIRST professional film-industry platform.

Its long-term loop is:

PERSON
→ PROFILE
→ FIND WORK / FIND PEOPLE
→ APPLICATION / INVITATION
→ CASTING / SELECTION
→ PROJECT
→ TEAM
→ DEPARTMENTS
→ COMMUNICATION
→ PRODUCTION.

FilmVerse must not stop at “find a person”.

The product should help a production go from:

IDEA
→ WHO DO I NEED?
→ FIND THEM
→ SELECT THEM
→ BUILD TEAM
→ COMMUNICATE
→ SHOOT.

============================================================
PRODUCT REFERENCES
============================================================

Use mechanics from mature products as references.

PRIMARY:
Backstage

Also learn from:
Kinolift
FilmToolz
Yamdu
SetHero
Celtx

Study useful mechanics such as:

- actor profiles
- actor search
- casting roles
- candidate pipelines
- shortlist / waitlist / hire
- comments and collaborative casting
- team planning
- crew departments
- production contacts
- project workspaces
- project communication
- call-sheet-compatible crew data
- saved team structures
- crew templates

IMPORTANT:

DO NOT copy their visual design.
DO NOT blindly copy their product decisions.

Ask:

1. What real production problem does this mechanic solve?
2. Can FilmVerse solve it faster?
3. Can FilmVerse solve it with less friction?
4. Can FilmVerse connect it more deeply to the rest of production?

FilmVerse visual direction:

cinematic
+ human
+ premium
+ professional
+ trustworthy.

DISCOVERY = cinematic / photographic.
WORKSPACES = efficient / dense / productive.

Avoid:
generic SaaS
crypto
cyberpunk
neon
excessive glass
decorative futuristic UI.

============================================================
CRITICAL WORKING RULE
============================================================

THIS IS ONE PRODUCT EPIC,
BUT NOT ONE GIANT COMMIT.

Work sequentially in PHASES.

After every phase:

- inspect git diff
- run typecheck
- run lint
- run tests
- run build
- review related RLS
- review migrations
- commit clearly

If a phase fails:
FIX IT BEFORE MOVING ON.

Never hide failed checks.

Do not declare success because TypeScript compiles.

============================================================
CURRENT FOUNDATION — DO NOT REGRESS
============================================================

Important existing work exists in:

fix/vercel-auth-deploy
PR #2

Before writing code:

1. inspect current branch;
2. inspect PR #2;
3. inspect main;
4. inspect all uncommitted changes;
5. determine which current branch contains the newest work;
6. preserve the PR #2 architecture fixes.

DO NOT reintroduce:

- hasBeenAuthenticated
- fake authenticated state
- fake Supabase fallback backend
- profile DB errors being interpreted as logout
- profile DB errors being interpreted as missing profile
- unsafe repeated-registration success UX
- missing migration 011 history

Supabase session is the ONLY auth source of truth.

If current working branch does not contain the PR #2 fixes,
integrate them safely before continuing.

DO NOT overwrite newer legitimate work.

============================================================
PHASE 0 — COMPLETE FOUNDATION AUDIT
============================================================

Before implementing new features inspect:

AUTH:
src/hooks/useAuth.tsx
AuthModal
App routing
TopBar
Sidebar

DATABASE:
all Supabase migrations
RLS policies
functions / RPC
storage policies

PRODUCT:
ProfilePage
ActorsPage
ProfessionalsPage
MessagesPage
Projects
Work
Marketplace
Pulse
CreateDialog
PublishMenu

Check:

- stale mocks
- duplicated sources of truth
- fake buttons
- client-side-only success states
- missing RLS
- public data leaks
- missing indexes
- N+1 queries
- unnecessary SELECT *
- oversized browser-side filtering
- insecure SECURITY DEFINER functions

Produce an internal implementation plan,
then start PHASE 1.

============================================================
PHASE 1 — VERCEL / AUTH / DEPLOYMENT RELIABILITY
============================================================

FilmVerse must run independently from Bolt.

Required Vercel build variables:

VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY

Never expose service_role to frontend/Vite.

If variables are absent:

DO NOT silently use fake backend.

Show a clear deployment configuration failure.

Authentication:

valid Supabase session
→ authenticated

loading
→ auth loading state

no session
→ guest

profile DB/RLS/network failure
→ authenticated user remains authenticated
→ show profile error separately.

fetchProfile must distinguish:

FOUND
NOT_FOUND
ERROR

Only NOT_FOUND may create/bootstrap a profile.

Repeated signup on an existing email must use privacy-safe wording.

Never reveal:
“this email definitely exists”.

Use wording similar to:

“If this is a new email, check your inbox.
If you already have a FilmVerse account, sign in or reset your password.”

Test:

login
refresh
logout
expired session
profile query failure
multi-tab session refresh
password reset
signup existing email
signup new email.

============================================================
PHASE 2 — ONE PROFESSIONAL MODAL SYSTEM
============================================================

Current long dialogs can extend outside viewport,
making close controls inaccessible.

Create reusable:

ModalShell

Required:

- stays within viewport
- safe spacing from top/bottom
- sticky header
- X permanently visible
- Esc closes
- overlay click closes
- explicit Cancel when appropriate
- body scroll only
- background scroll locked
- correct mobile behavior
- reasonable focus management

Migrate relevant dialogs:

Publish
Create vacancy/project
New chat
Edit listing
Resume publish
Verification
other long forms.

This must permanently solve:
“крестика закрыть не видно”.

============================================================
PHASE 3 — GLOBAL “РАЗМЕСТИТЬ”
============================================================

The GLOBAL top-bar button:

“Разместить”

must show ONLY:

1. ВАКАНСИЯ
2. РЕЗЮМЕ

DO NOT show Project here.

Project creation belongs inside /projects.

DO NOT touch the Marketplace-specific publish button.
Marketplace keeps its own dedicated flow.

============================================================
PHASE 4 — RESUME IS NOT PROFILE
============================================================

Current behavior:

Разместить → Резюме
→ /profile

is wrong.

PROFILE =
permanent professional identity.

RESUME PUBLICATION =
“I am actively looking for work”.

Create a real persisted Resume/Profile Publication entity.

Possible table:

profile_publications

Fields approximately:

id
user_id
headline
desired_profession_ids
custom_professions
city / cities
travel_ready
availability
rate_text
description
status
published_at
expires_at
created_at
updated_at

Prefill from profile.

User can edit before publishing.

Statuses:

draft
active
paused
closed
expired

============================================================
PHASE 5 — RESUME MONETIZATION
============================================================

Publishing resume requires:

PRO
OR
one-time publication entitlement.

IMPORTANT:

PRO != VERIFIED.

Verification is NEVER sold.

Create clean entitlement architecture.

If payment provider is not integrated:

DO NOT fake successful payment.

Implement:

- entitlement check
- paywall UI
- admin/test grant
- payment provider adapter boundary
- TODO for actual payment processing

Do NOT invent prices inside product logic.

============================================================
PHASE 6 — SKILLS ARCHITECTURE
============================================================

Current skill model mixes:

actor skills
professional tools
genres
formats

This is wrong.

Example of bad mixing:

Sony Venice
Сценический бой
Сериалы

They are different concepts.

Extend canonical skills architecture.

SKILLS should support:

scope:
actor
professional

department_id nullable

category nullable

sort_order

is_active

Do NOT destroy existing skill IDs.

Use NEW migration.

============================================================
ACTOR SKILLS
============================================================

Create curated categories.

ACTING / PERFORMANCE:

Импровизация
Сценическая речь
Озвучивание
Дубляж
Работа с телесуфлёром
Пантомима
Клоунада

MOVEMENT / DANCE:

Хореография
Современные танцы
Классический танец
Бальные танцы
Народные танцы
Hip-hop
Акробатика
Гимнастика

STUNTS / COMBAT:

Сценический бой
Фехтование
Боевые искусства
Бокс
Кикбоксинг
Борьба
Работа с оружием
Падения
Базовые трюки

SPORT:

Плавание
Бег
Футбол
Баскетбол
Волейбол
Теннис
Лыжи
Сноуборд
Коньки
Скалолазание

VEHICLES:

Вождение автомобиля
Мотоцикл
Квадроцикл
Велосипед
Водный транспорт

ANIMALS:

Верховая езда
Работа с животными

MUSIC:

Пение
Гитара
Фортепиано
Ударные
другие музыкальные инструменты

OTHER:

Языки
Диалекты / акценты
Модельный опыт
Ведущий
Танцевальная пластика

============================================================
PROFESSIONAL SKILLS
============================================================

Professional skills should preferably be shown
according to selected department/profession.

Examples.

CAMERA:

ARRI Alexa
ARRI Alexa Mini LF
Sony Venice
Sony FX6
RED
Blackmagic
Steadicam
Ronin
Focus pulling
Wireless focus
Camera rigging
Lens control
DIT workflow
Data management

LIGHT:

Aputure
ARRI Lighting
Astera
DMX
Lighting console
Generator work
Rigging light

GRIP:

Dolly
Crane
Slider
Rigging
Car rig
Overhead rig
Track laying

EDIT / POST:

Avid
Premiere Pro
DaVinci Resolve
Final Cut Pro
After Effects
Media Composer
Color grading
Proxy workflow
Conforming
Online editing

VFX:

Compositing
Nuke
Fusion
Blender
Maya
Cinema 4D
Houdini
Unreal Engine
3D modelling
Tracking
Rotoscoping
Motion Design

SOUND:

Pro Tools
Reaper
Location sound
Boom operation
Wireless microphones
Foley
Sound design
Dolby Atmos
Mixing
ADR

MAKEUP:

Beauty makeup
Character makeup
Age makeup
Prosthetic makeup
SFX makeup
Wounds
Wig work
Hairstyling

PRODUCTION:

Scheduling
Budgeting
Call sheets
Crew coordination
Production logistics
Location management
Movie Magic Scheduling
Movie Magic Budgeting

STUNTS:

Stunt coordination
Fight choreography
Wire work
High falls
Vehicle stunts
Fire stunts
Rigging

============================================================
PHASE 7 — CUSTOM VALUES EVERYWHERE
============================================================

Fundamental FilmVerse UX rule:

PRESET WHEN POSSIBLE.
FREE TEXT ALWAYS AVAILABLE.

This applies to:

skills
professions
positions
departments
marketplace fields
project genres
project types
equipment
roles
team positions
requirements

Never trap the user because FilmVerse taxonomy is incomplete.

For custom skills create:

user_custom_skills

fields:

id
user_id
name
scope
department_id nullable
created_at

Requirements:

owner CRUD
case-insensitive duplicate protection
trim whitespace
max length
reasonable count limit
RLS.

Do not let users pollute global canonical skill dictionary.

============================================================
PHASE 8 — EXPERIENCE TAGS
============================================================

These are NOT skills:

Реклама
Сериалы
Документальное
Артхаус
Исторический
Копродукция
Фестивальное кино

Create:

experience_tags
user_experience_tags

Categories may include:

FORMAT:
Полный метр
Короткий метр
Сериал
Реклама
Музыкальный клип
ТВ
Документальный
Digital

GENRE:
Драма
Комедия
Экшен
Триллер
Исторический
Фантастика
Артхаус

Migrate current inappropriate skill selections safely.

Do not lose existing user choices.

============================================================
PHASE 9 — PERSONAL CABINET / “МОЁ”
============================================================

Create a real user control center.

Everything the user publishes must be findable.

Sections:

МОЙ ПРОФИЛЬ

МОИ РЕЗЮМЕ

МОИ ВАКАНСИИ

МОИ ПРОЕКТЫ

МОИ ОБЪЯВЛЕНИЯ

МОИ ОТКЛИКИ

ИЗБРАННОЕ

For each published item provide quick actions.

Resume:
open
edit
pause
close
status

Vacancy:
open
edit
close
applicants
go to applicants

Project:
open
edit
team progress
Crew Builder
Casting Room

Marketplace:
open
edit
remove
repost/duplicate where safe

Applications:
open
status
withdraw if permitted

Favorites:
people
marketplace.

============================================================
PHASE 10 — FAVORITES
============================================================

Add heart/favorite actions to:

actor cards
public profiles
professional cards
marketplace cards
marketplace listing pages

Prefer:

profile_favorites

listing_favorites

unique:
(user_id, target_id)

Owner can only modify own favorites.

Guest:
heart
→ authentication
→ preserve intended action.

Do NOT turn this into social-media likes.

Public favorite counters are not required.

============================================================
PHASE 11 — MARKETPLACE
============================================================

Do not break its current dedicated publish flow.

Add OWNER actions:

Редактировать
Снять с публикации
Вернуть в публикацию if status supports it

Current owner delete-only experience is insufficient.

Add category-specific fast fields.

CAMERA:

brand
model
mount
package

OPTICS:

brand
mount
focal range / set
aperture

LIGHT:

brand
model
power

TRANSPORT:

type
brand/model
driver included

LOCATION:

location type
area
power
parking

SERVICES:

service type
experience

Avoid 50 nullable database columns.

Use structured attributes JSONB where appropriate
with application validation.

Always provide custom value.

Add:

condition
availability
delivery
deposit where appropriate
multiple images.

============================================================
PHASE 12 — ACTOR-FIRST PROFILE
============================================================

FilmVerse is ACTOR-FIRST.

Current actor public information is insufficient.

Real actor pages must use real Supabase data.

Do not route real actors to mock ActorProfilePage.

Create a safe public actor representation.

Never expose private user fields by accident.

Public actor profile should include:

MAIN:

headshot
gallery
name
category
city
availability
approved verification badges
Message
Invite
Favorite
Share

CASTING DATA:

chronological age
playing age from
playing age to
height
weight
build
eye color
hair color
hair length
clothing size
shoe size

Do not make everything mandatory.

MEDIA:

photos
video introduction
showreel
casting/self-tape samples
voice/audio later

CAREER:

education
acting schools
workshops
filmography
credits
project
role
year
director
awards
representation / agent

SKILLS:

actor skills
languages
accents
driving
motorcycle
horse riding
combat
dance
music
custom skills

AVAILABILITY:

city
travel readiness
status

PRIVACY:

email NOT public by default
phone NOT public by default
agent contact separately controlled.

============================================================
PHASE 13 — ACTOR SEARCH
============================================================

Current filtering is far too limited.

Implement useful server-side filters:

city
gender
chronological age
playing age
height range
availability
category
eye color
hair color
skills
languages
verified
has photos
has video/showreel

Do NOT load entire actor table
and filter only in browser.

Use server-side query/filtering.

Add pagination.

Add database indexes for real common filters.

Do not build 100 filters merely because competitors have them.

============================================================
PHASE 14 — PROJECT CREATION
============================================================

Project creation should include:

title
type
genre
stage
city
locations
language
prep dates
shoot dates
logline
description
director
producer
cover
visibility

Visibility:

public
unlisted
private

Taxonomy plus custom input.

============================================================
PHASE 15 — FILMVERSE CREW BUILDER
============================================================

THIS IS A FLAGSHIP FEATURE.

Crew Builder is not a small form.

Product thesis:

IDEA
→ PROJECT
→ TEAM BLUEPRINT
→ OPEN POSITIONS
→ PEOPLE
→ CANDIDATES
→ TEAM
→ DEPARTMENTS
→ COMMUNICATION.

FilmVerse Crew Builder should become:

FOR STUDENTS:
“Film-production structure without the confusion.”

FOR PROFESSIONALS:
“Crew planning without spreadsheets and duplicated data.”

Use ONE data model,
but TWO UX modes:

GUIDED MODE

FAST / PRO MODE.

============================================================
PHASE 16 — PROJECT TEMPLATES
============================================================

Offer templates:

Студенческий фильм
Короткометражный фильм
Полный метр
Сериал
Реклама
Музыкальный клип
Документальный
Digital
Пустой проект

Templates are suggestions.

User can always:

remove
rename
change quantity
add department
add position
add custom position.

============================================================
PHASE 17 — GUIDED CREW BUILDER
============================================================

Designed especially for:

students
new directors
new producers
small productions.

Ask only useful setup questions.

Example:

project type
shooting days
approximate team size
locations
actors required

Then:

“Вот базовая команда, с которой можно начать.”

Example recommendation:

DIRECTING
Director ×1
1st AD ×1

PRODUCTION
Producer ×1
Production Manager ×1
Administrator ×1

CAMERA
DP ×1
1AC ×1
2AC ×1

LIGHT
Gaffer ×1
Lighting Technician ×2

SOUND
Production Sound Mixer ×1
Boom Operator ×1

etc.

For each position optional short explanation:

“What does this person do?”

Example:

1AC / Focus Puller:
“Responsible for image focus and camera lens workflow.”

Keep explanations short.

User actions:

Не нужен
Добавить
Количество
Совмещает другой человек

Do not make FilmVerse look like a textbook.

============================================================
PHASE 18 — PRO CREW BUILDER
============================================================

Professional mode should feel:

as fast as spreadsheet
but smarter.

Dense structure:

DEPARTMENT | POSITION | NEEDED | FILLED | STATUS

Example:

Camera
DP                  1    1/1
1AC                 2    1/2
2AC                 1    0/1

Light
Gaffer              1    1/1
Lighting Tech       4    2/4

Support:

keyboard navigation
autocomplete
add row
duplicate row
delete row
add entire department
custom department
custom position
bulk quantities.

============================================================
PHASE 19 — TEAM SIZE BEHAVIOR
============================================================

Do NOT do:

team size = 20
→ render 20 profession dropdowns.

Use positions with quantities.

Example:

Camera / 1AC ×2
Light / Technician ×5
Makeup / Makeup Artist ×2
Actor role / Security Guard ×8

Show:

TEAM PLAN
17 / 20 planned

Then:

FILLED
12 / 20 confirmed.

============================================================
PHASE 20 — PROJECT POSITIONS DATA MODEL
============================================================

Create normalized:

project_positions

Suggested fields:

id
project_id
unit_id nullable
department_id nullable
profession_id nullable
custom_department nullable
custom_title nullable

quantity_needed
quantity_filled

priority
critical

description
responsibilities
requirements

location
start_date
end_date

pay_type
pay_amount nullable
pay_text nullable

status
sort_order
created_at
updated_at

Use taxonomy OR custom value.

============================================================
PHASE 21 — POSITION REQUIREMENTS
============================================================

Each position can specify:

skills
experience
city
availability
languages
equipment
license where relevant
portfolio requirement
custom requirements

Use progressive disclosure.

Default:

position
quantity
dates
city
payment

Advanced:

“Дополнительные требования”.

============================================================
PHASE 22 — SMART TEAM SUGGESTIONS
============================================================

Start deterministic.

Do NOT build opaque AI magic.

Suggestions can depend on:

project type
shoot days
estimated team size
actors
locations
stage

Student short:
lean structure.

Large feature:
expanded structure.

User must confirm.

Never silently publish vacancies.

============================================================
PHASE 23 — TEAM COVERAGE
============================================================

Display facts.

Example:

TEAM
14 / 20 confirmed

CRITICAL OPEN:
1AC
Location Manager
Sound Mixer

Camera 4/5
Light 3/4
Sound 2/2

No fake scores.

============================================================
PHASE 24 — MULTIPLE ROLES PER PERSON
============================================================

One person may have multiple project assignments.

DO NOT duplicate person.

Create architecture:

project_members

project_member_assignments

Example:

Ivan
Director
Producer

Anna
Costume Designer
Makeup Artist

Warn about obvious date conflicts if useful,
but do not forbid legitimate combinations.

============================================================
PHASE 25 — EXTERNAL CREW
============================================================

Very important.

A producer must be able to add someone
who is not yet registered on FilmVerse.

External member:

name
position
optional email
optional phone
status

Then:

Пригласить в FilmVerse

When the person joins,
link existing project member to profile.

Do NOT create duplicate team member.

External contact data must be project-private.

============================================================
PHASE 26 — CREW TEMPLATES
============================================================

Professionals need reusable structures.

Allow:

SAVE TEAM AS TEMPLATE

Examples:

“My Commercial Crew”
“My Documentary Crew”
“My Student Short”
“My Interview Crew”

Next project:

Use template
→ structure generated
→ edit.

Also:

COPY TEAM STRUCTURE FROM PREVIOUS PROJECT.

Never copy private member data unless explicitly selected.

============================================================
PHASE 27 — BULK CREW ENTRY
============================================================

Allow fast paste.

Example:

DP
1AC
2AC
Gaffer
Best Boy
Sound Mixer

Try mapping to taxonomy.

Unknown line:
keep as custom position.

Never discard it.

Prepare architecture for CSV/Excel later.

============================================================
PHASE 28 — PROJECT UNITS
============================================================

Prepare optional units:

Main Unit
Second Unit
Stunt Unit
B Unit
Custom

Hide complexity from student/small projects by default.

============================================================
PHASE 29 — OPEN POSITION → VACANCY
============================================================

Every unfilled project position gets:

“Найти человека”

Click:

position
→ prefilled vacancy

Autofill:

project
department
profession
custom title
quantity
dates
city
requirements
skills
payment

User confirms before publish.

Applications must return into that exact position.

============================================================
PHASE 30 — CANDIDATE PIPELINE
============================================================

For every position:

NEW
REVIEW
SHORTLIST
INVITED
CONFIRMED
BACKUP
REJECTED

Sources:

application
direct invite
manual add
external contact

Show:

profile
availability
city
skills
portfolio
requirements match
notes
messages.

Do NOT produce hidden AI scores.

If displaying match:

explain criteria.

Example:

4/5 requirements match

City ✓
Availability ✓
Steadicam ✓
Sony Venice ✓
English not specified

============================================================
PHASE 31 — CASTING ROOM
============================================================

This is a core actor-first feature.

Build structured CASTING ROOM v1.

Do NOT start with unlimited free-form node canvas.

Structure:

PROJECT

CHARACTER / ROLE NODE
↓
ACTOR CANDIDATES

Example:

[ АЛЕКСЕЙ 32–38 ]
  Actor A
  Actor B
  Actor C

[ МАРИЯ 25–30 ]
  Actor D
  Actor E

Support:

create character/role
description
age
gender
skills
requirements

attach actor manually
application appears
invite actor

candidate statuses:

to_review
shortlist
waitlist
audition
approved
rejected

candidate:

private notes
private rating
comments
self-tape
comparison
message
favorite.

Private rating/notes must never be visible to actor.

============================================================
PHASE 32 — CASTING COLLABORATION
============================================================

Invite collaborators:

director
casting director
producer
assistant
reviewer

Permission levels:

OWNER
PROJECT ADMIN
CASTING COLLABORATOR
REVIEWER

Comments:

role comment
candidate comment
self-tape comment

Show:

author
timestamp
edit own
delete own

Realtime where useful.

This is project-private collaboration.

============================================================
PHASE 33 — PROJECT HUB
============================================================

Once project exists,
Crew Builder remains alive.

Project becomes workspace:

Overview
Team
Open Positions
Casting
Messages
Files
Calendar later

When team becomes staffed:

DO NOT end journey.

Change:

FIND TEAM
→ MANAGE TEAM.

============================================================
PHASE 34 — MESSAGING UX
============================================================

Main Messages should feel like Telegram.

Do NOT expose DB concepts.

Desktop:

LEFT:
conversation list

RIGHT:
active conversation

Conversation list:

avatar
name
last message
time
unread
search

Composer:

text
Enter to send
Shift+Enter newline
reply
attachment
send state
failure state.

Do not require users to think:

direct
group
department

for normal communication.

“Новое сообщение”
should first mean:
choose one person.

Group chat:
secondary action.

Department/project chats:
created from PROJECT CONTEXT.

============================================================
PHASE 35 — MESSAGE ENTRY POINTS
============================================================

Every public profile except own profile:

Написать

Marketplace:

Написать продавцу

Casting candidate:

Написать

Applicant:

Написать

Use canonical direct chat:

get_or_create_direct_chat

Same person:
same room.

Never duplicate direct room.

============================================================
PHASE 36 — PROJECT COMMUNICATION HUB
============================================================

After team begins forming,
FilmVerse becomes production communication layer.

Think:

TELEGRAM UX
+
FILM PRODUCTION STRUCTURE.

Project communication:

ОБЩИЙ ЧАТ

ОБЪЯВЛЕНИЯ

ДЕПАРТАМЕНТЫ

CUSTOM PROJECT GROUPS.

Direct messages remain personal.

============================================================
PHASE 37 — CHAT DATA ARCHITECTURE
============================================================

Use existing canonical:

chat_rooms
chat_members
chat_messages

DO NOT create a third chat system.

Extend safely with:

project_id nullable
room_scope

Possible:

general
announcements
department
custom

Direct:
project_id NULL

Project chat:
project_id set.

============================================================
PHASE 38 — GENERAL PROJECT CHAT
============================================================

One canonical General Chat per project.

All active project members get access.

No duplicates.

Possible system events:

user joined
assignment changed
dates changed

System messages visually distinct.

============================================================
PHASE 39 — DEPARTMENT CHATS
============================================================

Critical feature.

Each real project department may have:

internal department chat.

Example:

Project

General

Camera
Light
Sound
Makeup
Production

Membership must derive from PROJECT ASSIGNMENTS.

Do NOT maintain separate manual security list.

Example:

1AC
→ Camera chat access.

Person with Camera + Light assignments
→ both chats.

Assignment removed
→ access recalculated.

Project removed
→ access revoked.

Security-critical synchronization must be transactional.

============================================================
PHASE 40 — LAZY DEPARTMENT ROOMS
============================================================

Do NOT create 25 empty chats.

Create department room only when:

department has active assignment
AND
communication initialized.

Canonical uniqueness:

project + department
= one room.

============================================================
PHASE 41 — ANNOUNCEMENTS
============================================================

Project announcements.

All project members read.

Authorized roles write.

Useful for:

call-time changes
location updates
schedule changes
critical production notices.

Prepare for later:

read acknowledgement.

Do not fake read acknowledgement.

============================================================
PHASE 42 — CROSS-DEPARTMENT PROJECT GROUPS
============================================================

Allow authorized project members to create:

Camera + Light
Stunt rehearsal
Night shift
Location tomorrow

These are PROJECT-SCOPED custom groups.

Not global community chats.

============================================================
PHASE 43 — PROJECT CHAT FEATURES
============================================================

Once base messaging is stable:

reply
pin
@mention
image attachment
PDF/document attachment

Do not add heavy decorative features first.

No voice/video call system now.

============================================================
PHASE 44 — STRUCTURED CARDS IN CHAT
============================================================

FilmVerse advantage.

Allow sharing:

POSITION CARD

CANDIDATE CARD

ACTOR CARD

VACANCY CARD

PROJECT UPDATE

inside project chat.

Example:

[1AC — 1 open position]
Open candidates →

or:

[Actor: Ivan Petrov]
Open Casting Room →

Do not reduce everything to raw URL text.

============================================================
PHASE 45 — CREW DIRECTORY
============================================================

Inside project:

КОМАНДА

Searchable:

Name
Department
Position
Project role
Status
Message

Respect privacy.

============================================================
PHASE 46 — PROJECT MEMBER STATES
============================================================

Use:

PLANNED
INVITED
ACCEPTED
CONFIRMED
DECLINED
REMOVED

Do not count invited as confirmed.

============================================================
PHASE 47 — DEPARTMENT HEADS
============================================================

Allow scoped department head.

Examples:

DP
Gaffer
Production Designer

Possible department-scoped rights:

recommend members
manage department positions
department notes
department chat administration

Do not grant whole-project admin automatically.

============================================================
PHASE 48 — PROJECT ACCESS CONTROL
============================================================

Possible project roles:

OWNER
PROJECT ADMIN
PRODUCER / PRODUCTION MANAGER
DEPARTMENT HEAD
MEMBER
CASTING COLLABORATOR
VIEWER / REVIEWER

Use least privilege.

PRO subscription does NOT grant project authority.

============================================================
PHASE 49 — FUTURE CALL-SHEET READINESS
============================================================

Do NOT build full call sheets now
unless architecture makes it trivial.

But crew/team data must support later:

shooting day
call time
department call
individual call
location
unit
cast
crew
confirmation.

Goal:

PROJECT
→ TEAM
→ SCHEDULE
→ CALL SHEET

without re-entering crew data.

============================================================
PHASE 50 — VERIFICATION
============================================================

verification_records already exists,
but product flow is missing.

Build real verification UX.

PRO != VERIFIED.

Verification types v1:

EMAIL
automatic through auth confirmation

IDENTITY
manual review

PORTFOLIO / PROFESSIONAL
manual review

Later:
organization.

Statuses:

pending
approved
rejected
needs_correction / equivalent if required.

Verification evidence:
PRIVATE storage only.

Never expose identity documents publicly.

Create explicit permission:

review_verification

Only authorized reviewer can approve/reject.

Public UI:
show only APPROVED types.

Do not fake verification for admin.

============================================================
PHASE 51 — FOUNDER / ADMIN TEST ACCESS
============================================================

The founder FilmVerse account:

Денис Шаяхов

already has:

PRO
and all CURRENT permissions

in live Supabase.

Do NOT hardcode:

if email === ...

All access must use permission architecture.

For newly created admin capabilities,
create appropriate permissions.

Admin/founder should be able to test:

project creation
group chat
professional discussion
job publishing
project chats
application review
department targeting
community targeting
verification review
moderation

BUT:

admin status must NOT create fake public verification.

============================================================
PHASE 52 — REAL TEST ACCOUNTS
============================================================

We need multi-user testing.

Create admin/local seed tooling.

DO NOT INSERT auth.users from frontend.

Use Supabase Admin API locally/server-side.

Required env:

SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
ALLOW_TEST_SEED=true
TEST_USER_PASSWORD

Never expose service role to Vite.

Seed idempotently:

actor01
actor02
actor03
actor04
actor05

casting01
director01
producer01

camera01
light01
makeup01

Use clearly test/demo emails.

For each:

auth account
profile
slug
city
profession / actor data
skills
avatar/photo placeholders where appropriate.

Seed realistic relationships.

============================================================
PHASE 53 — TEST CONTENT
============================================================

Seed:

actors
professional users
one or more projects
team positions
actor characters
applications
candidates
marketplace listings
favorites
chat conversations
messages
pulse events

All demo data must be identifiable as test/demo.

Provide:

npm run seed:test

npm run seed:test:clean

Do not seed automatically in app startup.

============================================================
PHASE 54 — PULSE
============================================================

Pulse must not be decorative.

Current text target is insufficient.

Add:

target_type
target_id
target_path

Pulse event examples:

new vacancy
→ vacancy

new project
→ project

marketplace listing
→ listing

portfolio update
→ profile

public casting milestone where appropriate
→ project/casting

Pulse cards become clickable.

Deleted target:
event remains
but navigation safely disabled.

Seed fake Pulse events
linked to real test entities.

============================================================
PHASE 55 — LISTING / CONTENT EDITABILITY
============================================================

Anything user creates must later be manageable.

Never create dead content.

After:

resume
vacancy
project
marketplace listing

show:

Success

Open

Edit / Manage

and ensure item appears in Personal Cabinet.

============================================================
PHASE 56 — NOTIFICATIONS
============================================================

Build notification architecture around meaningful events.

Examples:

new message
application received
application status changed
project invitation
project invitation accepted
candidate invited
candidate approved
important project announcement

Do not fill UI with fake permanent badges.

Unread counts must come from real data.

============================================================
PHASE 57 — APPLICATIONS
============================================================

Build real application architecture
if not already implemented.

Candidate:

apply
withdraw where allowed
track state

Employer:

review
shortlist
waitlist
invite
approve
reject

Applications should link to:

work opportunity
project position
actor role/character where appropriate.

============================================================
PHASE 58 — BACKSTAGE-LIKE APPLICANT MANAGER
============================================================

Build productive candidate review.

Filters.

Candidate cards.

Status.

Notes.

Collaborators.

Message.

Portfolio.

Self-tape where applicable.

Do NOT copy Backstage visual design.

Use FilmVerse workflow.

============================================================
PHASE 59 — PERFORMANCE
============================================================

FilmVerse must handle:

8-person student film

30-person commercial

100-person feature

300+ person production.

Avoid:

SELECT *
on large tables

loading all actors

loading all candidates

loading all chat history

global realtime subscriptions

N+1 profile requests

unbounded lists.

Use:

server-side filtering
pagination
cursor pagination where appropriate
indexes
lazy loading
media optimization
virtualization for large boards
scoped realtime subscriptions.

Active room:
subscribe to active room only.

============================================================
PHASE 60 — DATABASE / TRANSACTIONS
============================================================

Operations affecting multiple security-sensitive tables
must not rely on fragile frontend sequences.

Use transaction/RPC where appropriate.

Examples:

accept project invite

→ project member active
→ assignment
→ chat access

remove project member

→ assignments removed/deactivated
→ project room access revoked

assignment department changed

→ department room permissions recalculated.

Never allow chat/project access drift.

============================================================
PHASE 61 — SECURITY
============================================================

Audit EVERY new table.

User must NEVER be able to:

edit another user's profile

edit another user's marketplace item

edit another user's resume

modify another user's favorites

grant themselves permissions

grant themselves verification

approve their own verification

join arbitrary chat/project rooms

read casting private notes outside project

read verification documents

read project-private contact information

add outsider to department chat without authorization.

Every SECURITY DEFINER function:

fixed search_path

auth.uid validation

ownership / membership validation

minimum EXECUTE grants.

============================================================
PHASE 62 — PUBLIC DATA PRIVACY
============================================================

Do not expose entire `profiles` table publicly
if it contains private fields.

Create safe public views/RPC/data projections where needed.

Public profile data should be intentional.

Email and phone not public by default.

Especially design for future minors safely.

============================================================
PHASE 63 — UX QUALITY
============================================================

Every important screen must answer:

What is this?
What can I do here?
What should I do next?

No dead ends.

No fake buttons.

No actions that visually succeed
but fail to persist.

Use:

progressive disclosure
good empty states
clear errors
fast feedback
preserved user context.

============================================================
PHASE 64 — STUDENT MAGIC MOMENT
============================================================

Test this exact journey.

Student chooses:

“Студенческий короткометражный фильм”

FilmVerse asks:

shoot days
team size
locations
actors

FilmVerse shows suggested team.

Student understands:

who is needed
what they do
what can be removed
what can be combined.

Student edits and presses:

“Начать поиск команды”

FilmVerse prepares open positions.

Student should feel:

“I understand who I need,
and FilmVerse can help me find them.”

============================================================
PHASE 65 — PROFESSIONAL MAGIC MOMENT
============================================================

Professional chooses:

Реклама

then saved template:

“My Commercial Crew”

Team structure appears immediately.

Producer edits:

Camera 5 → 7
Light 8 → 10

adds:

Drone Operator ×1

then:

Publish open positions.

This must take minutes,
not hours.

============================================================
PHASE 66 — COMPLETE END-TO-END QA
============================================================

TEST AS:

guest

actor

professional crew member

casting director

director

producer

admin.

Test:

REGISTER / LOGIN

login
refresh
logout
session expiry
reset password
existing email signup

PROFILE

fill actor
fill specialist
actor + specialist
custom skills
media
refresh
public view

ACTOR SEARCH

filters
pagination
profile navigation

FAVORITES

person
listing

RESUME

create
PRO entitlement
one-time entitlement
edit
pause
close

PROJECT

create
guided Crew Builder
pro Crew Builder
custom department
custom position
team template

TEAM

invite registered member
add external member
multiple assignments
fill position

VACANCY

position
→ vacancy
→ application
→ candidate

CASTING

character
candidate
comment
shortlist
self-tape
approval

MESSAGING

profile → Message
same room reuse
realtime messages
reply
attachments

PROJECT CHAT

general
department
custom

20-person test:

General:
20 members

Camera:
only Camera assignments

Light:
only Light assignments

Camera+Light user:
both

removed user:
loses appropriate access

outsider:
no access

MARKETPLACE

create
edit
favorite
message seller
remove
find in Personal Cabinet

PULSE

click event
→ correct entity

VERIFICATION

request
admin review
approved badge
rejected state
no self-approval

MODALS

1366×768
mobile

X always visible.

============================================================
PHASE 67 — AUTOMATED TESTING
============================================================

If existing test infrastructure is insufficient,
add minimum professional setup.

Use appropriate tools such as:

Vitest
React Testing Library
Playwright

Critical E2E flows should be automated.

At minimum:

auth refresh

profile persistence

profile error does not log out

existing-email signup

direct chat uniqueness

chat outsider rejection

favorites ownership

listing ownership

resume entitlement gating

project membership

department chat access

actor search

application flow.

============================================================
PHASE 68 — BUILD / CI
============================================================

Run:

npm ci

npm run typecheck

npm run lint

npm run test --if-present

npm run build

If Playwright is configured:
run relevant E2E suite.

Review generated files.

Do not commit dist unless architecture explicitly requires it.

No secrets committed.

============================================================
FINAL REPORT FORMAT
============================================================

At completion provide ONE structured report:

1. Current branch
2. Commits created by phase
3. Files changed
4. Migrations created
5. Tables created/changed
6. RLS policies
7. RPC/functions
8. Routes/screens
9. Auth status
10. Vercel readiness
11. Actor profile status
12. Actor search status
13. Resume status
14. Crew Builder status
15. Casting Room status
16. Messaging status
17. Project chats status
18. Marketplace status
19. Personal Cabinet status
20. Favorites status
21. Pulse status
22. Verification status
23. Test users/data status
24. Automated tests
25. Remaining mocks
26. Remaining TODOs
27. Payment integration TODO
28. Security risks
29. Performance risks
30. Recommended next step

DO NOT MERGE HIGH-RISK DATABASE/AUTH/RLS CHANGES AUTOMATICALLY.

STOP BEFORE MERGE.

Wait for architectural review.

============================================================
FINAL FILMVERSE STANDARD
============================================================

Before calling any phase complete ask:

Would a new actor understand FilmVerse immediately?

Would a casting director be faster here than using Telegram
plus spreadsheets?

Would a film student finally understand who they need
to make their project?

Would a professional producer be able to create
a crew structure faster than in Excel?

Can the selected team continue working here
instead of leaving FilmVerse immediately after hiring?

Would this still work with 100,000 users
and a 300-person production?

Is every permission enforced in the database,
not merely hidden in the UI?

Does every button actually perform the action it claims?

Can custom real-world production cases be entered
even when our preset dictionary does not contain them?

FilmVerse goal:

NUMBER ONE ASSISTANT
FOR THE FILM INDUSTRY
AND EVERY PARTICIPANT IN IT.

FIND PEOPLE.
FIND WORK.
BUILD THE TEAM.
CAST THE ACTORS.
COMMUNICATE.
RUN THE PRODUCTION.

Build toward that.
