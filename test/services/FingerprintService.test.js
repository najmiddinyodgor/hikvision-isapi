import { describe, it, expect, vi } from 'vitest';
import { FingerprintService } from '../../src/services/FingerprintService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('FingerprintService', () => {
  it('add posts fingerprint config', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FingerprintService(http).add({ employeeNo: 'EMP001', fingerData: 'FPDATA', fingerPrintID: 1 });
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/FingerPrintModify?format=json');
    expect(opts.body.FingerPrintModify.employeeNo).toBe('EMP001');
    expect(opts.body.FingerPrintModify.fingerData).toBe('FPDATA');
  });
  it('search returns list', async () => {
    const http = fake(async () => ({ FingerPrintSearch: { FingerPrintInfo: { employeeNo: 'EMP001' } } }));
    const out = await new FingerprintService(http).search({ employeeNo: 'EMP001' });
    expect(out[0].employeeNo).toBe('EMP001');
  });
  it('delete by employeeNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FingerprintService(http).delete('EMP001', 1);
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/FingerPrintDelete?format=json');
    expect(opts.body.FingerPrintDelete.employeeNo).toBe('EMP001');
  });
});
