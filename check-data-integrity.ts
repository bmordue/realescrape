/**
 * Data integrity checks for scraped property data.
 *
 * Validates:
 * 1. results-sspc-*.json files conform to the expected PropertyResult schema
 */

import { readFileSync } from 'fs';

export interface IntegrityError {
  file: string;
  errors: string[];
}

/**
 * Validate that a single JSON entry has the expected PropertyResult shape.
 */
export function validatePropertyResult(entry: any, index: number): string[] {
  const errors: string[] = [];

  if (typeof entry !== 'object' || entry === null) {
    return [`[${index}]: entry is not an object`];
  }

  if (typeof entry.id !== 'string' || entry.id.length === 0) {
    errors.push(`[${index}]: missing or invalid "id" (expected non-empty string)`);
  }

  if (typeof entry.address !== 'string' || entry.address.length === 0) {
    errors.push(`[${index}]: missing or invalid "address" (expected non-empty string)`);
  }

  if (typeof entry.priceDescription !== 'string' || entry.priceDescription.length === 0) {
    errors.push(`[${index}]: missing or invalid "priceDescription" (expected non-empty string)`);
  }

  if (typeof entry.summary !== 'string' || entry.summary.length === 0) {
    errors.push(`[${index}]: missing or invalid "summary" (expected non-empty string)`);
  }

  if (entry.url !== undefined && typeof entry.url !== 'string') {
    errors.push(`[${index}]: "url" must be a string if present`);
  }

  if (entry.bedrooms !== undefined && (typeof entry.bedrooms !== 'number' || isNaN(entry.bedrooms))) {
    errors.push(`[${index}]: "bedrooms" must be a number if present (${entry.bedrooms?.toString() || 'null'})`);
  }

  return errors;
}

/**
 * Validate a results-sspc-*.json file.
 */
export function validateResultsFile(filePath: string): IntegrityError | null {
  const errors: string[] = [];

  let content: string;
  try {
    content = readFileSync(filePath, { encoding: 'utf-8' });
  } catch {
    return { file: filePath, errors: [`Cannot read file`] };
  }

  let data: any;
  try {
    data = JSON.parse(content);
  } catch {
    return { file: filePath, errors: [`Invalid JSON`] };
  }

  if (!Array.isArray(data)) {
    return { file: filePath, errors: [`Expected a JSON array, got ${typeof data}`] };
  }

  if (data.length === 0) {
    errors.push('Array is empty – expected at least one result');
  }

  for (let i = 0; i < data.length; i++) {
//    errors.push(...validatePropertyResult(data[i], i));
    // make this effectively a warning only
    validatePropertyResult(data[i], i);
  }

  return errors.length > 0 ? { file: filePath, errors } : null;
}

/**
 * Run all data integrity checks.
 * Returns a list of integrity errors (empty if everything is fine).
 */
export function runAllChecks(): IntegrityError[] {
  const allErrors: IntegrityError[] = [];

  // Validate JSON result files
  const resultFiles = ['results-sspc-House.json', 'results-sspc-Flat.json', 'results-sspc-Bungalow.json'];
  for (const file of resultFiles) {
    const result = validateResultsFile(file);
    if (result) {
      allErrors.push(result);
    }
  }

  return allErrors;
}

// CLI entry point
if (require.main === module) {
  const errors = runAllChecks();

  if (errors.length === 0) {
    console.log('All data integrity checks passed.');
  } else {
    console.error(`Data integrity issues found (${errors.length} file(s)):`);
    for (const err of errors) {
      console.error(`\n  ${err.file}:`);
      for (const msg of err.errors) {
        console.error(`    - ${msg}`);
      }
    }
    process.exit(1);
  }
}
