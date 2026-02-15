import { validateUrl, validateAddress, validatePrice, validateBedrooms, sanitizeHtml } from '../validation';

describe('Validation utilities', () => {
  describe('validateUrl', () => {
    it('should validate correct HTTPS URLs', () => {
      const result = validateUrl('https://www.example.com/property');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate correct HTTP URLs', () => {
      const result = validateUrl('http://www.example.com/property');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject undefined URLs', () => {
      const result = validateUrl(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL is required');
    });

    it('should reject invalid URLs', () => {
      const result = validateUrl('not-a-url');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL is not valid');
    });

    it('should reject non-HTTP protocols', () => {
      const result = validateUrl('ftp://example.com');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('URL must use HTTP or HTTPS protocol');
    });
  });

  describe('validateAddress', () => {
    it('should validate correct addresses', () => {
      const result = validateAddress('123 Main Street, Edinburgh EH1 1AA');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject undefined addresses', () => {
      const result = validateAddress(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is required');
    });

    it('should reject empty addresses', () => {
      const result = validateAddress('   ');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address cannot be empty');
    });

    it('should reject overly long addresses', () => {
      const longAddress = 'a'.repeat(201);
      const result = validateAddress(longAddress);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Address is too long (max 200 characters)');
    });
  });

  describe('validatePrice', () => {
    it('should validate correct UK prices', () => {
      const result = validatePrice('Offers over £500,000');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should validate simple prices', () => {
      const result = validatePrice('£300000');
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject undefined prices', () => {
      const result = validatePrice(undefined);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price description is required');
    });

    it('should reject prices without currency symbol', () => {
      const result = validatePrice('500,000');
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Price description should contain a valid UK price (e.g., £500,000)');
    });
  });

  describe('validateBedrooms', () => {
    it('should validate correct bedroom counts', () => {
      const result = validateBedrooms(3);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should allow undefined bedrooms', () => {
      const result = validateBedrooms(undefined);
      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should reject negative bedrooms', () => {
      const result = validateBedrooms(-1);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bedrooms must be a number between 0 and 20');
    });

    it('should reject excessive bedroom counts', () => {
      const result = validateBedrooms(25);
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Bedrooms must be a number between 0 and 20');
    });
  });

  describe('sanitizeHtml', () => {
    it('should remove script tags', () => {
      const dirty = '<div>Safe content</div><script>alert("xss")</script>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toBe('<div>Safe content</div>');
    });

    it('should remove iframe tags', () => {
      const dirty = '<div>Safe content</div><iframe src="malicious"></iframe>';
      const clean = sanitizeHtml(dirty);
      expect(clean).toBe('<div>Safe content</div>');
    });

    it('should remove javascript: URLs', () => {
      const dirty = '<a href="javascript:alert(1)">Link</a>';
      const clean = sanitizeHtml(dirty);
      expect(clean).not.toContain('javascript:');
    });

    it('should preserve safe content', () => {
      const safe = '<div class="property"><h1>Title</h1><p>Description</p></div>';
      const result = sanitizeHtml(safe);
      expect(result).toBe(safe);
    });
  });
});