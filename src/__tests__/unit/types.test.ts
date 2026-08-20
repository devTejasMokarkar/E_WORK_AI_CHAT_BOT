/**
 * Type Tests
 * Validates TypeScript type definitions
 */
import type {
  EworkUser,
  Work,
  Sanction,
  MeasurementBook,
  Voucher,
  FTO,
  ChatMessage,
  ChatSession,
  MenuState,
  RAGResult,
} from '@/types';

describe('Type Definitions', () => {
  describe('EworkUser', () => {
    it('should have correct user role types', () => {
      const validRoles: EworkUser['role'][] = [
        'District User',
        'Block User',
        'Gram Panchayat User',
        'State User',
        'Admin',
      ];
      expect(validRoles).toHaveLength(5);
    });

    it('should have correct user level types', () => {
      const validLevels: EworkUser['user_level'][] = [
        'State',
        'District',
        'Block',
        'Gram Panchayat',
      ];
      expect(validLevels).toHaveLength(4);
    });
  });

  describe('Work', () => {
    it('should have valid work status values', () => {
      const validStatuses: Work['status'][] = [
        'Proposed',
        'Administrative Sanction Pending',
        'Technical Sanction Pending',
        'Financial Sanction Pending',
        'Work in Progress',
        'Completed',
        'Terminated',
      ];
      expect(validStatuses).toHaveLength(7);
    });
  });

  describe('Sanction', () => {
    it('should have valid sanction types', () => {
      const validTypes: Sanction['type'][] = [
        'Administrative',
        'Technical',
        'Financial',
      ];
      expect(validTypes).toHaveLength(3);
    });
  });

  describe('MeasurementBook', () => {
    it('should have valid MB types', () => {
      const validTypes: MeasurementBook['mb_type'][] = [
        'Running MB',
        'Final MB',
      ];
      expect(validTypes).toHaveLength(2);
    });
  });

  describe('Voucher', () => {
    it('should have valid FTO status values', () => {
      const validStatuses: Voucher['fto_status'][] = [
        'Not Generated',
        'Generated',
        'Processed',
      ];
      expect(validStatuses).toHaveLength(3);
    });
  });

  describe('FTO', () => {
    it('should have valid payment status values', () => {
      const validStatuses: FTO['payment_status'][] = [
        'Pending',
        'Successful',
        'Failed',
      ];
      expect(validStatuses).toHaveLength(3);
    });
  });

  describe('MenuState', () => {
    it('should include all required menu states', () => {
      const requiredMenus: MenuState[] = [
        'MAIN_MENU',
        'ASK_CHATBOT',
        'EWORK_INFO',
        'WORK_STATUS',
        'WORK_DETAILS',
        'ASK_AI',
        'AWAITING_WORK_ID',
        'AWAITING_QUESTION',
      ];
      
      requiredMenus.forEach(menu => {
        expect(menu).toBeDefined();
      });
    });
  });

  describe('ChatMessage', () => {
    it('should have valid role values', () => {
      const validRoles: ChatMessage['role'][] = ['user', 'assistant', 'system'];
      expect(validRoles).toHaveLength(3);
    });
  });

  describe('ChatSession', () => {
    it('should have all required properties', () => {
      const session: ChatSession = {
        id: 'test-id',
        mobileNumber: '+919999999999',
        user: null,
        isRegistered: false,
        messages: [],
        currentMenu: 'MAIN_MENU',
        context: {},
      };

      expect(session.id).toBeDefined();
      expect(session.currentMenu).toBe('MAIN_MENU');
      expect(session.messages).toEqual([]);
    });
  });

  describe('RAGResult', () => {
    it('should have correct shape', () => {
      const result: RAGResult = {
        content: 'Test content',
        similarity: 0.95,
        source: 'test-source',
      };

      expect(result.content).toBeDefined();
      expect(typeof result.similarity).toBe('number');
      expect(result.similarity).toBeGreaterThanOrEqual(0);
      expect(result.similarity).toBeLessThanOrEqual(1);
    });
  });
});