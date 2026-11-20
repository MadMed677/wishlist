# Вишлист

Вишлист ко дню рождения для друзей: автор добавляет желания, гости бронируют подарки в realtime.
Автор видит только «Занято», гости — кто что дарит. Гости могут добавить «Я дарю другое» — автор этого не видит.

**Сайт:** https://madmed677.github.io/wishlist/

Стек: React + Vite + TypeScript, Firebase (Firestore + Auth) на бесплатном тарифе Spark, хостинг GitHub Pages.
Спецификация, модель данных и правила — в [CLAUDE.md](CLAUDE.md).

## Как это работает

1. Автор открывает сайт, входит через Google и создаёт вишлист. Можно сразу написать «Пожелания» — что в целом нравится и чего не дарить (гости увидят это над списком).
2. Кнопкой «Поделиться» / «Скопировать ссылку» отправляет ссылку друзьям.
3. Друг открывает ссылку, вводит имя (регистрация не нужна) и жмёт «Буду дарить это».

## Настройка Firebase (один раз, можно с телефона)

Firebase-проект `wishlist-24cee` уже создан, его конфиг лежит в `src/firebase.ts`.
Если нужно настроить всё заново (новый проект):

### 1. Проект и веб-приложение
1. Открой https://console.firebase.google.com → «Создать проект» → имя `wishlist`. Google Analytics не нужен. Тариф по умолчанию — бесплатный Spark, ничего не меняй.
2. На главной проекта нажми значок `</>` (Web) → имя `wishlist-web` → галочку Firebase Hosting **не** ставь → Register app.
3. Скопируй объект `firebaseConfig` и вставь его в `src/firebase.ts` (или пришли Claude в чат — он вставит).
   Ключи публичные, хранить их в репозитории нормально: данные защищает `firestore.rules`.

### 2. Вход (Authentication)
Прямая ссылка: `https://console.firebase.google.com/project/<ID-проекта>/authentication/providers`
(для текущего проекта — https://console.firebase.google.com/project/wishlist-24cee/authentication/providers).

На телефоне меню консоли спрятано под ☰ слева вверху; Authentication может лежать в группе «Build» или «Security».

1. Если видишь «Get started» — нажми.
2. Вкладка **Sign-in method**:
   - **Google** → Enable → выбери свою почту как support email → Save.
   - **Anonymous** → Enable → Save.
3. Вкладка **Settings** → **Authorized domains** → Add domain → `madmed677.github.io`.

### 3. База данных (Firestore)
Прямая ссылка: https://console.firebase.google.com/project/wishlist-24cee/firestore

1. Create database → регион поближе к друзьям (например `europe-west`; поменять потом нельзя) → **Production mode** → Create.

### 4. Правила доступа
1. Открой файл [`firestore.rules`](firestore.rules) в репозитории → кнопка «Raw» → выдели всё и скопируй.
2. Firestore Database → вкладка **Rules** → удали всё, что там есть, вставь скопированное → **Publish**.

После изменения `firestore.rules` в репозитории этот шаг нужно повторить.
С компьютера можно и так: `npx firebase-tools deploy --only firestore:rules --project wishlist-24cee`.

## Деплой

Каждый пуш в `main` собирает сайт и выкладывает его на GitHub Pages (`.github/workflows/deploy.yml`).
Статус — во вкладке **Actions** репозитория. В настройках репозитория Pages → Source должен быть «GitHub Actions».

## Дизайн

- Дизайн-система (цвета, шрифт Manrope, отступы, светлая и тёмная темы): https://claude.ai/artifact/QfvPkkecFeLMovM4ntmjA5
- Экраны и переходы (телефон и компьютер): https://claude.ai/artifact/LNycnQHYLxqqZgGDrYCQDW
- В коде токены лежат в `src/styles/tokens.css`, исходные значения — `design/tokens.json`.
  Все стили (`src/styles/app.css`) используют только токены — меняешь цвет в одном месте, меняется везде.

## Локальная разработка

```bash
npm install
npm run dev          # http://localhost:5173/wishlist/ — с настоящим Firebase
```

Без настоящего Firebase, на локальных эмуляторах (нужна Java):

```bash
npm run emulators       # в одном терминале: Auth + Firestore с правилами из firestore.rules
npm run dev:emulators   # в другом
```
