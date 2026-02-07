import { API_URL, SECRET } from "./config.js";

export { API_URL, SECRET };

export function jsonp(params = {}) {
  params.secret = SECRET;
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    params.callback = cb;
    const qs = Object.entries(params).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join("&");
    const s = document.createElement("script");
    s.src = API_URL + "?" + qs;
    window[cb] = (data) => { delete window[cb]; s.remove(); resolve(data); };
    s.onerror = () => { delete window[cb]; s.remove(); reject(new Error("JSONP_FAILED")); };
    document.head.appendChild(s);
  });
}

export async function createSession(pid, extraMeta = {}) {
  const out = await jsonp({ action: "createSession", secret: SECRET, pid, extraMeta_json: JSON.stringify(extraMeta) });
  if (!out.ok) throw new Error(out.error || "SESSION_FAILED");
  return out;
}

export async function uploadAudioBlob(blob, meta) {
  const reader = new FileReader();
  const base64 = await new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "uploadAudio", secret: SECRET, ...meta, base64, mimeType: blob.type })
    });
    if (!res.ok) throw new Error("UPLOAD_HTTP_ERROR");
    const json = await res.json();
    if (!json.ok) throw new Error(json.error || "UPLOAD_LOGIC_ERROR");
    return json;
  } catch (err) {
    console.error("Upload Error:", err);
    throw err; // 에러를 던져서 index.html의 실패 카운트를 올림
  }
}

export async function appendRow(row) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "appendRow", secret: SECRET, row })
    });
    if (!res.ok) throw new Error("ROW_HTTP_ERROR");
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "ROW_LOGIC_ERROR");
    return data;
  } catch (err) {
    console.error("Save Error:", err);
    throw err;
  }
}
