const JSON_FMT = { format: 'json' };

// Decode base64 to bytes using globals available in both Node 18+ and browsers.
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

// Hikvision FDLib closes the TCP connection (no HTTP response) when a face image
// is too large in pixels/bytes, which surfaces as an opaque "fetch failed". To
// stay safely under that limit we downscale before upload. Resizing needs a
// canvas, which only exists in browsers; in Node we leave the bytes untouched
// (callers there are expected to pass a reasonably sized image).
const MAX_DIM = 1024; // longest edge, px
const MAX_BYTES = 150 * 1024; // target encoded size

function canResize() {
  return typeof createImageBitmap === 'function'
    && (typeof OffscreenCanvas !== 'undefined' || typeof document !== 'undefined');
}

async function downscaleJpeg(bytes, { maxDim = MAX_DIM, maxBytes = MAX_BYTES } = {}) {
  const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/jpeg' }));
  const { width, height } = bitmap;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  let canvas;
  if (typeof OffscreenCanvas !== 'undefined') {
    canvas = new OffscreenCanvas(w, h);
  } else {
    canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
  }
  canvas.getContext('2d').drawImage(bitmap, 0, 0, w, h);
  if (bitmap.close) bitmap.close();

  const toBlob = (q) => (canvas.convertToBlob
    ? canvas.convertToBlob({ type: 'image/jpeg', quality: q })
    : new Promise((res) => canvas.toBlob(res, 'image/jpeg', q)));

  let out = bytes;
  for (let q = 0.85; q >= 0.45; q -= 0.15) {
    const blob = await toBlob(q); // eslint-disable-line no-await-in-loop
    out = new Uint8Array(await blob.arrayBuffer()); // eslint-disable-line no-await-in-loop
    if (out.length <= maxBytes) break;
  }
  return out;
}

export class FaceService {
  constructor(http) { this.http = http; }

  async upload(employeeNo, imageBase64, faceLibId = '1', faceLibType = 'blackFD') {
    // FDSetUp adds a face via PUT multipart/form-data: a JSON "FaceDataRecord"
    // part plus the binary image as "img". (POST or base64-in-JSON are rejected
    // with "method and protocol do not match".)
    let bytes = base64ToBytes(imageBase64);
    if (bytes.length > MAX_BYTES && canResize()) {
      try { bytes = await downscaleJpeg(bytes); } catch { /* fall back to original */ }
    }
    const meta = JSON.stringify({ faceLibType, FDID: String(faceLibId), FPID: String(employeeNo) });
    const form = new FormData();
    form.append('FaceDataRecord', new Blob([meta], { type: 'application/json' }));
    form.append('img', new Blob([bytes], { type: 'image/jpeg' }), 'face.jpg');
    return this.http.request(
      'PUT',
      `/ISAPI/Intelligent/FDLib/FDSetUp?format=json&FDID=${faceLibId}&faceLibType=${faceLibType}`,
      { ...JSON_FMT, body: form },
    );
  }
  async search({ employeeNo, faceLibId = '1', faceLibType = 'blackFD', position = 0, maxResults = 30 } = {}) {
    // FDSearch wants a flat body (no FDSearchCond wrapper) and FPID as a plain
    // string; the wrapped/array forms are rejected 400 "node does not exist".
    const body = {
      searchID: String(Date.now()),
      searchResultPosition: position,
      maxResults,
      FDID: String(faceLibId),
      faceLibType,
      ...(employeeNo ? { FPID: String(employeeNo) } : {}),
    };
    const r = await this.http.request('POST', '/ISAPI/Intelligent/FDLib/FDSearch?format=json', { ...JSON_FMT, body });
    const list = r.MatchList;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo, faceLibId = '1') {
    const body = { FPID: [{ value: String(employeeNo) }] };
    return this.http.request('PUT', `/ISAPI/Intelligent/FDLib/FDSearch/Delete?format=json&FDID=${faceLibId}&faceLibType=blackFD`, { ...JSON_FMT, body });
  }
  async getFaceLibs() {
    const r = await this.http.request('GET', '/ISAPI/Intelligent/FDLib?format=json', JSON_FMT);
    const list = r.FDLibList && r.FDLibList.FDLib;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
}
