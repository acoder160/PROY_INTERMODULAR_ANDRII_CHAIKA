# Вход через Google: настройка

Используется **один OAuth-клиент Google — Web application** — для сайта и для мобильного приложения.
Android- и iOS-клиенты, SHA-1 и нативный SDK не нужны.

- **Сайт**: кнопка Google Identity Services получает ID token → `POST /api/auth/google`.
- **Мобильное приложение** (Expo Go и любая сборка): вход через системный браузер.
  Приложение → `/api/auth/google/start` на бэкенде → страница Google → `/api/auth/google/callback` на бэкенде →
  обратно в приложение с одноразовым кодом (живёт 60 с, защищён PKCE) → `POST /api/auth/google/exchange` → обычная сессия.

Пока ключей нет, кнопки скрыты, а эндпоинты отвечают `503 not configured`. Ничего не ломается.

## 1. Google Cloud Console

Всё делается на https://console.cloud.google.com.

1. Создайте проект (например, `SpotCheck`) или выберите существующий.
2. **APIs & Services → OAuth consent screen** (в новом интерфейсе: **Google Auth Platform → Branding / Audience**):
   - User type: **External**; App name `SpotCheck`, support email, developer contact email.
   - Scopes: `openid`, `email`, `profile` (базовые, проверка Google не нужна).
   - В режиме **Testing** войти могут только адреса из **Test users**: добавьте свой Gmail. Для всех — **Publish app**.
3. **Credentials → Create credentials → OAuth client ID → Web application**:
   - **Authorized JavaScript origins** (для кнопки на сайте): `http://localhost:5173` и адрес продакшн-сайта.
   - **Authorized redirect URIs** (для мобильного входа): `https://<публичный адрес бэкенда>/api/auth/google/callback`.
     Google принимает только **https** или `http://localhost`, поэтому адрес вида `http://192.168.x.x` не подойдёт.
     - Локально: https-туннель, например `ngrok http 8080` → `https://xxxx.ngrok-free.app/api/auth/google/callback`.
       На бесплатном ngrok адрес меняется при каждом запуске, и его нужно добавлять заново.
     - Продакшн: адрес сервера (Oracle Cloud), например `https://api.<домен>/api/auth/google/callback`.
4. Скопируйте **Client ID** и **Client secret** этого клиента.

Если раньше создавались Android- или iOS-клиенты, их можно удалить.

## 2. Куда вставить

Все файлы `.env` уже в `.gitignore`.

**Бэкенд**, `spotcheck/.env` (и переменные окружения на сервере):
```
GOOGLE_CLIENT_IDS=<WEB_CLIENT_ID>
GOOGLE_CLIENT_SECRET=<секрет WEB-клиента>
GOOGLE_REDIRECT_URI=https://xxxx.ngrok-free.app/api/auth/google/callback
GOOGLE_ALLOW_EXPO_GO=true
```
- `GOOGLE_CLIENT_SECRET` — **секрет**: только в `.env` бэкенда и на сервере, никогда в коде, на сайте или в приложении.
- `GOOGLE_REDIRECT_URI` должен совпадать с адресом в Google Console символ в символ.
- `GOOGLE_ALLOW_EXPO_GO=true` разрешает возврат в `exp://` (Expo Go). Ставьте его **только локально**, в продакшне — `false`:
  адрес `exp://` может открыть любой проект в Expo Go. Ссылка `spotcheckmobile://` вашей сборки разрешена всегда.

**Сайт**, `spotcheck-web/.env`:
```
VITE_GOOGLE_CLIENT_ID=<WEB_CLIENT_ID>
```

**Мобильное приложение**, `spotcheck-mobile/.env` (значение только включает кнопку; сам вход настраивается на бэкенде):
```
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=<WEB_CLIENT_ID>
```

## 3. Локальная проверка мобильного входа

1. Запустите бэкенд: `.\mvnw.cmd spring-boot:run` (в папке `spotcheck`).
2. В другом терминале: `ngrok http 8080`. Адрес `https://….ngrok-free.app` подставьте в `GOOGLE_REDIRECT_URI`
   и в **Authorized redirect URIs**, затем перезапустите бэкенд.
3. `EXPO_PUBLIC_API_URL` в приложении можно оставить локальным (`http://192.168.1.33:8080`):
   через туннель идёт только возврат от Google, и он попадает в тот же процесс бэкенда.
4. `npx expo start`, откройте в Expo Go и нажмите «Войти через Google».

## Как бэкенд принимает вход

1. Проверяет подпись ID token, срок действия, что он выдан для одного из `GOOGLE_CLIENT_IDS` и что email подтверждён.
2. Если пользователь с таким email есть, входит в его аккаунт. Если нет, создаёт новый: имя берётся из Google, пароль генерируется случайно.
3. Ответ такой же, как у `/api/auth/login`: JWT и refresh-токен (на сайте — в cookie, в приложении — в теле ответа).
