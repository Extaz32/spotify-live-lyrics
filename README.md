# Pulse — Spotify Live Lyrics

MVP live-караоке для Spotify: получает текущий трек, показывает таймкодированный
текст и подсвечивает строку в ритме. Есть demo-режим без ключей, режимы Karaoke
и Scroll, fullscreen и форма настройки Lyrics API.

Безопасность: Spotify OAuth используется с PKCE, access token хранится только в
`sessionStorage` текущей вкладки и удаляется кнопкой «Отключить Spotify». Ни
Spotify Client Secret, ни Gemini API key не нужны во фронтенде и не должны
попадать в GitHub Pages.

## Запуск

Для локального запуска подними встроенный Node-сервер:

```powershell
Copy-Item .env.example .env
# Заполни GEMINI_API_KEY в .env локально, но не добавляй .env в Git
npm start
```

Затем открой `http://localhost:8080`. Сервер отдаёт `/api/lyrics` и сам
проксирует запрос к Gemini, поэтому ключ не попадает в браузер.
В настройках Pulse укажи `http://localhost:8080/api/lyrics` как Lyrics API URL.

Пользовательский сценарий: открой сайт, нажми «Войти через Spotify», подтверди
доступ на официальной странице Spotify и вернись в Pulse. После входа приложение
перенаправит на отдельную страницу `lyrics.html`, подхватит текущий трек и
запросит текст. На Spotify-аккаунте должно быть активное воспроизведение.

## Spotify и Lyrics API

Кнопка «Подключить Spotify» сразу отправляет пользователя на официальный экран
входа Spotify. Client ID встроен в публичный frontend — это нормально: Client ID
не является секретом. Приложение использует Authorization Code with PKCE и scope
`user-read-currently-playing user-read-playback-state`, поэтому Spotify Client
Secret не хранится в браузере. В Spotify Dashboard добавь оба redirect URI:

```text
http://localhost:8080/
https://extaz32.github.io/spotify-live-lyrics/
```

Важно: redirect URI должен совпадать с адресом в Dashboard символ в символ.
Если после входа появляется `Redirect URI mismatch`, открой Spotify Developer
Dashboard → приложение → Settings → Redirect URIs, добавь production-адрес
выше, нажми Save и только потом повтори вход. Старый Client Secret для этого
потока не нужен.

OAuth использует PKCE с verifier длиной 64 символа; Client Secret намеренно не
используется в браузере.

Lyrics API задаётся URL и вызывается как `GET /?title=...&artist=...`. Ответ:

```json
[
  { "time": 42, "text": "Midnight city" }
]
```

## Секреты

Считай ключи, отправленные в чат, скомпрометированными: отзови их и создай новые.
Храни новые значения только в переменных окружения или в secrets менеджере
деплой-провайдера. `.env` защищён `.gitignore`; `.env.example` содержит только
названия переменных.
