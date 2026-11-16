# Сборка APK для RuStore

Игра — обычный сайт (`client/`) + сервер (`server/`). В APK упаковывается только клиент, он ходит на твой сервер по HTTPS.

## 1. Сервер

Нужен VPS с Node.js 22+ (например, Timeweb, Selectel, reg.ru):

```bash
git clone <репозиторий> crvs && cd crvs
npm install
PORT=3000 npm start          # для постоянной работы: pm2 start server/index.js --name crvs
```

Поставь перед ним nginx/caddy с HTTPS-сертификатом (Let's Encrypt). Для RuStore/Android нужен именно HTTPS — по http WebView по умолчанию не ходит. База лежит в `data/game.db` (SQLite), бэкап — просто копия файла.

## 2. Адрес сервера в клиенте

В `client/js/config.js` замени `https://YOUR-SERVER.example.com` на адрес своего сервера. В браузере с того же сервера адрес не нужен (пустая строка), а в APK используется этот.

## 3. Capacitor (WebView-обёртка)

Нужны: Node.js, JDK 17, Android Studio (с SDK 34+).

```bash
npm install @capacitor/core @capacitor/cli @capacitor/android
npx cap init "Crowns & Ruins" ru.yourname.crvs --web-dir client   # или используй готовый capacitor.config.json
npx cap add android
npx cap sync
```

`capacitor.config.json` в корне уже настроен: `webDir: client`, `androidScheme: https`. Поменяй `appId` на свой (обратный домен, уникальный в RuStore).

### Иконка и сплэш

Положи `icon.png` (1024×1024) и `splash.png` (2732×2732) в папку `resources/` и выполни:

```bash
npm install -D @capacitor/assets
npx capacitor-assets generate --android
```

### Сборка

```bash
npx cap open android      # откроется Android Studio
```

В Android Studio: **Build → Generate Signed Bundle / APK → APK**. Создай keystore (сохрани его и пароли — без них не обновить приложение!). Выбери `release`. Либо из консоли:

```bash
cd android && ./gradlew assembleRelease
# android/app/build/outputs/apk/release/app-release-unsigned.apk  → подписать apksigner
```

Для RuStore принимают APK и AAB. Минимальные требования: `targetSdk` 34+, подписанный release.

## 4. Публикация в RuStore

1. Зарегистрируй аккаунт разработчика на https://console.rustore.ru (физлицо — паспорт, ИП/юрлицо — ИНН).
2. «Приложения → Добавить» — название, категория «Игры / Стратегии», возраст 12+.
3. Загрузи APK/AAB, скриншоты (минимум 2, телефонные 9:16), иконку 512×512, описание.
4. Укажи ссылку на политику конфиденциальности (игра хранит логин и пароль — нужна страница, можно на GitHub Pages).
5. Отправь на модерацию (обычно 1–3 дня).

## 5. Обновления

Так как вся логика на сервере и в `client/`, большинство обновлений можно выкатывать на сервер без пересборки APK (WebView грузит... нет — клиент упакован в APK). Чтобы обновлять игру без пересборки, можно вместо `webDir` показывать сайт напрямую: в `capacitor.config.json` добавь

```json
"server": { "url": "https://game.example.com", "cleartext": false }
```

Тогда APK — это просто оболочка, а весь клиент грузится с сервера. Минус — без интернета не откроется (игре он и так нужен).
