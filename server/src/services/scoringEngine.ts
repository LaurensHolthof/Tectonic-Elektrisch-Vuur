import { ScoreBreakdownWeights, ScoreMetrics, SourceDocument, SourceType, LanguageRegister } from '../../../shared/types';

/**
 * ScoringEngine
 * 
 * Implements the multi-criteria ranking algorithm:
 * 1. Source Type (Statute > Contract > Policy > Memo > Email > Slack)
 * 2. Recency (Exponential decay based on document timestamp)
 * 3. Semantic Match (Relevance to user query)
 * 4. Cross-Verification (Consensus boost when corroborated across multiple independent documents)
 * 5. Language Register (Statutory/Formal > Informal/Internal)
 * 
 * Production Second Brain Hook:
 * - Replace mock semantic scoring with Cosine Similarity / Dot Product from vector embeddings
 *   e.g. `cosSim(vectorDB.embed(query), paragraphVector)` via pgvector (`<=>`), Pinecone, or Qdrant.
 * - Replace cross-verification mock with an entity/claim graph or clustering on embedding clusters.
 */
export class ScoringEngine {
  private defaultWeights: ScoreBreakdownWeights = {
    authority: 0.15,
    recency: 0.10,
    semantic: 0.50,
    crossVerification: 0.15,
    register: 0.10
  };

  private referenceDate: Date;

  constructor(referenceDate: Date = new Date('2026-09-30T00:00:00Z')) {
    this.referenceDate = referenceDate;
  }

  /**
   * Calculates complete metrics for a given paragraph within its parent document.
   */
  public scoreParagraph(
    paragraphText: string,
    document: SourceDocument,
    query: string,
    corpusParagraphs: Array<{ text: string; doc: SourceDocument }>,
    customWeights?: Partial<ScoreBreakdownWeights>,
    semanticContext?: string
  ): ScoreMetrics {
    const weights: ScoreBreakdownWeights = {
      ...this.defaultWeights,
      ...(customWeights || {})
    };

    const authority = this.calculateAuthority(document.sourceType);
    const recencyResult = this.calculateRecency(document.date);
    const semanticResult = this.calculateSemanticMatch(semanticContext || paragraphText, document, query);
    const register = this.calculateRegister(document.register);
    const crossVerificationResult = this.calculateCrossVerification(paragraphText, document, corpusParagraphs);
    const recency = recencyResult.score;
    const semantic = semanticResult.score;
    const crossVerification = crossVerificationResult.score;

    const weightedQuality =
      authority * weights.authority +
      recency * weights.recency +
      semantic * weights.semantic +
      crossVerification * weights.crossVerification +
      register * weights.register;

    // Authority and recency help rank relevant matches, but must not make an
    // unrelated paragraph look like a confident answer. Semantic relevance is
    // therefore a gate on the composite document-quality score.
    const relevanceGate = 0.2 + 0.8 * semantic;
    const totalScore = Number((weightedQuality * relevanceGate).toFixed(3));

    return {
      authority: Number(authority.toFixed(3)),
      recency: Number(recency.toFixed(3)),
      semantic: Number(semantic.toFixed(3)),
      crossVerification: Number(crossVerification.toFixed(3)),
      register: Number(register.toFixed(3)),
      totalScore,
      weightsUsed: weights,
      evidence: {
        documentAgeDays: recencyResult.documentAgeDays,
        matchedQueryTermCount: semanticResult.matchedQueryTermCount,
        queryTermCount: semanticResult.queryTermCount,
        corroboratingDocumentCount: crossVerificationResult.corroboratingSourceIds.length,
        corroboratingSourceIds: crossVerificationResult.corroboratingSourceIds
      }
    };
  }

  /**
   * 1. Source reliability. This helps order equally relevant material without
   * turning the experience into a law-only search.
   */
  private calculateAuthority(sourceType: SourceType): number {
    switch (sourceType) {
      case 'statutory_statute':
        return 1.0;
      case 'master_employment_contract':
        return 0.88;
      case 'internal_hr_policy':
        return 0.70;
      case 'employee_record':
        return 0.76;
      case 'internal_memo':
        return 0.48;
      case 'internal_email':
        return 0.22;
      case 'slack_communication':
        return 0.15;
      default:
        return 0.30;
    }
  }

