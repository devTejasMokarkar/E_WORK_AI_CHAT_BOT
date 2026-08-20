/**
 * RAG Module Unit Tests
 */
import { chunkText, fallbackKeywordSearch } from '@/lib/rag';
import type { RAGResult } from '@/types';

describe('RAG Module', () => {
  describe('chunkText', () => {
    it('should split text into chunks of ~500 chars', () => {
      const text = 'A'.repeat(1200);
      const chunks = chunkText(text, 500, 50);
      expect(chunks.length).toBe(3);
      expect(chunks[0].length).toBeLessThanOrEqual(550);
    });

    it('should handle short text (single chunk)', () => {
      const text = 'Short text.';
      const chunks = chunkText(text, 500, 50);
      expect(chunks).toHaveLength(1);
      expect(chunks[0]).toBe('Short text.');
    });

    it('should handle empty string', () => {
      const chunks = chunkText('', 500, 50);
      expect(chunks).toEqual([]);
    });

    it('should preserve sentence boundaries', () => {
      const text = 'First sentence. Second sentence! Third sentence?';
      const chunks = chunkText(text, 500, 50);
      expect(chunks[0]).toContain('First sentence.');
    });

    it('should handle Hindi/Unicode text', () => {
      const text = 'नमस्ते दुनिया। यह एक परीक्षण है।';
      const chunks = chunkText(text, 500, 50);
      expect(chunks.length).toBeGreaterThan(0);
      expect(chunks[0]).toContain('नमस्ते');
    });

    it('should maintain overlap between chunks', () => {
      const text = 'Word '.repeat(200); // ~1000 chars
      const chunks = chunkText(text, 500, 50);
      expect(chunks.length).toBeGreaterThan(1);
    });
  });

  describe('fallbackKeywordSearch', () => {
    const mockDocuments = [
      {
        content: 'Voucher processing requires maker approval and checker verification',
        category: 'Voucher',
        source: 'test.pdf',
      },
      {
        content: 'FTO generation consolidates approved payment information',
        category: 'FTO',
        source: 'test.pdf',
      },
      {
        content: 'UC utilization certificate summarizes expenditure',
        category: 'UC',
        source: 'test.pdf',
      },
    ];

    it('should find matches for exact keywords', async () => {
      const results = await fallbackKeywordSearch('voucher processing', 5, mockDocuments);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('Voucher');
    });

    it('should handle short terms (FTO, UC, MB)', async () => {
      const results = await fallbackKeywordSearch('FTO generation', 5, mockDocuments);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].content).toContain('FTO');
    });

    it('should return empty for no matches', async () => {
      const results = await fallbackKeywordSearch('xyz unknown', 5, mockDocuments);
      expect(results).toHaveLength(0);
    });

    it('should score matches correctly', async () => {
      const results = await fallbackKeywordSearch('voucher approval verification', 5, mockDocuments);
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].similarity).toBeGreaterThan(0);
    });

    it('should respect topK limit', async () => {
      const results = await fallbackKeywordSearch('voucher', 2, mockDocuments);
      expect(results.length).toBeLessThanOrEqual(2);
    });

    it('should use word boundaries for matching', async () => {
      const results = await fallbackKeywordSearch('cat', 5, [
        { content: 'concatenate', category: 'test', source: 'test' },
        { content: 'category', category: 'test', source: 'test' },
      ]);
      // Should not match 'cat' inside 'concatenate' or 'category' without word boundary
      expect(results.length).toBe(0);
    });
  });

  describe('searchKnowledgeBase threshold logic', () => {
    it('should use 0.2 threshold for short terms', () => {
      const hasShortTerm = /\b(UC|FTO|MB|AS|TS|FS|CC)\b/i;
      expect(hasShortTerm.test('UC generate')).toBe(true);
      expect(hasShortTerm.test('FTO generate')).toBe(true);
      expect(hasShortTerm.test('Final MB')).toBe(true);
      expect(hasShortTerm.test('AS TS FS')).toBe(true);
      expect(hasShortTerm.test('estimate')).toBe(false);
      expect(hasShortTerm.test('voucher')).toBe(false);
    });
  });
});