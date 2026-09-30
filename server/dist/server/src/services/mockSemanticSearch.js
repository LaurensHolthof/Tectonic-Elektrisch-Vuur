"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockSemanticSearchEngine = void 0;
const path_1 = __importDefault(require("path"));
const documentReader_1 = require("./documentReader");
const entityScopeRouter_1 = require("./entityScopeRouter");
const scoringEngine_1 = require("./scoringEngine");
const annotator_1 = require("./annotator");
/**
 * MockSemanticSearchEngine
 *
 * Central orchestrator for the HR Paralegal Semantic Search Engine.
 * Implements strict non-conversational retrieval: returns verbatim paragraphs with offset annotations.
 *
 * =========================================================================================
 * PRODUCTION "SECOND BRAIN" INTEGRATION HOOKS:
 * =========================================================================================
 * In a production architecture (e.g. pgvector, Pinecone, Qdrant, Milvus, Weaviate):
 *
 * 1. INGRESS & EMBEDDING PIPELINE:
 *    - Ingest PDF/DOCX using Unstructured / LlamaParse.
 *    - Chunk into semantic paragraphs with hierarchical metadata (docId, section, breadcrumbs).
 *    - Compute dense vector embeddings: `const embedding = await cohere.embed({ texts: [chunk] })`
 *      or OpenAI `text-embedding-3-large` (3072 dims) or Voyage-law-2.
 *    - Upsert vector + payload into vector database.
 *
 * 2. HYBRID QUERY EXECUTION (Dense Semantic + Sparse BM25 + Metadata Filter):
 *    ```typescript
 *    const results = await pinecone.index('hr-corpus').query({
 *      vector: queryEmbedding,
 *      topK: 50,
 *      filter: routingInfo.injectedDocumentIds.length > 0
 *        ? { $or: [{ jurisdiction: { $in: detectedCountries } }, { id: { $in: injectedDocIds } }] }
 *        : undefined,
 *      includeMetadata: true
 *    });
 *    ```
 *
 * 3. CROSS-VERIFICATION GRAPH:
 *    - Run an asynchronous graph claim-verification pass (e.g. Neo4j or vector clustering)
 *      to cross-reference statutory clauses against company handbooks.
 * =========================================================================================
 */
