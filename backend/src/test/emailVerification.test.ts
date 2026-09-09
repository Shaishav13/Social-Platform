import { UserModel } from '../services/auth/models';
import { EmailService } from '../services/auth/emailService';

describe('Email Verification & Authentication Hardening Tests', () => {
  describe('OTP Generation & Cryptographic Verification', () => {
    it('should generate a valid 6-digit numeric OTP', () => {
      for (let i = 0; i < 50; i++) {
        const otp = UserModel.generateOTP();
        expect(otp).toHaveLength(6);
        expect(/^\d{6}$/.test(otp)).toBe(true);
        const numericVal = parseInt(otp, 10);
        expect(numericVal).toBeGreaterThanOrEqual(100000);
        expect(numericVal).toBeLessThan(1000000);
      }
    });

    it('should produce a consistent SHA-256 hash for identical OTPs', () => {
      const otp = '482910';
      const hash1 = UserModel.hashOtp(otp);
      const hash2 = UserModel.hashOtp(otp);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64); // 256 bits = 64 hex characters
    });

    it('should correctly verify valid OTP using timing-safe comparison', () => {
      const otp = '123456';
      const hash = UserModel.hashOtp(otp);

      const isValid = UserModel.verifyOtpHash(otp, hash);
      expect(isValid).toBe(true);
    });

    it('should reject invalid OTPs using timing-safe comparison', () => {
      const otp = '123456';
      const wrongOtp = '654321';
      const hash = UserModel.hashOtp(otp);

      const isValid = UserModel.verifyOtpHash(wrongOtp, hash);
      expect(isValid).toBe(false);
    });

    it('should reject malformed or different length inputs safely', () => {
      const otp = '123456';
      const hash = UserModel.hashOtp(otp);

      expect(UserModel.verifyOtpHash('12345', hash)).toBe(false);
      expect(UserModel.verifyOtpHash('1234567', hash)).toBe(false);
      expect(UserModel.verifyOtpHash('', hash)).toBe(false);
    });
  });

  describe('EmailService Dispatch Resilience', () => {
    it('should dispatch verification OTP without throwing errors', async () => {
      const result = await EmailService.sendVerificationOtp(
        'testuser@example.com',
        'TestUser',
        '847291'
      );
      // In dev fallback mode, returns true
      expect(typeof result).toBe('boolean');
    });

    it('should dispatch password reset email without throwing errors', async () => {
      const result = await EmailService.sendPasswordResetEmail(
        'testuser@example.com',
        'http://localhost:3001/reset-password?token=testtoken123'
      );
      expect(typeof result).toBe('boolean');
    });
  });

  describe('JWT Payload Verification Inclusion', () => {
    it('should include isVerified in the JWT payload', () => {
      const mockUser = {
        id: 'user-uuid-1234',
        username: 'secureuser',
        email: 'secureuser@example.com',
        passwordHash: 'hash',
        isPrivate: false,
        isVerified: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = UserModel.generateAccessToken(mockUser);
      expect(token).toBeDefined();

      const decoded = UserModel.verifyAccessToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.userId).toBe('user-uuid-1234');
      expect(decoded?.isVerified).toBe(true);
    });

    it('should correctly mark isVerified=false in JWT payload for unverified user', () => {
      const mockUser = {
        id: 'user-uuid-5678',
        username: 'unverifieduser',
        email: 'unverified@example.com',
        passwordHash: 'hash',
        isPrivate: false,
        isVerified: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const token = UserModel.generateAccessToken(mockUser);
      const decoded = UserModel.verifyAccessToken(token);
      expect(decoded?.isVerified).toBe(false);
    });
  });
});
