# Wishlist — pet project для друзей

Страница вишлиста ко дню рождения (и для других людей). Бесплатный стек, без своего сервера.
Владелец управляет проектом в основном с телефона через Claude Code Cloud, поэтому:
- держи README и этот файл актуальными;
- каждая задача заканчивается рабочим деплоем на GitHub Pages.

## Стек

- React + Vite + TypeScript, SPA с hash-роутингом (`#/list/:id`) — GitHub Pages не умеет SPA-fallback.
- Firebase: Firestore (данные + realtime через `onSnapshot`), Auth (Google для авторов, Anonymous для гостей).
- Хостинг: GitHub Pages, деплой GitHub Actions из `main` (`.github/workflows/deploy.yml`, `base` в Vite = `/wishlist/`).
- Конфиг Firebase лежит в коде (`src/firebase.ts`) — это публичные ключи, защита только через `firestore.rules`.
- Тариф Firebase Spark (бесплатный). Ничего, что требует Blaze/Cloud Functions.

## Сценарий

1. **Автор** входит через Google, создаёт вишлист (название, дата события), добавляет пункты.
2. Автор делится ссылкой `https://madmed677.github.io/wishlist/#/list/<id>`.
3. **Гость** открывает ссылку, вводит только имя (сохраняется в localStorage), вход анонимный и незаметный.
4. Гость жмёт «Буду дарить это» → пункт помечается «Забронировано».
   - Другие гости видят, **кто** забронировал.
   - Автор видит только «Занято», без имени.
   - Снять бронь может только тот, кто её поставил.
5. Гость может добавить **свой подарок** («Я дарю другое»): автор его не видит вообще, остальные гости видят, чтобы не купить то же самое.
6. Всё в realtime: брони и новые пункты появляются у всех открытых вкладок сразу.

## Пункт вишлиста

Название (обязательно), описание/комментарий, ссылка на товар (опционально), картинка (URL, опционально), примерная цена, приоритет (очень хочу / хочу / было бы неплохо).

## Модель данных (Firestore)

```
wishlists/{listId}                     { ownerUid, ownerName, title, eventDate, createdAt }
  items/{itemId}                       { title, description, url, imageUrl, price, priority, createdAt }
  reservations/{itemId}                { uid, createdAt }            ← видят все, включая автора («Занято»)
  reservationDetails/{itemId}          { uid, guestName }            ← автор НЕ видит
  guestGifts/{giftId}                  { uid, guestName, title, description, url, price, createdAt }  ← автор НЕ видит
```

- `reservations` и `reservationDetails` создаются/удаляются одним batch-ом.
- Документ брони имеет ID пункта: правило разрешает только `create` (не `update`), поэтому двойная бронь невозможна — второй получит ошибку.
- Удаление автором пункта удаляет и бронь (batch на клиенте; правила разрешают владельцу delete брони, но не read деталей).

## Правила безопасности (`firestore.rules`) — главное

- `wishlists`, `items`: читают все авторизованные (в т.ч. анонимные), пишет только `ownerUid`.
- `reservations`: читают все; `create` — если `request.resource.data.uid == request.auth.uid` и пользователь не владелец; `delete` — сам бронировавший или владелец.
- `reservationDetails`, `guestGifts`: read — только если `request.auth.uid != ownerUid` списка; write — только свои документы (uid == auth.uid), не владелец.
- Известное ограничение: автор в инкогнито = гость. Это принимаем.

## Настройка, которую делает человек (не код)

1. Создать проект в https://console.firebase.google.com (Spark), добавить Web App, вставить конфиг в `src/firebase.ts`.
2. Включить Authentication → Google и Anonymous; добавить `madmed677.github.io` в Authorized domains.
3. Создать Firestore database, задеплоить `firestore.rules` (через консоль — скопировать файл, или `firebase deploy --only firestore:rules`).
4. GitHub Pages уже включён с источником «GitHub Actions».

## UI

- Мобильный в первую очередь (друзья откроют ссылку с телефона), светлая/тёмная тема.
- Язык интерфейса — русский.
