import { Face } from '../dto/Face.js';

const JSON_FMT = { format: 'json' };

export class FaceService {
  constructor(http) { this.http = http; }

  async upload(employeeNo, imageBase64, faceLibId = '1') {
    const dto = Face({ employeeNo, imageBase64, faceLibId });
    return this.http.request('POST', `/ISAPI/Intelligent/FDLib/FDSetUp?format=json&FDID=${faceLibId}&faceLibType=blackFD`, { ...JSON_FMT, body: dto.toISAPI() });
  }
  async search({ employeeNo, faceLibId = '1', position = 0, maxResults = 30 } = {}) {
    const body = {
      FDSearchCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        FDID: String(faceLibId),
        faceLibType: 'blackFD',
        ...(employeeNo ? { FPID: [{ value: String(employeeNo) }] } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/Intelligent/FDLib/FDSearch?format=json', { ...JSON_FMT, body });
    const list = r.FDSearch && r.FDSearch.MatchList;
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
