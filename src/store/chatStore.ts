/**
 * Chat Store - Zustand State Management
 */
import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { 
  ChatMessage, 
  ChatSession, 
  EworkUser, 
  MenuState,
  Work 
} from '@/types';

interface ChatStore {
  // Session state
  session: ChatSession;
  
  // Actions
  initializeSession: () => void;
  addMessage: (role: ChatMessage['role'], content: string) => void;
  setMobileNumber: (mobile: string) => void;
  setUser: (user: EworkUser | null) => void;
  setRegistered: (isRegistered: boolean) => void;
  setMenu: (menu: MenuState) => void;
  setContext: (context: Partial<ChatSession['context']>) => void;
  setWork: (work: Work | null) => void;
  clearContext: () => void;
  resetSession: () => void;
}

const createInitialSession = (): ChatSession => ({
  id: uuidv4(),
  mobileNumber: null,
  user: null,
  isRegistered: false,
  messages: [],
  currentMenu: 'MAIN_MENU',
  context: {},
});

export const useChatStore = create<ChatStore>((set, get) => ({
  session: createInitialSession(),

  initializeSession: () => {
    set({ session: createInitialSession() });
  },

  addMessage: (role, content) => {
    const message: ChatMessage = {
      id: uuidv4(),
      role,
      content,
      timestamp: Date.now(),
    };
    
    set((state) => ({
      session: {
        ...state.session,
        messages: [...state.session.messages, message],
      },
    }));
  },

  setMobileNumber: (mobile) => {
    set((state) => ({
      session: {
        ...state.session,
        mobileNumber: mobile,
      },
    }));
  },

  setUser: (user) => {
    set((state) => ({
      session: {
        ...state.session,
        user,
      },
    }));
  },

  setRegistered: (isRegistered) => {
    set((state) => ({
      session: {
        ...state.session,
        isRegistered,
      },
    }));
  },

  setMenu: (menu) => {
    set((state) => ({
      session: {
        ...state.session,
        currentMenu: menu,
      },
    }));
  },

  setContext: (context) => {
    set((state) => ({
      session: {
        ...state.session,
        context: {
          ...state.session.context,
          ...context,
        },
      },
    }));
  },

  setWork: (work) => {
    set((state) => ({
      session: {
        ...state.session,
        context: {
          ...state.session.context,
          workId: work?.work_id,
        },
      },
    }));
  },

  clearContext: () => {
    set((state) => ({
      session: {
        ...state.session,
        context: {},
      },
    }));
  },

  resetSession: () => {
    set({
      session: {
        ...createInitialSession(),
        id: get().session.id, // Keep session ID
      },
    });
  },
}));

export default useChatStore;