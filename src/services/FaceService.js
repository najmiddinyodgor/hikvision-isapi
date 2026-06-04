const JSON_FMT = { format: 'json' };

// Decode base64 to bytes using globals available in both Node 18+ and browsers.
function base64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

export class FaceService {
  constructor(http) { this.http = http; }

  async upload(employeeNo, imageBase64, faceLibId = '1', faceLibType = 'blackFD') {
    // FDSetUp adds a face via PUT multipart/form-data: a JSON "FaceDataRecord"
    // part plus the binary image as "img". (POST or base64-in-JSON are rejected
    // with "method and protocol do not match".)
    const meta = JSON.stringify({ faceLibType, FDID: String(faceLibId), FPID: String(employeeNo) });
    const form = new FormData();
    form.append('FaceDataRecord', new Blob([meta], { type: 'application/json' }));
    form.append('img', new Blob([base64ToBytes(imageBase64)], { type: 'image/jpeg' }), 'face.jpg');
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
