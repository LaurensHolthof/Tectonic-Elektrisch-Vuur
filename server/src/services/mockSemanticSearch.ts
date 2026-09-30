import path from 'path';
import { AnnotatedParagraph, HighlightSpan, SearchQuery, SearchResponse, SourceDocument } from '../../../shared/types';
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
      const topicCount = new Set(this.cachedDocuments.map(document => document.topicFolder)).size;
      console.log(`[MockSemanticSearchEngine] Indexed ${this.cachedDocuments.length} documents across ${topicCount} topic folders.`);
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
      const countryOfInterest = doc.countryOfInterest || doc.jurisdiction || 'Global';
      const requestedCountryOfInterest = searchQuery.filters?.countryOfInterest || searchQuery.filters?.jurisdiction;
      if (requestedCountryOfInterest && countryOfInterest !== requestedCountryOfInterest && countryOfInterest !== 'Global') {
        continue;
      }
      if (searchQuery.filters?.countryOfOrigin && doc.countryOfOrigin !== searchQuery.filters.countryOfOrigin) {
        continue;
      }
      if (searchQuery.filters?.sourceType && doc.sourceType !== searchQuery.filters.sourceType) {
        continue;
      }

      const documentMatches: Array<{
        paragraphIndex: number;
        scoreMetrics: AnnotatedParagraph['scoreMetrics'];
        highlights: HighlightSpan[];
      }> = [];

      for (let pIdx = 0; pIdx < doc.paragraphs.length; pIdx++) {
        const paragraphText = doc.paragraphs[pIdx];

        // Compute multi-criteria scores
        const scoreMetrics = this.scoringEngine.scoreParagraph(
          paragraphText,
          doc,
          query,
          allCorpusParagraphs,
          searchQuery.weightsOverride,
          doc.paragraphs.join(' ')
        );

        // Query relevance is a hard retrieval requirement. Document authority
        // can rank matching results, but cannot rescue an unrelated paragraph.
        if (scoreMetrics.semantic < 0.25) {
          continue;
        }

        // Compute exact character offset highlights (Yellow = verified, Red = conflicting)
        const highlights = this.attachConflictSources(
          this.annotator.annotateParagraph(paragraphText, doc, query),
          paragraphText,
          allDocs
        );
        if (highlights.length === 0) {
          continue;
        }

        documentMatches.push({ paragraphIndex: pIdx, scoreMetrics, highlights });
      }

      if (documentMatches.length > 0) {
        const bestMatch = documentMatches.reduce((best, match) =>
          match.scoreMetrics.totalScore > best.scoreMetrics.totalScore ? match : best
        );
        const conflictMatch = documentMatches.find(match =>
          match.highlights.some(highlight => highlight.color === 'red')
        );
        const focalMatch = conflictMatch || bestMatch;
        const context = this.buildContextExcerpt(doc, documentMatches);

        candidates.push({
          paragraphId: `${doc.id}__p${focalMatch.paragraphIndex}`,
          sourceId: doc.id,
          sourceTitle: doc.title,
          sourceType: doc.sourceType,
          topic: doc.topicFolder,
          documentDate: doc.date,
          documentCountryOfOrigin: doc.countryOfOrigin,
          documentCountryOfInterest: doc.countryOfInterest || doc.jurisdiction,
          documentJurisdiction: doc.countryOfInterest || doc.jurisdiction,
          paragraphIndex: focalMatch.paragraphIndex,
          paragraphText: context.text,
          scoreMetrics: focalMatch.scoreMetrics,
          highlights: context.highlights
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

  /**
   * Resolves annotator source aliases and adds the verbatim counterpart passage
   * needed by the client to compare a conflict without leaving the result.
   */
  private attachConflictSources(
    highlights: HighlightSpan[],
    currentParagraphText: string,
    allDocuments: SourceDocument[]
  ): HighlightSpan[] {
    return highlights.map(highlight => {
      if (highlight.color !== 'red' || !highlight.conflictSourceIds?.length) {
        return highlight;
      }

      const comparisonText = currentParagraphText.slice(highlight.startIndex, highlight.endIndex);
      const resolvedDocuments = highlight.conflictSourceIds
        .map(sourceId => allDocuments.find(document =>
          document.id === sourceId || document.id.endsWith(`__${sourceId}`)
        ))
        .filter((document): document is SourceDocument => Boolean(document));

      const conflictSources = resolvedDocuments.map(document => {
        const paragraphIndex = this.findBestComparisonParagraph(
          document,
          `${comparisonText} ${highlight.hoverReason}`
        );

        return {
          sourceId: document.id,
          sourceTitle: document.title,
          sourceType: document.sourceType,
          paragraphIndex,
          paragraphText: document.paragraphs[paragraphIndex] || document.rawContent,
          countryOfOrigin: document.countryOfOrigin,
          countryOfInterest: document.countryOfInterest || document.jurisdiction
        };
      });

      return {
        ...highlight,
        conflictSourceIds: conflictSources.length > 0
          ? conflictSources.map(source => source.sourceId)
          : highlight.conflictSourceIds,
        conflictSources
      };
    });
  }

  private findBestComparisonParagraph(document: SourceDocument, comparisonText: string): number {
    const comparisonTokens = new Set(this.comparisonTokens(comparisonText));
    let bestIndex = 0;
    let bestScore = -1;

    document.paragraphs.forEach((paragraph, index) => {
      const paragraphTokens = new Set(this.comparisonTokens(`${document.title} ${paragraph}`));
      const score = Array.from(comparisonTokens)
        .reduce((total, token) => total + (paragraphTokens.has(token) ? 1 : 0), 0);

      if (score > bestScore) {
        bestScore = score;
        bestIndex = index;
      }
    });

    return bestIndex;
  }

  private comparisonTokens(text: string): string[] {
    const stopWords = new Set([
      'about', 'after', 'against', 'company', 'complete', 'from', 'have', 'into',
      'legally', 'must', 'source', 'that', 'their', 'this', 'under', 'with', 'without'
    ]);

    return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter(token => token.length > 3 && !stopWords.has(token));
  }

  /**
   * Adds up to three source sentences on either side of the matched sentence
   * (two to six surrounding sentences when the source has enough context).
   * Highlight offsets are translated into the larger verbatim excerpt.
   */
  private buildContextExcerpt(
    document: SourceDocument,
    matches: Array<{ paragraphIndex: number; highlights: HighlightSpan[] }>
  ): { text: string; highlights: HighlightSpan[] } {
    const separator = ' ';
    const paragraphOffsets: number[] = [];
    let documentText = '';

    document.paragraphs.forEach((paragraph, index) => {
      paragraphOffsets.push(documentText.length);
      documentText += paragraph;
      if (index < document.paragraphs.length - 1) documentText += separator;
    });

    const globalHighlights = matches.flatMap(match => {
      const paragraphStart = paragraphOffsets[match.paragraphIndex];
      return match.highlights.map(highlight => ({
        ...highlight,
        startIndex: paragraphStart + highlight.startIndex,
        endIndex: paragraphStart + highlight.endIndex
      }));
    });

    const segmenter = new Intl.Segmenter(document.language || undefined, { granularity: 'sentence' });
    const sentences = Array.from(segmenter.segment(documentText))
      .filter(sentence => sentence.segment.trim().length > 0);
    const matchedSentenceIndexes = sentences
      .map((sentence, index) => {
        const sentenceEnd = sentence.index + sentence.segment.length;
        const overlaps = globalHighlights.some(range => sentenceEnd > range.startIndex && sentence.index < range.endIndex);
        return overlaps ? index : -1;
      })
      .filter(index => index >= 0);

    if (matchedSentenceIndexes.length === 0) {
      const fallback = matches[0];
      return { text: document.paragraphs[fallback.paragraphIndex], highlights: fallback.highlights };
    }

    const firstMatched = matchedSentenceIndexes[0];
    const lastMatched = matchedSentenceIndexes[matchedSentenceIndexes.length - 1];
    const firstContext = Math.max(0, firstMatched - 3);
    const lastContext = Math.min(sentences.length - 1, lastMatched + 3);
    let excerptStart = sentences[firstContext].index;
    let excerptEnd = sentences[lastContext].index + sentences[lastContext].segment.length;

    while (excerptStart < excerptEnd && /\s/.test(documentText[excerptStart])) excerptStart++;
    while (excerptEnd > excerptStart && /\s/.test(documentText[excerptEnd - 1])) excerptEnd--;

    return {
      text: documentText.slice(excerptStart, excerptEnd),
      highlights: globalHighlights
        .filter(highlight => highlight.startIndex >= excerptStart && highlight.endIndex <= excerptEnd)
        .map(highlight => ({
          ...highlight,
          startIndex: highlight.startIndex - excerptStart,
          endIndex: highlight.endIndex - excerptStart
        }))
        .sort((a, b) => a.startIndex - b.startIndex)
    };
  }
}
