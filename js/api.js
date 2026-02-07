import { API_URL, SECRET } from "./config.js";

export { API_URL, SECRET };

/** * JSONP: createSession, appendContact 등 GET 방식 요청용 
 */
export function jsonp(params = {}) {
  params.secret = SECRET;
  return new Promise((resolve, reject) => {
    const cb = "cb_" + Math.random().toString(36).slice(2);
    params.callback = cb;

    const qs = Object.entries(params)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

    const s = document.createElement("script");
    s.src = API_URL + "?" + qs;

    window[cb] = (data) => { 
      delete window[cb]; 
      s.remove(); 
      resolve(data); 
    };
    
    s.onerror = () => { 
      delete window[cb]; 
      s.remove(); 
      reject(new Error("JSONP_LOAD_FAILED")); 
    };

    document.head.appendChild(s);
  });
}

/** * createSession: 실험 시작 시 세션 폴더 생성 
 */
export async function createSession(pid, extraMeta = {}) {
  const out = await jsonp({
    action: "createSession",
    secret: SECRET,
    pid,
    extraMeta_json: JSON.stringify(extraMeta)
  });
  if (!out.ok) throw new Error(out.error || "CREATE_SESSION_FAILED");
  return out;
}

/** * appendRow: 각 Trial 결과를 구글 시트에 저장 (POST 방식) 
 */
export async function appendRow(row) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action: "appendRow", secret: SECRET, row })
    });

    if (!res.ok) throw new Error("APPEND_ROW_HTTP_ERROR");

    const data = await res.json();
    if (!data.ok) throw new Error(data.error || "APPEND_ROW_LOGIC_ERROR");
    return data;
  } catch (err) {
    console.error("❌ Row data save failed:", err);
    throw err; // index.html에서 감지할 수 있도록 재투척
  }
}

/** * Blob 데이터를 Base64로 변환 
 */
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

/** * uploadAudioBlob: 음성 녹음 파일을 구글 드라이브로 업로드 
 * 실패 시 throw를 통해 index.html의 uploadFailCount를 증가시킴
 */
export async function uploadAudioBlob(blob, meta) {
  console.log("📤 Uploading audio for trial:", meta.trialId);

  const base64 = await blobToBase64(blob);

  const payload = {
    action: "uploadAudio",
    secret: SECRET,
    pid: meta.pid,
    sessionId: meta.sessionId,
    folderId: meta.folderId,
    filename: meta.filename,
    mimeType: blob.type || "audio/webm",
    base64,
    type: meta.type,           // "prime" or "target"
    trialId: meta.trialId,     
    phase: meta.phase          
  };

  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP_${res.status}_ERROR`);
    }

    const json = await res.json();
    if (!json.ok) {
      throw new Error(json.error || "UPLOAD_LOGIC_ERROR");
    }

    console.log("✅ Upload successful:", meta.filename);
    return json;
  } catch (error) {
    console.error("❌ Audio upload failed:", error.message);
    // 이 throw가 있어야 index.html의 .catch() 섹션이 실행되어 실패 카운트가 올라갑니다.
    throw error; 
  }
}