  /**
   * 2. Recency: Newer > older (exponential half-life decay).
   */
  private calculateRecency(dateStr: string): { score: number; documentAgeDays: number | null } {
    const docDate = new Date(dateStr);
    if (Number.isNaN(docDate.getTime())) {
      return { score: 0.5, documentAgeDays: null };
    }

    const diffMs = this.referenceDate.getTime() - docDate.getTime();
    const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));

    // Half-life ~ 730 days (2 years). Recent docs (0-30 days) score ~0.98, 2 years ~0.50, 4 years ~0.25
    const decayConstant = 0.00095;
    const score = Math.exp(-decayConstant * diffDays);
    return {
      score: Math.max(0.12, Math.min(1.0, score)),
      documentAgeDays: Math.round(diffDays)
    };
  }

  /**
   * 3. Semantic Match: Simulates dense vector similarity.
   * 
   * PRODUCTION HOOK:
   * ```typescript
   * const queryEmbedding = await openai.embeddings.create({ input: query, model: "text-embedding-3-large" });
   * const score = cosineSimilarity(queryEmbedding, paragraphEmbedding);
   * ```
   */
  private calculateSemanticMatch(
    paragraphText: string,
    document: SourceDocument,
    query: string
  ): { score: number; matchedQueryTermCount: number; queryTermCount: number } {
    const searchableText = [
      document.title,
      document.countryOfOrigin,
      document.countryOfInterest,
      document.jurisdiction,
      paragraphText
    ]
      .filter(Boolean)
      .join(' ');
    const cleanP = searchableText.toLowerCase();
    const queryTokens = [...new Set(this.tokenize(query))];
    const paragraphTokens = new Set(this.tokenize(searchableText));

    if (queryTokens.length === 0) {
      return { score: 0, matchedQueryTermCount: 0, queryTermCount: 0 };
    }

    const scoreToken = (token: string): number => {
      if (paragraphTokens.has(token)) {
        return 1;
      }
      return this.hasSynonymMatch(token, cleanP) ? 0.8 : 0;
    };

    const entityTokens = new Set([
      'germany', 'german', 'deutschland', 'berlin', 'munich', 'hamburg',
      'france', 'french', 'paris',
      'uk', 'united', 'kingdom', 'britain', 'british', 'england', 'london',
      'spain', 'spanish', 'spanien',
      'eu', 'europe', 'european', 'union', 'emea'
    ]);
    const topicTokens = queryTokens.filter(token => !entityTokens.has(token));
    const topicHits = topicTokens.reduce((total, token) => total + scoreToken(token), 0);
    const matchedQueryTermCount = queryTokens.filter(token => scoreToken(token) > 0).length;

    // A country or region can narrow the corpus, but it cannot be the only
    // reason a document is considered relevant when the query also has a topic.
    if (topicTokens.length > 0 && topicHits / topicTokens.length < 0.34) {
      return { score: 0, matchedQueryTermCount, queryTermCount: queryTokens.length };
    }

    const hits = queryTokens.reduce((total, token) => total + scoreToken(token), 0);

    if (hits === 0) {
      return { score: 0, matchedQueryTermCount: 0, queryTermCount: queryTokens.length };
    }

    const tokenCoverage = hits / queryTokens.length;
    const normalizedParagraph = this.tokenize(searchableText).join(' ');
    const normalizedQuery = queryTokens.join(' ');
    const queryBigrams = queryTokens.slice(0, -1).map((token, index) => `${token} ${queryTokens[index + 1]}`);
    const matchedBigrams = queryBigrams.filter(bigram => normalizedParagraph.includes(bigram)).length;
    const phraseStrength = normalizedParagraph.includes(normalizedQuery)
      ? 1
      : queryBigrams.length > 0
        ? matchedBigrams / queryBigrams.length
        : 1;

    return {
      score: Math.min(0.99, 0.82 * tokenCoverage + 0.18 * phraseStrength),
      matchedQueryTermCount,
      queryTermCount: queryTokens.length
    };
  }

  /**
   * 4. Cross-Verification: Consensus across multiple distinct documents with differing phrasing.
   * 
   * Boosted when distinct sources (especially mixed authority levels, e.g. statute + policy)
   * corroborate the legal premise.
   */
  private calculateCrossVerification(
    paragraphText: string,
    currentDoc: SourceDocument,
    corpusParagraphs: Array<{ text: string; doc: SourceDocument }>
  ): { score: number; corroboratingSourceIds: string[] } {
    const lowerP = paragraphText.toLowerCase();

    // Extract core key phrases
    const keyPhrases = [
      'parental leave',
      'notice period',
      'statutory',
      'termination',
      'remuneration',
      'severance',
      'side projects',
      'probation',
      'right to disconnect',
      'permanent establishment',
      'inventions',
      'wet-ink',
      'nachweisgesetz',
      'workation',
      'remote work',
      'working from abroad',
      'health insurance',
      'emergency medical',
      'line manager'
    ].filter(phrase => lowerP.includes(phrase));

    if (keyPhrases.length === 0) {
      return { score: 0.35, corroboratingSourceIds: [] };
    }

    // Find other documents corroborating this topic
    const corroboratingDocs = new Set<string>();
    for (const item of corpusParagraphs) {
      if (item.doc.id === currentDoc.id) continue;
      const otherLower = item.text.toLowerCase();

      const matchedPhrases = keyPhrases.filter(kp => otherLower.includes(kp));
      if (matchedPhrases.length >= 1) {
        corroboratingDocs.add(item.doc.id);
      }
    }

    // The score remains useful for ranking, while the source IDs are returned
    // as concrete evidence so the UI can show a real document count.
    const corroboratingSourceIds = Array.from(corroboratingDocs);
    if (corroboratingDocs.size >= 3) return { score: 0.96, corroboratingSourceIds };
    if (corroboratingDocs.size === 2) return { score: 0.85, corroboratingSourceIds };
    if (corroboratingDocs.size === 1) return { score: 0.68, corroboratingSourceIds };
    return { score: 0.35, corroboratingSourceIds }; // single isolated claim
  }

  /**
   * 5. Language Register: Formal/Statutory > informal
   */
  private calculateRegister(register: LanguageRegister): number {
    switch (register) {
      case 'statutory_legal':
        return 1.0;
      case 'formal_contractual':
        return 0.88;
      case 'corporate_standard':
        return 0.65;
      case 'informal_internal':
        return 0.25;
      default:
        return 0.50;
    }
  }

  private hasSynonymMatch(token: string, targetText: string): boolean {
    const synonymMap: Record<string, string[]> = {
      dismissal: ['termination', 'severance', 'fire', 'licenciement', 'exit'],
      termination: ['dismissal', 'severance', 'resignation', 'notice period'],
      severance: ['indemnity', 'indemnité', 'package', 'compensation'],
      parental: ['maternity', 'paternity', 'childcare', 'beeg', 'caregiver'],
      invention: ['patent', 'ip', 'proprietary', 'intellectual property', 'software', 'side project'],
      remote: ['work-from-anywhere', 'telework', 'relocation', 'abroad', 'disconnect', 'tax', 'workation', 'mobiles', 'ausland'],
      workation: ['remote', 'work-from-anywhere', 'abroad', 'telework', 'spain', 'spanien', 'allowance', 'working days', 'mobiles', 'ausland'],
      work: ['arbeiten', 'arbeitstage', 'job', 'employment'],
      remotely: ['ausland', 'mobiles', 'remote', 'telework'],
      spain: ['spanien', 'valencia'],
      insurance: ['medical', 'allianz', 'health', 'coverage', 'emergency', 'repatriation', 'krankenversicherung', 'versicherung'],
      allowance: ['quota', 'entitlement', 'days', 'limit', 'cap', 'anspruch'],
      law: ['statute', 'statutory', 'code', 'bgb', 'act', 'directive', 'nachwg', 'richtlinie']
    };

    for (const [key, syns] of Object.entries(synonymMap)) {
      if (token === key || syns.includes(token)) {
        if (targetText.includes(key) || syns.some(s => targetText.includes(s))) {
          return true;
        }
      }
    }
    return false;
  }

  private tokenize(text: string): string[] {
    const stopWords = new Set([
      'a', 'an', 'and', 'are', 'at', 'be', 'by', 'do', 'does', 'for', 'from',
      'how', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'with'
    ]);

    return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
      .filter(token => token.length > 1 && !stopWords.has(token))
      .map(token => this.normalizeToken(token));
  }

  private normalizeToken(token: string): string {
    if (token.length > 4 && token.endsWith('ies')) return `${token.slice(0, -3)}y`;
    if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss')) return token.slice(0, -1);
    return token;
  }
}
