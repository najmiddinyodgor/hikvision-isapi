import { describe, it, expect, vi } from 'vitest';
import { FaceService } from '../../src/services/FaceService.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('FaceService', () => {
  it('upload PUTs a multipart FDSetUp with FaceDataRecord + img parts', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    // 'AAA' is valid base64 -> 2 bytes
    await new FaceService(http).upload('EMP001', 'AAA=', '1');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toContain('/ISAPI/Intelligent/FDLib/FDSetUp?format=json&FDID=1&faceLibType=blackFD');
    expect(opts.body).toBeInstanceOf(FormData);
    expect(opts.body.has('FaceDataRecord')).toBe(true);
    expect(opts.body.has('img')).toBe(true);
    const meta = JSON.parse(await opts.body.get('FaceDataRecord').text());
    expect(meta.FPID).toBe('EMP001');
    expect(meta.faceLibType).toBe('blackFD');
  });
  it('getFaceLibs lists libraries', async () => {
    const http = fake(async () => ({ FDLibList: { FDLib: [{ FDID: '1' }] } }));
    const out = await new FaceService(http).getFaceLibs();
    expect(out[0].FDID).toBe('1');
  });
  it('search sends a flat body with string FPID and reads MatchList', async () => {
    const http = fake(async () => ({ statusCode: '1', MatchList: [{ FPID: '39' }] }));
    const out = await new FaceService(http).search({ employeeNo: '39' });
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toContain('/ISAPI/Intelligent/FDLib/FDSearch?format=json');
    expect(opts.body.FDSearchCond).toBeUndefined(); // no wrapper
    expect(opts.body.faceLibType).toBe('blackFD');
    expect(opts.body.FPID).toBe('39'); // plain string, not [{value}]
    expect(out[0].FPID).toBe('39');
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
