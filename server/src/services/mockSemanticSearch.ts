import path from 'path';
import { AnnotatedParagraph, SearchQuery, SearchResponse, SourceDocument } from '../../../shared/types';
import { DocumentReader } from './documentReader';
import { EntityScopeRouter } from './entityScopeRouter';
import { ScoringEngine } from './scoringEngine';
import { Annotator } from './annotator';

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
export class MockSemanticSearchEngine {
  private documentReader: DocumentReader;
  private router: EntityScopeRouter;
  private scoringEngine: ScoringEngine;
  private annotator: Annotator;
  private cachedDocuments: SourceDocument[] | null = null;

  constructor(corpusPath?: string) {
    const basePath = corpusPath || path.resolve(__dirname, '../corpus');
    this.documentReader = new DocumentReader(basePath);
    this.router = new EntityScopeRouter();
    this.scoringEngine = new ScoringEngine();
    this.annotator = new Annotator();
  }

  /**
   * Initializes and warms document cache.
   */
  public async initialize(): Promise<void> {
    if (!this.cachedDocuments) {
      this.cachedDocuments = await this.documentReader.loadAllDocuments();
      console.log(`[MockSemanticSearchEngine] Indexed ${this.cachedDocuments.length} documents across 5 topic folders.`);
    }
  }

  public async getDocuments(): Promise<SourceDocument[]> {
    if (!this.cachedDocuments) {
      await this.initialize();
    }
    return this.cachedDocuments || [];
  }

  /**
   * Primary Search API Method.
   * STRICT CONTRACT: Never generates LLM chat text. Slices verbatim paragraphs from source files.
   */
  public async search(searchQuery: SearchQuery): Promise<SearchResponse> {
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
    const allCorpusParagraphs: Array<{ text: string; doc: SourceDocument }> = [];
    allDocs.forEach(doc => {
      doc.paragraphs.forEach(p => {
        allCorpusParagraphs.push({ text: p, doc });
      });
    });

    const candidates: AnnotatedParagraph[] = [];

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
        const scoreMetrics = this.scoringEngine.scoreParagraph(
          paragraphText,
          doc,
          query,
          allCorpusParagraphs,
          searchQuery.weightsOverride
        );

        // Query relevance is a hard retrieval requirement. Document authority
        // can rank matching results, but cannot rescue an unrelated paragraph.
        if (scoreMetrics.semantic < 0.25) {
          continue;
        }

        // Compute exact character offset highlights (Yellow = verified, Red = conflicting)
        const highlights = this.annotator.annotateParagraph(paragraphText, doc, query);

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
          paragraphText, // STRICT: Exact source string preserved
          scoreMetrics,
          highlights
        });
      }
    }

    // Step 3: Sort by Total Composite Score descending
    candidates.sort((a, b) => b.scoreMetrics.totalScore - a.scoreMetrics.totalScore);

    const executionTimeMs = Number((performance.now() - startTime).toFixed(2));

    return {
      query,
      routing: routingInfo,
      results: candidates,
      totalResults: candidates.length,
      scannedCorpusCount: allDocs.length,
      executionTimeMs
    };
  }
}
