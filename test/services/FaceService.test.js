import { describe, it, expect, vi } from 'vitest';
import { FaceService } from '../../src/services/FaceService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('FaceService', () => {
  it('upload posts face record to FDLib', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FaceService(http).upload('EMP001', 'BASE64DATA', '1');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toContain('/ISAPI/Intelligent/FDLib/FDSetUp?format=json');
    expect(opts.body.FaceDataRecord.FPID).toBe('EMP001');
    expect(opts.body.FaceDataRecord.faceData).toBe('BASE64DATA');
  });
  it('getFaceLibs lists libraries', async () => {
    const http = fake(async () => ({ FDLibList: { FDLib: [{ FDID: '1' }] } }));
    const out = await new FaceService(http).getFaceLibs();
    expect(out[0].FDID).toBe('1');
  });
  it('delete removes by employeeNo and lib', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new FaceService(http).delete('EMP001', '1');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toContain('FDSearch/Delete');
    expect(opts.body.FPID[0].value).toBe('EMP001');
  });
});
