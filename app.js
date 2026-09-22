const CLIENT_ID = "9d9c85cb8a9d4134adc57e6975e90c1c";
const PRODUCTION_REDIRECT_URI = "https://extaz32.github.io/spotify-live-lyrics/";
const REDIRECT_URI = location.hostname === "extaz32.github.io"
  ? PRODUCTION_REDIRECT_URI
  : `${location.origin}${location.pathname}`;
const scope = "user-read-currently-playing user-read-playback-state";
const state = { token: sessionStorage.getItem("pulseAccessToken"), lyrics: [], elapsed: 0, duration: 0 };
const $ = selector => document.querySelector(selector);
const isLyricsPage = location.pathname.endsWith("lyrics.html");
const settings = JSON.parse(localStorage.getItem("pulseSettings") || "{}");

function setText(selector, text) { const element = $(selector); if (element) element.textContent = text; }
function formatTime(seconds) { return `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`; }
function setConnection(label, hint) { setText("#connectionLabel", label); setText("#connectionHint", hint); }
function renderLyrics() {
  const windowElement = $("#lyricsWindow"); if (!windowElement) return;
  windowElement.replaceChildren();
  if (!state.lyrics.length) {
    const empty = document.createElement("p"); empty.className = "lyrics-empty";
    empty.textContent = state.token ? "Текст появится после запуска трека" : "Сначала войди через Spotify";
    windowElement.append(empty); return;
  }
  state.lyrics.forEach(([, text]) => { const line = document.createElement("p"); line.className = "lyric-line"; line.textContent = text; windowElement.append(line); });
}
function renderProgress() {
  const lines = [...document.querySelectorAll(".lyric-line")];
  const active = state.lyrics.reduce((index, [time], indexValue) => state.elapsed >= time ? indexValue : index, -1);
  lines.forEach((line, indexValue) => { line.className = `lyric-line ${indexValue < active ? "passed" : ""} ${indexValue === active ? "active" : ""}`; });
  const progress = $("#progressBar"); if (progress) progress.style.width = state.duration ? `${Math.min(100, state.elapsed / state.duration * 100)}%` : "0%";
  const current = $("#currentTime"); if (current) current.textContent = formatTime(state.elapsed);
}
async function createChallenge() {
  const bytes = crypto.getRandomValues(new Uint8Array(48));
  const verifier = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = btoa(String.fromCharCode(...new Uint8Array(digest))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  sessionStorage.setItem("pulseVerifier", verifier); return challenge;
}
async function login() {
  const challenge = await createChallenge();
  const params = new URLSearchParams({ client_id: CLIENT_ID, response_type: "code", redirect_uri: REDIRECT_URI, code_challenge_method: "S256", code_challenge: challenge, scope });
  location.href = `https://accounts.spotify.com/authorize?${params}`;
}
async function exchangeCode(code) {
  const body = new URLSearchParams({ client_id: CLIENT_ID, grant_type: "authorization_code", code, redirect_uri: REDIRECT_URI, code_verifier: sessionStorage.getItem("pulseVerifier") });
  const response = await fetch("https://accounts.spotify.com/api/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body });
  if (!response.ok) {
    const details = await response.json().catch(() => ({}));
    throw new Error(details.error_description || details.error || "Spotify login could not be completed");
  }
  const token = await response.json(); sessionStorage.setItem("pulseAccessToken", token.access_token); sessionStorage.removeItem("pulseVerifier");
  return token.access_token;
}
async function loadLyrics(title, artist) {
  if (!settings.lyricsApi) return;
  const response = await fetch(`${settings.lyricsApi}?${new URLSearchParams({ title, artist })}`);
  if (!response.ok) throw new Error("Lyrics API request failed");
  const result = await response.json();
  if (!Array.isArray(result)) throw new Error("Lyrics API returned invalid data");
  state.lyrics = result.filter(line => Number.isFinite(line?.time) && typeof line?.text === "string").map(line => [line.time, line.text]);
  renderLyrics(); renderProgress();
}
async function refreshTrack() {
  if (!state.token) { setConnection("NOT CONNECTED", "Войди через Spotify, чтобы увидеть текущий трек"); return; }
  const response = await fetch("https://api.spotify.com/v1/me/player", { headers: { Authorization: `Bearer ${state.token}` } });
  if (response.status === 401) { disconnect(false); setConnection("SESSION EXPIRED", "Сессия Spotify закончилась. Войди снова на главной странице"); return; }
  if (response.status === 204) { setConnection("SPOTIFY CONNECTED", "Открой Spotify и запусти трек"); return; }
  if (!response.ok) throw new Error("Spotify player request failed");
  const data = await response.json();
  if (!data.item) { setConnection("SPOTIFY CONNECTED", "Открой Spotify и запусти трек"); return; }
  setConnection("SPOTIFY CONNECTED", "Трек синхронизирован с Spotify");
  setText("#trackTitle", data.item.name); setText("#trackArtist", data.item.artists.map(artist => artist.name).join(", "));
  state.elapsed = Math.floor((data.progress_ms || 0) / 1000); state.duration = Math.floor(data.item.duration_ms / 1000);
  setText("#totalTime", formatTime(state.duration)); renderProgress();
  await loadLyrics(data.item.name, data.item.artists[0]?.name).catch(error => { setConnection("SPOTIFY CONNECTED", "Трек найден, но текст пока недоступен"); console.error(error); });
}
function disconnect(redirect = true) {
  sessionStorage.removeItem("pulseAccessToken");
  sessionStorage.removeItem("pulseVerifier");
  localStorage.removeItem("pulseAccessToken");
  state.token = null;
  if (isLyricsPage && redirect) {
    location.replace(new URL("index.html?logged_out=1", location.href).href);
    return;
  }
  setConnection("NOT CONNECTED", "Войди через Spotify, чтобы начать");
  setText("#connectButton", "♫ Войти через Spotify");
}
function wireCommonControls() {
  $("#fullscreenButton")?.addEventListener("click", () => document.documentElement.requestFullscreen?.());
  $("#refreshButton")?.addEventListener("click", () => refreshTrack().catch(console.error));
  document.querySelectorAll("[data-disconnect]").forEach(button => button.addEventListener("click", () => disconnect()));
  $("#settingsButton")?.addEventListener("click", () => $("#settingsDialog")?.showModal());
  $("#closeSettings")?.addEventListener("click", () => $("#settingsDialog")?.close());
  $("#saveSettings")?.addEventListener("click", () => { localStorage.setItem("pulseSettings", JSON.stringify({ lyricsApi: $("#lyricsApi").value.trim() })); $("#settingsDialog").close(); refreshTrack().catch(console.error); });
  document.querySelectorAll("[data-mode]").forEach(button => button.addEventListener("click", () => { document.querySelectorAll("[data-mode]").forEach(item => item.classList.remove("active")); button.classList.add("active"); $("#lyricsWindow").style.overflowY = button.dataset.mode === "scroll" ? "auto" : "hidden"; }));
}

wireCommonControls();
if (!isLyricsPage) {
  $("#connectButton")?.addEventListener("click", async () => { $("#connectButton").disabled = true; $("#connectButton").innerHTML = "<span>↗</span> Открываем Spotify…"; await login(); });
  const params = new URLSearchParams(location.search);
  if (params.get("error")) { setConnection("LOGIN CANCELED", "Доступ не предоставлен. Попробуй ещё раз"); }
  if (params.get("code")) exchangeCode(params.get("code")).then(() => { location.replace("lyrics.html"); }).catch(error => { setConnection("LOGIN ERROR", `Spotify отклонил вход: ${error.message}`); console.error(error); });
} else {
  renderLyrics(); if (!state.token) { setConnection("NOT CONNECTED", "Вернись на главную и войди через Spotify"); } else refreshTrack().catch(() => setConnection("SPOTIFY ERROR", "Не удалось получить текущий трек"));
  setInterval(() => refreshTrack().catch(console.error), 10000);
}
