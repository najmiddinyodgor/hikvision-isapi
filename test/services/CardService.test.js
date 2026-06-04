import { describe, it, expect, vi } from 'vitest';
import { CardService } from '../../src/services/CardService.js';
import { Card } from '../../src/dto/Card.js';

const fake = (impl) => ({ request: vi.fn(impl) });

describe('CardService', () => {
  it('add POSTs CardInfo Record', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new CardService(http).add(Card({ employeeNo: 'EMP001', cardNo: '123' }));
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('POST');
    expect(path).toBe('/ISAPI/AccessControl/CardInfo/Record?format=json');
    expect(opts.body.CardInfo.cardNo).toBe('123');
  });
  it('search returns card list', async () => {
    const http = fake(async () => ({ CardInfoSearch: { CardInfo: { cardNo: '123' } } }));
    const out = await new CardService(http).search({ employeeNo: 'EMP001' });
    expect(out[0].cardNo).toBe('123');
  });
  it('delete by cardNo', async () => {
    const http = fake(async () => ({ ResponseStatus: { statusCode: '1' } }));
    await new CardService(http).delete('123');
    const [method, path, opts] = http.request.mock.calls[0];
    expect(method).toBe('PUT');
    expect(path).toBe('/ISAPI/AccessControl/CardInfo/Delete?format=json');
    expect(opts.body.CardInfoDelCond.CardNoList[0].cardNo).toBe('123');
  });
});