class MockSemanticSearchEngine {
    documentReader;
    router;
    scoringEngine;
    annotator;
    cachedDocuments = null;
    constructor(corpusPath) {
        const basePath = corpusPath || path_1.default.resolve(__dirname, '../corpus');
        this.documentReader = new documentReader_1.DocumentReader(basePath);
        this.router = new entityScopeRouter_1.EntityScopeRouter();
        this.scoringEngine = new scoringEngine_1.ScoringEngine();
        this.annotator = new annotator_1.Annotator();
    }
    /**
     * Initializes and warms document cache.
     */
    async initialize() {
        if (!this.cachedDocuments) {
            this.cachedDocuments = await this.documentReader.loadAllDocuments();
            console.log(`[MockSemanticSearchEngine] Indexed ${this.cachedDocuments.length} documents across 5 topic folders.`);
        }
    }
    async getDocuments() {
        if (!this.cachedDocuments) {
            await this.initialize();
        }
        return this.cachedDocuments || [];
    }
    /**
     * Primary Search API Method.
     * STRICT CONTRACT: Never generates LLM chat text. Slices verbatim paragraphs from source files.
     */
    async search(searchQuery) {
        const startTime = performance.now();
        await this.initialize();
        const allDocs = this.cachedDocuments || [];
        const query = searchQuery.query.trim();
        if (!query) {
            return {
                query: '',
                routing: {
                    detectedEntities: [],
                    injectedDocumentIds: [],
                    routingReason: 'Empty query received.'
                },
                results: [],
                totalResults: 0,
                scannedCorpusCount: allDocs.length,
                executionTimeMs: 0
            };
        }
        // Step 1: Entity Scope Routing (Detect country/language/region & inject legal docs)
        const { routedDocuments, routingInfo } = this.router.routeScope(query, allDocs);
        // Flatten all candidate paragraphs for cross-verification calculations
        const allCorpusParagraphs = [];
        allDocs.forEach(doc => {
            doc.paragraphs.forEach(p => {
                allCorpusParagraphs.push({ text: p, doc });
            });
        });
        const candidates = [];
        // Step 2: Scoring & Annotation pass across candidate documents
        for (const doc of routedDocuments) {
            // Optional filter checks
            if (searchQuery.filters?.topic && !doc.topicFolder.includes(searchQuery.filters.topic)) {
                continue;
            }
            if (searchQuery.filters?.jurisdiction && doc.jurisdiction !== searchQuery.filters.jurisdiction && doc.jurisdiction !== 'Global') {
                continue;
            }
            if (searchQuery.filters?.sourceType && doc.sourceType !== searchQuery.filters.sourceType) {
                continue;
            }
            for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
                const paragraphText = doc.paragraphs[pIdx];
                // Compute multi-criteria scores
                const scoreMetrics = this.scoringEngine.scoreParagraph(paragraphText, doc, query, allCorpusParagraphs, searchQuery.weightsOverride);
                // Query relevance is a hard retrieval requirement. Document authority
                // can rank matching results, but cannot rescue an unrelated paragraph.
                if (scoreMetrics.semantic < 0.25) {
                    continue;
                }
                // Compute exact character offset highlights (Yellow = verified, Red = conflicting)
                const highlights = this.annotator.annotateParagraph(paragraphText, doc, query);
                const context = this.buildContextExcerpt(doc, pIdx, highlights);
                // If the paragraph contains critical conflicts (Red highlight), ensure visibility
                const hasRedConflict = highlights.some(h => h.color === 'red');
                if (hasRedConflict) {
                    // Keep conflict visible for paralegal review even if semantic query was broad
                }
                candidates.push({
                    paragraphId: `${doc.id}__p${pIdx}`,
                    sourceId: doc.id,
                    sourceTitle: doc.title,
                    sourceType: doc.sourceType,
                    topic: doc.topicFolder,
                    documentDate: doc.date,
                    documentJurisdiction: doc.jurisdiction,
                    paragraphIndex: pIdx,
                    paragraphText: context.text,
                    scoreMetrics,
                    highlights: context.highlights
                });
            }
        }
        // Step 3: Sort by Total Composite Score descending
        candidates.sort((a, b) => b.scoreMetrics.totalScore - a.scoreMetrics.totalScore);
        // Adjacent hits often produce the same context window. Keep one focal
        // sentence per card instead of repeating the excerpt or highlighting all
        // of its context. A conflict takes precedence over a regular source match.
        const deduplicated = new Map();
        for (const candidate of candidates) {
            const key = `${candidate.sourceId}\u0000${candidate.paragraphText}`;
            const existing = deduplicated.get(key);
            if (!existing) {
                deduplicated.set(key, candidate);
                continue;
            }
            const existingHasConflict = existing.highlights.some(highlight => highlight.color === 'red');
            const candidateHasConflict = candidate.highlights.some(highlight => highlight.color === 'red');
            if (candidateHasConflict && !existingHasConflict)
                deduplicated.set(key, candidate);
        }
        const results = Array.from(deduplicated.values());
        const executionTimeMs = Number((performance.now() - startTime).toFixed(2));
        return {
            query,
            routing: routingInfo,
            results,
            totalResults: results.length,
            scannedCorpusCount: allDocs.length,
            executionTimeMs
        };
    }
    /**
     * Adds up to three source sentences on either side of the matched sentence
     * (two to six surrounding sentences when the source has enough context).
     * Highlight offsets are translated into the larger verbatim excerpt.
     */
    buildContextExcerpt(document, paragraphIndex, highlights) {
        const separator = ' ';
        const paragraphOffsets = [];
        let documentText = '';
        document.paragraphs.forEach((paragraph, index) => {
            paragraphOffsets.push(documentText.length);
            documentText += paragraph;
            if (index < document.paragraphs.length - 1)
                documentText += separator;
        });
        const paragraphStart = paragraphOffsets[paragraphIndex];
        const paragraphEnd = paragraphStart + document.paragraphs[paragraphIndex].length;
        const globalHighlights = highlights.map(highlight => ({
            ...highlight,
            startIndex: paragraphStart + highlight.startIndex,
            endIndex: paragraphStart + highlight.endIndex
        }));
        const targetRanges = globalHighlights.length > 0
            ? globalHighlights
            : [{ startIndex: paragraphStart, endIndex: paragraphEnd }];
        const segmenter = new Intl.Segmenter(document.language || undefined, { granularity: 'sentence' });
        const sentences = Array.from(segmenter.segment(documentText))
            .filter(sentence => sentence.segment.trim().length > 0);
        const matchedSentenceIndexes = sentences
            .map((sentence, index) => {
            const sentenceEnd = sentence.index + sentence.segment.length;
            const overlaps = targetRanges.some(range => sentenceEnd > range.startIndex && sentence.index < range.endIndex);
            return overlaps ? index : -1;
        })
            .filter(index => index >= 0);
        if (matchedSentenceIndexes.length === 0) {
            return { text: document.paragraphs[paragraphIndex], highlights };
        }
        const firstMatched = matchedSentenceIndexes[0];
        const lastMatched = matchedSentenceIndexes[matchedSentenceIndexes.length - 1];
        const firstContext = Math.max(0, firstMatched - 3);
        const lastContext = Math.min(sentences.length - 1, lastMatched + 3);
        let excerptStart = sentences[firstContext].index;
        let excerptEnd = sentences[lastContext].index + sentences[lastContext].segment.length;
        while (excerptStart < excerptEnd && /\s/.test(documentText[excerptStart]))
            excerptStart++;
        while (excerptEnd > excerptStart && /\s/.test(documentText[excerptEnd - 1]))
            excerptEnd--;
        return {
            text: documentText.slice(excerptStart, excerptEnd),
            highlights: globalHighlights.map(highlight => ({
                ...highlight,
                startIndex: highlight.startIndex - excerptStart,
                endIndex: highlight.endIndex - excerptStart
            }))
        };
    }
}
exports.MockSemanticSearchEngine = MockSemanticSearchEngine;
