/**
 * Chatbot Logic Integration Tests
 */
import { processUserInput } from '@/lib/chatbot';
import { useChatStore } from '@/store/chatStore';
import type { ChatSession, MenuState, EworkUser } from '@/types';

describe('Chatbot Integration Flows', () => {
  let mockSession: ChatSession;
  let mockStore: ReturnType<typeof useChatStore.getState>;

  beforeEach(() => {
    useChatStore.getState().resetSession();
    mockStore = useChatStore.getState();

    mockSession = {
      id: 'test-session-1',
      mobileNumber: null,
      user: null,
      isRegistered: false,
      messages: [],
      currentMenu: 'MAIN_MENU',
      context: {},
    };
  });

  describe('Main Menu Flow', () => {
    it('should show welcome message on greeting', async () => {
      const response = await processUserInput('hi', mockSession, mockStore);
      expect(response).toContain('Welcome to the e-Work WhatsApp Assistant');
      expect(response).toContain('1. Ask e-Work Chatbot');
      expect(response).toContain('2. e-Work Information');
    });

    it('should navigate to ASK_CHATBOT on option 1', async () => {
      const response = await processUserInput('1', mockSession, mockStore);
      expect(response).toContain('Registration is not required');
      expect(response).toContain('Supported questions:');
      expect(mockStore.session.currentMenu).toBe('ASK_CHATBOT');
    });

    it('should navigate to AWAITING_WORK_ID on option 2', async () => {
      const response = await processUserInput('2', mockSession, mockStore);
      expect(response).toContain('Please enter the Work ID');
      expect(mockStore.session.currentMenu).toBe('AWAITING_WORK_ID');
    });

    it('should reject invalid main menu option', async () => {
      const response = await processUserInput('5', mockSession, mockStore);
      expect(response).toContain('Invalid option');
    });
  });

  describe('ASK_CHATBOT Flow', () => {
    beforeEach(async () => {
      await processUserInput('1', mockSession, mockStore); // Enter ASK_CHATBOT
    });

    it('should show supported questions menu', async () => {
      const response = await processUserInput('1', mockSession, mockStore);
      expect(response).toContain('Voucher forward नहीं हो रहा है');
      expect(response).toContain('How can I generate an FTO');
    });

    it('should handle numbered question selection (1-7)', async () => {
      const response = await processUserInput('1', mockSession, mockStore);
      // Should interpret as first supported question
      expect(response).toContain('Voucher forward नहीं हो रहा है');
    });

    it('should return to MAIN_MENU on back', async () => {
      const response = await processUserInput('back', mockSession, mockStore);
      expect(response).toContain('Welcome to the e-Work WhatsApp Assistant');
      expect(mockStore.session.currentMenu).toBe('MAIN_MENU');
    });

    it('should reject too short questions', async () => {
      const response = await processUserInput('a', mockSession, mockStore);
      expect(response).toContain('longer question');
    });
  });

  describe('Work Status Flow', () => {
    beforeEach(async () => {
      await processUserInput('2', mockSession, mockStore); // Enter EWORK_INFO
    });

    it('should prompt for Work ID', async () => {
      const response = await processUserInput('2', mockSession, mockStore);
      expect(response).toContain('Work ID');
    });

    it('should validate Work ID format', async () => {
      const response = await processUserInput('invalid', mockSession, mockStore);
      expect(response).toContain('Invalid Work ID format');
    });

    it('should accept valid format', async () => {
      const response = await processUserInput('2026-27/3333', mockSession, mockStore);
      // Would normally call getWorkById, but we can check format validation passed
      expect(response).not.toContain('Invalid Work ID format');
    });
  });

  describe('Back Navigation', () => {
    it('should return to MAIN_MENU from ASK_CHATBOT', async () => {
      await processUserInput('1', mockSession, mockStore);
      await processUserInput('back', mockSession, mockStore);
      expect(mockStore.session.currentMenu).toBe('MAIN_MENU');
    });

    it('should return to MAIN_MENU from EWORK_INFO', async () => {
      await processUserInput('2', mockSession, mockStore);
      await processUserInput('back', mockSession, mockStore);
      expect(mockStore.session.currentMenu).toBe('MAIN_MENU');
    });

    it('should return to MAIN_MENU from AWAITING_WORK_ID', async () => {
      await processUserInput('2', mockSession, mockStore);
      await processUserInput('back', mockSession, mockStore);
      expect(mockStore.session.currentMenu).toBe('MAIN_MENU');
    });
  });

  describe('Session Persistence', () => {
    it('should preserve session ID on reset', async () => {
      const originalId = mockStore.session.id;
      mockStore.addMessage('user', 'test');
      mockStore.setMobileNumber('+919999999999');
      mockStore.resetSession();
      expect(mockStore.session.id).toBe(originalId);
    });

    it('should clear messages on reset', async () => {
      mockStore.addMessage('user', 'test');
      mockStore.resetSession();
      expect(mockStore.session.messages).toHaveLength(0);
    });

    it('should clear mobile number on reset', async () => {
      mockStore.setMobileNumber('+919999999999');
      mockStore.resetSession();
      expect(mockStore.session.mobileNumber).toBeNull();
    });
  });
});