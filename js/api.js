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
  console.log("📤 uploadAudioBlob called:", {
    blobSize: blob?.size,
    blobType: blob?.type,
    meta: meta
  });

  const base64 = await blobToBase64(blob);
  console.log("📤 Base64 encoded, length:", base64.length);

  const payload = {
    action: "uploadAudio",
    secret: SECRET,
    pid: meta.pid,
    sessionId: meta.sessionId,
    folderId: meta.folderId,
    filename: meta.filename,
    mimeType: blob.type || "audio/webm",
    base64,
    // ✅ 추가 메타데이터
    type: meta.type,           // "prime" or "target"
    trialId: meta.trialId,     // trial ID
    phase: meta.phase          // "priming"
  };

  console.log("📤 Sending POST to API_URL with payload keys:", Object.keys(payload));

  const res = await fetch(API_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  console.log("📥 Response status:", res.status);

  if (!res.ok) {
    const text = await res.text();
    console.error("❌ Response not OK:", text);
    throw new Error(`HTTP ${res.status}: ${text}`);
  }

  const json = await res.json();
  console.log("📥 Response JSON:", json);

  if (!json.ok) {
    console.error("❌ Upload failed:", json.error);
    throw new Error(json.error || "uploadAudio failed");
  }

  console.log("✅ Upload successful:", json);
  return json;
}
