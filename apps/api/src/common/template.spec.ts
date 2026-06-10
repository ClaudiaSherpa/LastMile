import { interpolate } from './template';

describe('interpolate (notification templates)', () => {
  it('replaces {{vars}} with provided values', () => {
    expect(interpolate('Hola {{name}}, tu {{doc}} vence en {{days}} días', { name: 'Ana', doc: 'SOAT', days: 15 })).toBe(
      'Hola Ana, tu SOAT vence en 15 días',
    );
  });

  it('tolerates internal whitespace in the placeholder', () => {
    expect(interpolate('{{ a }}-{{b}}', { a: 1, b: 2 })).toBe('1-2');
  });

  it('drops unknown placeholders to empty string', () => {
    expect(interpolate('x{{missing}}y', {})).toBe('xy');
  });
});
