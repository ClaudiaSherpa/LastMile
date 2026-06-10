import { normalizeOcrFields, parseOcrJson } from './normalize';

describe('OCR field normalization', () => {
  it('strips dots/spaces from cedula and uppercases plate', () => {
    const out = normalizeOcrFields({ cedula: '1.012.345.678', plate: 'abc 123' });
    expect(out.cedula).toBe('1012345678');
    expect(out.plate).toBe('ABC123');
  });

  it('extracts a 4-digit year from noisy input', () => {
    expect(normalizeOcrFields({ year: 'Modelo 2022' }).year).toBe('2022');
  });

  it('keeps ISO dates and drops empty values', () => {
    const out = normalizeOcrFields({ expiryDate: '2026-12-31', color: '', name: ' Ana ' });
    expect(out.expiryDate).toBe('2026-12-31');
    expect(out.color).toBeUndefined();
    expect(out.name).toBe('Ana');
  });
});

describe('OCR JSON parsing', () => {
  it('parses clean JSON', () => {
    expect(parseOcrJson('{"plate":"ABC123"}')).toEqual({ plate: 'ABC123' });
  });

  it('recovers JSON wrapped in prose/markdown', () => {
    expect(parseOcrJson('Here you go:\n```json\n{"a":1}\n```')).toEqual({ a: 1 });
  });

  it('returns {} for unparseable text', () => {
    expect(parseOcrJson('no json here')).toEqual({});
  });
});
