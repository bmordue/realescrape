/**
 * Input validation utilities for property scraping
 */

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
}

/**
 * Validates a property URL
 */
export function validateUrl(url: string | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (!url) {
    errors.push('URL is required');
  } else {
    try {
      const parsedUrl = new URL(url);
      if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
        errors.push('URL must use HTTP or HTTPS protocol');
      }
    } catch (error) {
      errors.push('URL is not valid');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates property address
 */
export function validateAddress(address: string | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (!address) {
    errors.push('Address is required');
  } else if (address.trim().length === 0) {
    errors.push('Address cannot be empty');
  } else if (address.length > 200) {
    errors.push('Address is too long (max 200 characters)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates price description
 */
export function validatePrice(priceDescription: string | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (!priceDescription) {
    errors.push('Price description is required');
  } else {
    // Basic pattern for UK property prices
    const pricePattern = /£[\d,]+/;
    if (!pricePattern.test(priceDescription)) {
      errors.push('Price description should contain a valid UK price (e.g., £500,000)');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Validates number of bedrooms
 */
export function validateBedrooms(bedrooms: number | undefined): ValidationResult {
  const errors: string[] = [];
  
  if (bedrooms !== undefined) {
    if (isNaN(bedrooms) || bedrooms < 0 || bedrooms > 20) {
      errors.push('Bedrooms must be a number between 0 and 20');
    }
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Sanitizes HTML content by removing potentially dangerous elements
 */
export function sanitizeHtml(html: string): string {
  // Basic sanitization - in production, consider using a proper HTML sanitization library
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .trim();
}