# Pulse — Spotify Live Lyrics

MVP live-караоке для Spotify: получает текущий трек, показывает таймкодированный
текст и подсвечивает строку в ритме. Есть demo-режим без ключей, режимы Karaoke
и Scroll, fullscreen и форма настройки Lyrics API.

Безопасность: Spotify OAuth используется с PKCE, access token хранится только в
`sessionStorage` текущей вкладки и удаляется кнопкой «Отключить Spotify». Ни
Spotify Client Secret, ни Gemini API key не нужны во фронтенде и не должны
попадать в GitHub Pages.

## Запуск

Для демо открой `index.html` или подними статический сервер. Для Gemini Lyrics
API используй встроенный Node-сервер:

```powershell
Copy-Item .env.example .env
# Заполни GEMINI_API_KEY в .env локально, но не добавляй .env в Git
npm start
```

Затем открой `http://localhost:8080`. Сервер отдаёт `/api/lyrics` и сам
проксирует запрос к Gemini, поэтому ключ не попадает в браузер.
В настройках Pulse укажи `http://localhost:8080/api/lyrics` как Lyrics API URL.

## Spotify и Lyrics API

В настройках укажи Spotify Client ID. Приложение использует Authorization Code
with PKCE и scope `user-read-currently-playing user-read-playback-state`, поэтому
секрет Spotify не хранится в браузере. В Spotify Dashboard добавь redirect URI
`http://localhost:8080/`.

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
