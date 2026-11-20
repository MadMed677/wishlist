# Вишлист

Вишлист ко дню рождения для друзей: автор добавляет желания, гости бронируют подарки в realtime.
Автор видит только «Занято», гости — кто что дарит. Гости могут добавить «Я дарю другое» — автор этого не видит.

**Сайт:** https://madmed677.github.io/wishlist/

Стек: React + Vite + TypeScript, Firebase (Firestore + Auth) на бесплатном тарифе Spark, хостинг GitHub Pages.
Спецификация, модель данных и правила — в [CLAUDE.md](CLAUDE.md).

## Как это работает

1. Автор открывает сайт, входит через Google и создаёт вишлист. Можно сразу написать «Пожелания» — что в целом нравится и чего не дарить (гости увидят это над списком).
2. Кнопкой «Поделиться» / «Скопировать ссылку» отправляет ссылку друзьям.
3. Друг открывает ссылку, вводит имя (регистрация не нужна) и жмёт «Буду дарить это» — или «Подарим вместе», чтобы скинуться на дорогой подарок с другими гостями.
4. Гостю предлагают войти через Google — тогда брони не потеряются при смене телефона или очистке браузера. Всё, что гость успел сделать до входа, переносится в его Google-аккаунт.

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
4. **Вход с телефона.** На телефонах сайт входит через окно Google Identity Services (окно Firebase на iPhone
   закрывается, не вернув результат). Для этого Google должен знать адрес сайта:
   https://console.cloud.google.com/apis/credentials?project=wishlist-24cee → OAuth-клиент
   **Web client (auto created by Google Service)** → **Authorized JavaScript origins** → **Add URI** →
   `https://madmed677.github.io` → **Save**. Начинает работать через 5 минут – пару часов.
   Client ID этого клиента прописан в `src/account.ts` (`GOOGLE_CLIENT_ID`).

### 3. База данных (Firestore)
Прямая ссылка: https://console.firebase.google.com/project/wishlist-24cee/firestore

1. Create database → регион поближе к друзьям (например `europe-west`; поменять потом нельзя) → **Production mode** → Create.

### 4. Правила доступа — автопубликация (один раз настроить)

Правила из `firestore.rules` публикуются сами через GitHub Actions (`.github/workflows/firestore-rules.yml`)
при каждом их изменении в `main`: сначала проверяются тестами на эмуляторе, потом выкладываются в Firebase.
Для этого GitHub нужен ключ доступа к проекту. Проще сделать с компьютера:

1. Открой https://console.firebase.google.com/project/wishlist-24cee/settings/serviceaccounts/adminsdk
   → **Generate new private key** → **Generate key**. Скачается файл `.json`.
2. Открой https://github.com/MadMed677/wishlist/settings/secrets/actions → **New repository secret**:
   - Name: `FIREBASE_SERVICE_ACCOUNT`
   - Secret: открой скачанный файл как текст, скопируй **всё** содержимое и вставь
   - **Add secret**
3. Удали скачанный файл с компьютера — он больше не нужен (ключ хранится только в секретах GitHub).
4. Запусти публикацию один раз вручную: https://github.com/MadMed677/wishlist/actions/workflows/firestore-rules.yml
   → **Run workflow** → **Run workflow**. Через минуту там должна появиться зелёная галочка.

Дальше ничего делать не нужно. Если ключ когда-нибудь утечёт — удали его в Google Cloud
(IAM → Service accounts → firebase-adminsdk → Keys) и создай новый.

**Вручную (если ключ не настроен):** открой [`firestore.rules`](firestore.rules) → «Raw» → скопируй всё →
Firestore Database → вкладка **Rules** → вставь → **Publish**.

Проверить правила локально (нужна Java): `npm run test:rules`.

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
