/**
 * API Routes Integration Tests
 * Tests the Next.js API endpoints
 */
import { createMocks } from 'node-mocks-http';
import type { NextApiRequest, NextApiResponse } from 'next';

// Mock Supabase
jest.mock('@/lib/supabase', () => ({
  supabase: {
    from: jest.fn(() => ({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    })),
    rpc: jest.fn().mockResolvedValue({ data: [], error: null }),
  },
}));

// Mock Cohere
jest.mock('@/lib/cohere', () => ({
  generateQueryEmbedding: jest.fn().mockResolvedValue(Array(1024).fill(0.1)),
  generateChatCompletion: jest.fn().mockResolvedValue('Test response'),
  generateEmbedding: jest.fn().mockResolvedValue(Array(1024).fill(0.1)),
}));

// Mock store
jest.mock('@/store/chatStore', () => ({
  useChatStore: {
    getState: jest.fn(() => ({
      session: {
        id: 'test-session',
        mobileNumber: null,
        user: null,
        isRegistered: false,
        messages: [],
        currentMenu: 'MAIN_MENU',
        context: {},
        summaries: [],
        rollingBuffer: [],
        totalTurns: 0,
        migrated: false,
      },
      addMessage: jest.fn(),
      setMobileNumber: jest.fn(),
      setUser: jest.fn(),
      setRegistered: jest.fn(),
      setMenu: jest.fn(),
      setContext: jest.fn(),
      clearContext: jest.fn(),
      resetSession: jest.fn(),
    })),
  },
}));

describe('API Routes', () => {
  describe('GET /api/health', () => {
    it('should return health status', async () => {
      const { GET } = await import('@/app/api/health/route');
      const req = createMocks({ method: 'GET' });
      const response = await GET(req as any);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.service).toBeDefined();
      expect(data.version).toBeDefined();
    });
  });

  describe('POST /api/chat', () => {
    it('should handle greeting', async () => {
      const { POST } = await import('@/app/api/chat/route');
      const { req, res } = createMocks({
        method: 'POST',
        body: { message: 'hi', sessionId: 'test-session' },
      });
      await POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.response).toContain('Welcome to the e-Work WhatsApp Assistant');
    });

    it('should handle menu option 1', async () => {
      const { POST } = await import('@/app/api/chat/route');
      const { req, res } = createMocks({
        method: 'POST',
        body: { message: '1', sessionId: 'test-session' },
      });
      await POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.response).toContain('Ask e-Work Chatbot');
    });

    it('should return 400 for missing message', async () => {
      const { POST } = await import('@/app/api/chat/route');
      const { req, res } = createMocks({
        method: 'POST',
        body: { sessionId: 'test-session' },
      });
      await POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(400);
    });
  });

  describe('POST /api/rag', () => {
    it('should return results for query', async () => {
      const { POST } = await import('@/app/api/rag/route');
      const { req, res } = createMocks({
        method: 'POST',
        body: { query: 'test query', sessionId: 'test-session' },
      });
      await POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
      const data = JSON.parse(res._getData());
      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it('should use lower threshold for short terms', async () => {
      const { POST } = await import('@/app/api/rag/route');
      const { req, res } = createMocks({
        method: 'POST',
        body: { query: 'UC generate', sessionId: 'test-session' },
      });
      await POST(req as any, res as any);

      expect(res._getStatusCode()).toBe(200);
    });
  });
});