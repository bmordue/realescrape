import { validatePropertyResult, validateResultsFile } from '../check-data-integrity';
import { writeFileSync, mkdirSync, rmSync } from 'fs';
import { join } from 'path';

const TMP_DIR = join(__dirname, '__tmp_integrity__');

beforeAll(() => {
  mkdirSync(TMP_DIR, { recursive: true });
});

afterAll(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('validatePropertyResult', () => {
  it('should accept a valid property result', () => {
    const entry = {
      id: 'abc123',
      address: '10 High Street, Edinburgh EH1 1AA',
      priceDescription: 'Offers over £250,000',
      summary: 'Detached House',
      url: 'https://www.sspc.co.uk/some-property',
      bedrooms: 3,
    };
    expect(validatePropertyResult(entry, 0)).toEqual([]);
  });

  it('should reject a non-object entry', () => {
    const errors = validatePropertyResult(null, 0);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('not an object');
  });

  it('should flag missing id', () => {
    const entry = { address: 'addr', priceDescription: '£1', summary: 's' };
    const errors = validatePropertyResult(entry, 0);
    expect(errors.some(e => e.includes('"id"'))).toBe(true);
  });

  it('should flag missing address', () => {
    const entry = { id: 'x', priceDescription: '£1', summary: 's' };
    const errors = validatePropertyResult(entry, 0);
    expect(errors.some(e => e.includes('"address"'))).toBe(true);
  });

  it('should flag missing priceDescription', () => {
    const entry = { id: 'x', address: 'a', summary: 's' };
    const errors = validatePropertyResult(entry, 0);
    expect(errors.some(e => e.includes('"priceDescription"'))).toBe(true);
  });

  it('should flag missing summary', () => {
    const entry = { id: 'x', address: 'a', priceDescription: '£1' };
    const errors = validatePropertyResult(entry, 0);
    expect(errors.some(e => e.includes('"summary"'))).toBe(true);
  });

  it('should flag invalid bedrooms type', () => {
    const entry = { id: 'x', address: 'a', priceDescription: '£1', summary: 's', bedrooms: 'three' };
    const errors = validatePropertyResult(entry, 0);
    expect(errors.some(e => e.includes('"bedrooms"'))).toBe(true);
  });

  it('should allow optional fields to be absent', () => {
    const entry = { id: 'x', address: 'a', priceDescription: '£1', summary: 's' };
    expect(validatePropertyResult(entry, 0)).toEqual([]);
  });
});

describe('validateResultsFile', () => {
  it('should accept a valid results file', () => {
    const filePath = join(TMP_DIR, 'valid-results.json');
    const data = [
      { id: '1', address: 'addr', priceDescription: '£1', summary: 's' },
    ];
    writeFileSync(filePath, JSON.stringify(data));
    expect(validateResultsFile(filePath)).toBeNull();
  });

  it('should reject invalid JSON', () => {
    const filePath = join(TMP_DIR, 'bad.json');
    writeFileSync(filePath, '{not json');
    const result = validateResultsFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.errors[0]).toContain('Invalid JSON');
  });

  it('should reject non-array JSON', () => {
    const filePath = join(TMP_DIR, 'object.json');
    writeFileSync(filePath, JSON.stringify({ key: 'val' }));
    const result = validateResultsFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.errors[0]).toContain('JSON array');
  });

  it('should report error for empty array', () => {
    const filePath = join(TMP_DIR, 'empty.json');
    writeFileSync(filePath, '[]');
    const result = validateResultsFile(filePath);
    expect(result).not.toBeNull();
    expect(result!.errors[0]).toContain('empty');
  });

  it('should report error for missing file', () => {
    const result = validateResultsFile(join(TMP_DIR, 'nonexistent.json'));
    expect(result).not.toBeNull();
    expect(result!.errors[0]).toContain('Cannot read');
  });
});
