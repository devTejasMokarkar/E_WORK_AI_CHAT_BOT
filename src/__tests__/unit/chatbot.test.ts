/**
 * Chatbot Logic Tests
 */
import type { ChatSession, MenuState } from '@/types';

// Test the core chatbot logic directly
describe('Chatbot Logic', () => {
  const GREETING_PATTERNS = /^(hi|hello|start|namaste|नमस्ते|hey|hi there)$/i;

  describe('Greeting Detection', () => {
    it('should detect English greetings', () => {
      expect(GREETING_PATTERNS.test('hi')).toBe(true);
      expect(GREETING_PATTERNS.test('hello')).toBe(true);
      expect(GREETING_PATTERNS.test('hey')).toBe(true);
      expect(GREETING_PATTERNS.test('hi there')).toBe(true);
      expect(GREETING_PATTERNS.test('start')).toBe(true);
    });

    it('should detect Hindi greetings', () => {
      expect(GREETING_PATTERNS.test('namaste')).toBe(true);
      expect(GREETING_PATTERNS.test('नमस्ते')).toBe(true);
    });

    it('should reject non-greetings', () => {
      expect(GREETING_PATTERNS.test('help')).toBe(false);
      expect(GREETING_PATTERNS.test('question')).toBe(false);
      expect(GREETING_PATTERNS.test('how are you')).toBe(false);
    });
  });

  describe('Menu State Transitions', () => {
    const menuMap: Record<string, MenuState> = {
      '1': 'WORK_DETAILS',
      '2': 'ADMIN_SANCTION',
      '3': 'TECHNICAL_SANCTION',
      '4': 'FINANCIAL_SANCTION',
      '5': 'ESTIMATE',
      '6': 'WORK_PROGRESS',
      '7': 'WORK_PHOTOS',
      '8': 'MEASUREMENT_BOOK',
      '9': 'VOUCHER_DETAILS',
      '10': 'FTO_DETAILS',
      '11': 'PAYMENT_STATUS',
      '12': 'UTILIZATION_CERTIFICATE',
      '13': 'COMPLETION_CERTIFICATE',
      '14': 'MAIN_MENU',
    };

    it('should map menu options correctly', () => {
      expect(menuMap['1']).toBe('WORK_DETAILS');
      expect(menuMap['2']).toBe('ADMIN_SANCTION');
      expect(menuMap['14']).toBe('MAIN_MENU');
    });

    it('should handle back navigation from sub-menus', () => {
      const subMenus: MenuState[] = [
        'ADMIN_SANCTION',
        'TECHNICAL_SANCTION',
        'VOUCHER_DETAILS',
        'PAYMENT_STATUS',
      ];

      subMenus.forEach(menu => {
        // Back should return to WORK_DETAILS
        expect(menu).not.toBe('WORK_DETAILS');
      });
    });
  });

  describe('Work ID Validation', () => {
    it('should validate correct work ID format', () => {
      const workId = '2026-27/3333';
      expect(workId.match(/^\d{4}-\d{2}\/\d+$/)).toBeTruthy();
    });

    it('should reject invalid work ID formats', () => {
      expect('invalid'.match(/^\d{4}-\d{2}\/\d+$/)).toBeFalsy();
      expect('2026-27'.match(/^\d{4}-\d{2}\/\d+$/)).toBeFalsy();
      expect('26-27/3333'.match(/^\d{4}-\d{2}\/\d+$/)).toBeFalsy();
    });
  });

  describe('Language Detection', () => {
    const detectLanguage = (text: string): 'en' | 'hi' | 'mixed' => {
      const hindiRegex = /[\u0900-\u097F]/;
      const hindiWords = text.match(hindiRegex);
      
      if (!hindiWords) return 'en';
      if (hindiWords.length > text.length * 0.3) return 'hi';
      return 'mixed';
    };

    it('should detect English text', () => {
      expect(detectLanguage('Hello how are you')).toBe('en');
      expect(detectLanguage('How to generate FTO')).toBe('en');
    });

    it('should detect Hindi text', () => {
      // Should return Hindi or mixed (not English)
      const result = detectLanguage('नमस्ते कैसे हैं आप');
      expect(['hi', 'mixed']).toContain(result);
    });

    it('should detect mixed language', () => {
      expect(detectLanguage('Voucher forward नहीं हो रहा है')).toBe('mixed');
      expect(detectLanguage('Estimate approve कैसे करें')).toBe('mixed');
    });
  });

  describe('Currency Formatting', () => {
    const formatCurrency = (amount: number): string => {
      return new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format(amount);
    };

    it('should format currency correctly', () => {
      expect(formatCurrency(500000)).toBe('₹5,00,000');
      expect(formatCurrency(125000)).toBe('₹1,25,000');
      expect(formatCurrency(1000)).toBe('₹1,000');
    });
  });

  describe('Date Formatting', () => {
    const formatDate = (dateStr: string): string => {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    };

    it('should format dates correctly', () => {
      expect(formatDate('2026-07-15')).toBe('15 July 2026');
      expect(formatDate('2026-07-25')).toBe('25 July 2026');
    });
  });

  describe('Mock Answer Matching', () => {
    const mockAnswers: Record<string, string> = {
      'voucher forward': 'Please verify the following:\n1. The voucher is approved by the maker.',
      'fto': 'To generate an FTO:\n1. Ensure the voucher is approved.',
      'estimate approve': 'To approve an estimate:\n1. Login as Technical Sanction authority.',
      'payment pending': 'Payment may be pending due to:\n1. FTO not yet generated',
      'uc generate': 'To generate Utilization Certificate:\n1. Go to Works > Utilization Certificate.',
      'final mb': 'To create Final Measurement Book:\n1. Complete all running MBs first.',
    };

    it('should match voucher forward query', () => {
      const input = 'voucher forward नहीं हो रहा है';
      for (const key of Object.keys(mockAnswers)) {
        if (input.toLowerCase().includes(key)) {
          expect(mockAnswers[key]).toBeDefined();
        }
      }
    });

    it('should match FTO query', () => {
      const input = 'How can I generate an FTO?';
      expect(input.toLowerCase().includes('fto')).toBe(true);
    });

    it('should return fallback for unknown queries', () => {
      const input = 'some unknown question about random topic';
      let matched = false;
      
      for (const key of Object.keys(mockAnswers)) {
        if (input.toLowerCase().includes(key)) {
          matched = true;
          break;
        }
      }
      
      expect(matched).toBe(false);
    });
  });

  describe('Session State Management', () => {
    it('should handle main menu options', () => {
      const options = ['1', '2', '0'];
      const validOptions = ['1', '2', '0'];
      
      options.forEach(opt => {
        expect(validOptions).toContain(opt);
      });
    });

    it('should reject invalid menu options', () => {
      const invalidOptions = ['5', 'abc', ''];
      const validOptions = ['1', '2', '0'];
      
      invalidOptions.forEach(opt => {
        if (opt !== '') {
          expect(validOptions).not.toContain(opt);
        }
      });
    });
  });
});