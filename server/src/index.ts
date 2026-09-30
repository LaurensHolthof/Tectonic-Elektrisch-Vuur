import express, { Request, Response } from 'express';
import cors from 'cors';
import path from 'path';
import { MockSemanticSearchEngine } from './services/mockSemanticSearch';
import { SearchQuery } from '../../shared/types';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Initialize search engine
const searchEngine = new MockSemanticSearchEngine(path.resolve(__dirname, 'corpus'));

// Warm document cache on server start
searchEngine.initialize().then(() => {
  console.log('[Server] Mock Semantic Search Engine initialized and indexed corpus.');
});

/**
 * POST /api/search
 * Core endpoint adhering to strict API Contract.
 * Non-conversational: returns exact annotated paragraphs.
 */
app.post('/api/search', async (req: Request, res: Response) => {
  try {
    const queryPayload: SearchQuery = req.body;
    if (!queryPayload || typeof queryPayload.query !== 'string') {
      return res.status(400).json({ error: 'Invalid query payload: "query" string required.' });
    }

    const response = await searchEngine.search(queryPayload);
    return res.json(response);
  } catch (err: any) {
    console.error('[Server] Search error:', err);
    return res.status(500).json({ error: 'Internal server error executing search', details: err?.message });
  }
});

/**
 * GET /api/documents
 * List all loaded documents with metadata.
 */
app.get('/api/documents', async (_req: Request, res: Response) => {
  try {
    const docs = await searchEngine.getDocuments();
    return res.json(docs.map(d => ({
      id: d.id,
      title: d.title,
      fileFormat: d.fileFormat,
      sourceType: d.sourceType,
      topicFolder: d.topicFolder,
      date: d.date,
      jurisdiction: d.jurisdiction,
      paragraphCount: d.paragraphs.length
    })));
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve documents', details: err?.message });
  }
});

/**
 * GET /api/documents/:id
 * Retrieve full text and metadata for a specific document.
 * Used when a user clicks a paragraph to view full source document context.
 */
app.get('/api/documents/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const docs = await searchEngine.getDocuments();
    const doc = docs.find(d => d.id === id);

    if (!doc) {
      return res.status(404).json({ error: `Document with ID "${id}" not found.` });
    }

    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: 'Error fetching document', details: err?.message });
  }
});

/**
 * GET /api/health
 */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'HR Paralegal Semantic Search Engine Backend' });
});

app.listen(PORT, () => {
  console.log(`[Server] Paralegal Search Backend running on http://localhost:${PORT}`);
});
