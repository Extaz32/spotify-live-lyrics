# Pulse — Spotify Live Lyrics

MVP live-караоке для Spotify: получает текущий трек, показывает таймкодированный
текст и подсвечивает строку в ритме. Есть demo-режим без ключей, режимы Karaoke
и Scroll, fullscreen и форма настройки Lyrics API.

## Запуск

Открой `index.html` или подними статический сервер:

```powershell
python -m http.server 8080
```

Затем открой `http://localhost:8080`.

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
