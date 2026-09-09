import { validateEnvironment } from '../utils/validation';

describe('Project Setup', () => {
  it('should have proper test environment setup', () => {
    expect(process.env.NODE_ENV).toBe('test');
  });

  it('should be able to import validation utilities', () => {
    expect(typeof validateEnvironment).toBe('function');
  });

  it('should have Jest configured properly', () => {
    expect(jest).toBeDefined();
    expect(expect).toBeDefined();
  });
});