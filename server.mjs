import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL(".", import.meta.url));
const port = Number(process.env.PORT || 8080);
const allowedOrigin = process.env.ALLOWED_ORIGIN || `http://localhost:${port}`;
const model = process.env.GEMINI_MODEL || "gemini-2.0-flash";
const requests = new Map();
const staticTypes = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8" };

function send(response, status, body, type = "application/json; charset=utf-8") {
  response.writeHead(status, { "Content-Type": type, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'self'; connect-src 'self' https://api.spotify.com https://accounts.spotify.com https://lrclib.net; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com", "Referrer-Policy": "no-referrer", "Access-Control-Allow-Origin": allowedOrigin, "Vary": "Origin" });
  response.end(typeof body === "string" ? body : JSON.stringify(body));
}

function validRequest(ip) {
  const now = Date.now();
  const recent = (requests.get(ip) || []).filter(time => now - time < 60_000);
  if (recent.length >= 20) return false;
  recent.push(now); requests.set(ip, recent); return true;
}

async function lyrics(request, response, url) {
  if (request.method !== "GET") return send(response, 405, { error: "Method not allowed" });
  if (!process.env.GEMINI_API_KEY) return send(response, 503, { error: "Lyrics service is not configured" });
  if (!validRequest(request.socket.remoteAddress || "unknown")) return send(response, 429, { error: "Too many requests" });
  const title = url.searchParams.get("title")?.trim();
  const artist = url.searchParams.get("artist")?.trim();
  if (!title || !artist || title.length > 200 || artist.length > 200) return send(response, 400, { error: "Valid title and artist are required" });
  const prompt = `Return only a JSON array of timestamped lyric lines for the song "${title}" by "${artist}". Each item must be {"time": number, "text": string}. Do not include markdown or commentary. If synchronized lyrics cannot be verified, return [].`;
  const upstream = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }), signal: AbortSignal.timeout(15_000) });
  if (!upstream.ok) return send(response, 502, { error: "Lyrics provider unavailable" });
  const data = await upstream.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "[]";
  try {
    const parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, ""));
    if (!Array.isArray(parsed)) throw new Error("Invalid lyrics shape");
    return send(response, 200, parsed.filter(line => Number.isFinite(line?.time) && typeof line?.text === "string").slice(0, 500));
  } catch { return send(response, 502, { error: "Lyrics provider returned invalid data" }); }
}

const server = createServer(async (request, response) => {
  try {
    const url = new URL(request.url || "/", `http://${request.headers.host}`);
    if (url.pathname === "/api/lyrics") return await lyrics(request, response, url);
    if (request.method !== "GET") return send(response, 405, { error: "Method not allowed" });
    const relative = url.pathname === "/" ? "/index.html" : url.pathname;
    const file = normalize(join(root, relative));
    if (!file.startsWith(root)) return send(response, 403, { error: "Forbidden" });
    const content = await readFile(file);
    return send(response, 200, content, staticTypes[extname(file)] || "application/octet-stream");
  } catch { return send(response, 404, { error: "Not found" }); }
});
server.listen(port, () => console.log(`Pulse running at http://localhost:${port}`));
