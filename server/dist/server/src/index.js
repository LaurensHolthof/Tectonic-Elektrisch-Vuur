"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const path_1 = __importDefault(require("path"));
const mockSemanticSearch_1 = require("./services/mockSemanticSearch");
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3001;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
// Initialize search engine
const searchEngine = new mockSemanticSearch_1.MockSemanticSearchEngine(path_1.default.resolve(__dirname, 'corpus'));
// Warm document cache on server start
searchEngine.initialize().then(() => {
    console.log('[Server] Mock Semantic Search Engine initialized and indexed corpus.');
});
/**
 * POST /api/search
 * Core endpoint adhering to strict API Contract.
 * Non-conversational: returns exact annotated paragraphs.
 */
app.post('/api/search', async (req, res) => {
    try {
        const queryPayload = req.body;
        if (!queryPayload || typeof queryPayload.query !== 'string') {
            return res.status(400).json({ error: 'Invalid query payload: "query" string required.' });
        }
        const response = await searchEngine.search(queryPayload);
        return res.json(response);
    }
    catch (err) {
        console.error('[Server] Search error:', err);
        return res.status(500).json({ error: 'Internal server error executing search', details: err?.message });
    }
});
/**
 * GET /api/documents
 * List all loaded documents with metadata.
 */
app.get('/api/documents', async (_req, res) => {
    try {
        const docs = await searchEngine.getDocuments();
        return res.json(docs.map(d => ({
            id: d.id,
            title: d.title,
            fileFormat: d.fileFormat,
            sourceType: d.sourceType,
            topicFolder: d.topicFolder,
            date: d.date,
            countryOfOrigin: d.countryOfOrigin,
            countryOfInterest: d.countryOfInterest || d.jurisdiction,
            jurisdiction: d.jurisdiction,
            paragraphCount: d.paragraphs.length
        })));
    }
    catch (err) {
        return res.status(500).json({ error: 'Failed to retrieve documents', details: err?.message });
    }
});
/**
 * GET /api/documents/:id
 * Retrieve full text and metadata for a specific document.
 * Used when a user clicks a paragraph to view full source document context.
 */
app.get('/api/documents/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const docs = await searchEngine.getDocuments();
        const doc = docs.find(d => d.id === id);
        if (!doc) {
            return res.status(404).json({ error: `Document with ID "${id}" not found.` });
        }
        return res.json(doc);
    }
    catch (err) {
        return res.status(500).json({ error: 'Error fetching document', details: err?.message });
    }
});
/**
 * GET /api/health
 */
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', service: 'Hylite Semantic Search Engine Backend' });
});
app.listen(PORT, () => {
    console.log(`[Server] Hylite Search Backend running on http://localhost:${PORT}`);
});
