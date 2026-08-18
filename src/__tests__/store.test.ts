/**
 * Chat Store Tests
 */
import { useChatStore } from '@/store/chatStore';
import type { EworkUser } from '@/types';

describe('ChatStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useChatStore.getState().resetSession();
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      const session = useChatStore.getState().session;
      
      expect(session.id).toBeDefined();
      expect(session.mobileNumber).toBeNull();
      expect(session.user).toBeNull();
      expect(session.isRegistered).toBe(false);
      expect(session.messages).toEqual([]);
      expect(session.currentMenu).toBe('MAIN_MENU');
      expect(session.context).toEqual({});
    });
  });

  describe('addMessage', () => {
    it('should add user message', () => {
      const { addMessage } = useChatStore.getState();
      
      addMessage('user', 'Hello');
      
      const messages = useChatStore.getState().session.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('user');
      expect(messages[0].content).toBe('Hello');
    });

    it('should add assistant message', () => {
      const { addMessage } = useChatStore.getState();
      
      addMessage('assistant', 'Welcome!');
      
      const messages = useChatStore.getState().session.messages;
      expect(messages).toHaveLength(1);
      expect(messages[0].role).toBe('assistant');
      expect(messages[0].content).toBe('Welcome!');
    });

    it('should preserve message timestamp', () => {
      const { addMessage } = useChatStore.getState();
      const before = Date.now();
      
      addMessage('user', 'Test');
      
      const after = Date.now();
      const messages = useChatStore.getState().session.messages;
      
      expect(messages[0].timestamp).toBeGreaterThanOrEqual(before);
      expect(messages[0].timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('setMobileNumber', () => {
    it('should set mobile number', () => {
      const { setMobileNumber } = useChatStore.getState();
      
      setMobileNumber('+919999999999');
      
      expect(useChatStore.getState().session.mobileNumber).toBe('+919999999999');
    });
  });

  describe('setUser', () => {
    it('should set user', () => {
      const { setUser } = useChatStore.getState();
      const user: EworkUser = {
        id: '1',
        mobile_number: '+919999999999',
        name: 'Test User',
        sso_id: 'SSO001',
        role: 'District User',
        user_level: 'District',
        district: 'Jaipur',
        block: 'Sanganer',
        gram_panchayat: 'Muralipura',
        department: 'Panchayati Raj',
        agency: 'DRDA',
        status: 'Active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      
      setUser(user);
      
      expect(useChatStore.getState().session.user).toEqual(user);
    });

    it('should set user to null', () => {
      const { setUser } = useChatStore.getState();
      
      setUser(null);
      
      expect(useChatStore.getState().session.user).toBeNull();
    });
  });

  describe('setRegistered', () => {
    it('should set registered status', () => {
      const { setRegistered } = useChatStore.getState();
      
      setRegistered(true);
      expect(useChatStore.getState().session.isRegistered).toBe(true);
      
      setRegistered(false);
      expect(useChatStore.getState().session.isRegistered).toBe(false);
    });
  });

  describe('setMenu', () => {
    it('should set menu state', () => {
      const { setMenu } = useChatStore.getState();
      
      setMenu('ASK_CHATBOT');
      expect(useChatStore.getState().session.currentMenu).toBe('ASK_CHATBOT');
      
      setMenu('WORK_STATUS');
      expect(useChatStore.getState().session.currentMenu).toBe('WORK_STATUS');
    });
  });

  describe('setContext', () => {
    it('should set context values', () => {
      const { setContext } = useChatStore.getState();
      
      setContext({ workId: '2026-27/3333' });
      expect(useChatStore.getState().session.context.workId).toBe('2026-27/3333');
      
      setContext({ selectedModule: 'WORK_DETAILS' });
      expect(useChatStore.getState().session.context.workId).toBe('2026-27/3333');
      expect(useChatStore.getState().session.context.selectedModule).toBe('WORK_DETAILS');
    });
  });

  describe('clearContext', () => {
    it('should clear all context', () => {
      const { setContext, clearContext } = useChatStore.getState();
      
      setContext({ workId: '2026-27/3333', selectedModule: 'WORK_DETAILS' });
      clearContext();
      
      expect(useChatStore.getState().session.context).toEqual({});
    });
  });

  describe('resetSession', () => {
    it('should reset session but keep session ID', () => {
      const { addMessage, setMobileNumber, resetSession } = useChatStore.getState();
      const originalId = useChatStore.getState().session.id;
      
      addMessage('user', 'Hello');
      setMobileNumber('+919999999999');
      
      resetSession();
      
      // Session ID should be preserved
      expect(useChatStore.getState().session.id).toBe(originalId);
      // But messages should be cleared
      expect(useChatStore.getState().session.messages).toEqual([]);
      // And mobile number should be cleared
      expect(useChatStore.getState().session.mobileNumber).toBeNull();
    });
  });
});