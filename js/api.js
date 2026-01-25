import { API_URL, SECRET } from "./config.js";

export { API_URL, SECRET }; // 필요하면 재-export


/** JSONP: createSession / ping 같은 짧은 요청용 */
export function jsonp(params={}) {
  params.secret = SECRET;
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    params.callback = cb;

    const qs = Object.entries(params)
      .map(([k,v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const s = document.createElement("script");
    s.src = API_URL + "?" + qs;

    window[cb] = (data) => { delete window[cb]; s.remove(); resolve(data); };
    s.onerror = () => { delete window[cb]; s.remove(); reject(new Error("JSONP load failed")); };

    document.head.appendChild(s);
  });
}

export async function createSession(pid, extraMeta={}) {
  const out = await jsonp({
    action: "createSession",
    secret: SECRET,
    pid,
    extraMeta_json: JSON.stringify(extraMeta)
  });
  if (!out.ok) throw new Error(out.error || "createSession failed");
  return out;
}

/** POST(text/plain): trial마다 row 저장용(길이 제한/인코딩 문제 회피) */
export async function appendRow(row) {
  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action:"appendRow", secret: SECRET, row })
  });

  const data = await res.json();
  if (!data.ok) throw new Error(data.error || "appendRow failed");
  return data;
}

// api.js
export async function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export async function uploadAudioBlob(blob, meta) {
  const base64 = await blobToBase64(blob);

  const payload = {
    action: "uploadAudio",
    secret: SECRET,
    pid: meta.pid,
    sessionId: meta.sessionId,
    folderId: meta.folderId,           // ★ session.folderId 직접 참조 말고 meta로
    filename: meta.filename,
    mimeType: blob.type || "audio/webm",
    base64
  };

  console.log("upload payload", {
    pid: payload.pid, sessionId: payload.sessionId, folderId: payload.folderId,
    filename: payload.filename, mimeType: payload.mimeType, b64len: base64.length
  });

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type":"application/json" },
    body: JSON.stringify(payload)
  });

  console.log("upload status", res.status);

  const json = await res.json();
  console.log("upload resp", json);

  if (!json.ok) throw new Error(json.error || "uploadAudio failed");
  return json;
}

