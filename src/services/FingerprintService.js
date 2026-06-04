const JSON_FMT = { format: 'json' };

export class FingerprintService {
  constructor(http) { this.http = http; }

  async add({ employeeNo, fingerData, fingerPrintID = 1 }) {
    const body = {
      FingerPrintModify: {
        employeeNo: String(employeeNo),
        fingerPrintID: Number(fingerPrintID),
        fingerData,
      },
    };
    return this.http.request('POST', '/ISAPI/AccessControl/FingerPrintModify?format=json', { ...JSON_FMT, body });
  }
  async search({ employeeNo, position = 0, maxResults = 30 } = {}) {
    const body = {
      FingerPrintCond: {
        searchID: String(Date.now()),
        searchResultPosition: position,
        maxResults,
        ...(employeeNo ? { employeeNo: String(employeeNo) } : {}),
      },
    };
    const r = await this.http.request('POST', '/ISAPI/AccessControl/FingerPrintSearch?format=json', { ...JSON_FMT, body });
    const list = r.FingerPrintSearch && r.FingerPrintSearch.FingerPrintInfo;
    if (!list) return [];
    return Array.isArray(list) ? list : [list];
  }
  async delete(employeeNo, fingerPrintID = 1) {
    const body = { FingerPrintDelete: { employeeNo: String(employeeNo), fingerPrintID: Number(fingerPrintID) } };
    return this.http.request('PUT', '/ISAPI/AccessControl/FingerPrintDelete?format=json', { ...JSON_FMT, body });
  }
}
