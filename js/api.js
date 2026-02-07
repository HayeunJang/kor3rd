import { API_URL, SECRET } from "./config.js";

export { API_URL, SECRET };

/** * JSONP: createSession, appendContact 등 짧은 GET 요청용 
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
      // 에러를 던져서 상위 catch 문에서 잡히도록 함
      reject(new Error("JSONP_LOAD_FAILED")); 
    };

    document.head.appendChild(s);
  });
}

/** * createSession: 세션 초기화 및 폴더 생성 
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

/** * uploadAudioBlob: 녹음 파일을 서버로 전송
 * 에러 발생 시 throw를 수행하여 index.html의 실패 카운트를 올림
 */
export async function uploadAudioBlob(blob, meta) {
  // Blob을 Base64로 변환
  const reader = new FileReader();
  const base64Promise = new Promise((resolve, reject) => {
    reader.onloadend = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });

  const base64 = await base64Promise;

  const payload = {
    action: "uploadAudio",
    secret: SECRET,
    pid: meta.pid,
    sessionId: meta.sessionId,
    folderId: meta.folderId,
    filename: meta.filename,
    mimeType: blob.type || "audio/webm",
    base64,
    type: meta.type,
    trialId: meta.trialId,
    phase: meta.phase
  };

  // fetch를 통한 POST 전송
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      throw new Error(`SERVER_HTTP_ERROR_${res.status}`);
    }

    const json = await res.json();
    if (!json.ok) {
      // 서버 응답이 ok가 아닐 경우 에러 투척
      throw new Error(json.error || "SERVER_LOGIC_ERROR");
    }

    console.log("✅ Upload Success:", meta.filename);
    return json;
  } catch (err) {
    console.error("❌ Audio Upload Failed:", err.message);
    // 중요: 여기서 에러를 다시 던져야 index.html의 .catch()가 작동함
    throw err; 
  }
}

/** * appendRow: 실험 데이터를 구글 시트에 기록 
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
    console.error("❌ Data save failed:", err);
    throw err; 
  }
}
