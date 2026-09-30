"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ScoringEngine = void 0;
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
class ScoringEngine {
    defaultWeights = {
        authority: 0.15,
        recency: 0.10,
        semantic: 0.50,
        crossVerification: 0.15,
        register: 0.10
    };
    referenceDate;
    constructor(referenceDate = new Date('2026-09-30T00:00:00Z')) {
        this.referenceDate = referenceDate;
    }
    /**
     * Calculates complete metrics for a given paragraph within its parent document.
     */
    scoreParagraph(paragraphText, document, query, corpusParagraphs, customWeights) {
        const weights = {
            ...this.defaultWeights,
            ...(customWeights || {})
        };
        const authority = this.calculateAuthority(document.sourceType);
        const recency = this.calculateRecency(document.date);
        const semantic = this.calculateSemanticMatch(paragraphText, document, query);
        const register = this.calculateRegister(document.register);
        const crossVerification = this.calculateCrossVerification(paragraphText, document, corpusParagraphs);
        const weightedQuality = authority * weights.authority +
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
            weightsUsed: weights
        };
    }
    /**
     * 1. Source reliability. This helps order equally relevant material without
     * turning the experience into a law-only search.
     */
    calculateAuthority(sourceType) {
        switch (sourceType) {
            case 'statutory_statute':
                return 1.0;
            case 'master_employment_contract':
                return 0.88;
            case 'internal_hr_policy':
                return 0.70;
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
    calculateRecency(dateStr) {
        try {
            const docDate = new Date(dateStr);
            const diffMs = this.referenceDate.getTime() - docDate.getTime();
            const diffDays = Math.max(0, diffMs / (1000 * 60 * 60 * 24));
            // Half-life ~ 730 days (2 years). Recent docs (0-30 days) score ~0.98, 2 years ~0.50, 4 years ~0.25
            const decayConstant = 0.00095;
            const score = Math.exp(-decayConstant * diffDays);
            return Math.max(0.12, Math.min(1.0, score));
        }
        catch {
            return 0.5;
        }
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
    calculateSemanticMatch(paragraphText, document, query) {
        const searchableText = [document.title, document.jurisdiction, paragraphText]
            .filter(Boolean)
            .join(' ');
        const cleanP = searchableText.toLowerCase();
        const queryTokens = [...new Set(this.tokenize(query))];
        const paragraphTokens = new Set(this.tokenize(searchableText));
        if (queryTokens.length === 0)
            return 0;
        const scoreToken = (token) => {
            if (paragraphTokens.has(token)) {
                return 1;
            }
            return this.hasSynonymMatch(token, cleanP) ? 0.8 : 0;
        };
        const entityTokens = new Set([
            'germany', 'german', 'deutschland', 'berlin', 'munich', 'hamburg',
            'france', 'french', 'paris',
            'uk', 'united', 'kingdom', 'britain', 'british', 'england', 'london',
            'eu', 'europe', 'european', 'union', 'emea'
        ]);
        const topicTokens = queryTokens.filter(token => !entityTokens.has(token));
        const topicHits = topicTokens.reduce((total, token) => total + scoreToken(token), 0);
        // A country or region can narrow the corpus, but it cannot be the only
        // reason a document is considered relevant when the query also has a topic.
        if (topicTokens.length > 0 && topicHits / topicTokens.length < 0.34)
            return 0;
        const hits = queryTokens.reduce((total, token) => total + scoreToken(token), 0);
        if (hits === 0)
            return 0;
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
        return Math.min(0.99, 0.82 * tokenCoverage + 0.18 * phraseStrength);
    }
    /**
     * 4. Cross-Verification: Consensus across multiple distinct documents with differing phrasing.
     *
     * Boosted when distinct sources (especially mixed authority levels, e.g. statute + policy)
     * corroborate the legal premise.
     */
    calculateCrossVerification(paragraphText, currentDoc, corpusParagraphs) {
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
            'nachweisgesetz'
        ].filter(phrase => lowerP.includes(phrase));
        if (keyPhrases.length === 0)
            return 0.40;
        // Find other documents corroborating this topic
        const corroboratingDocs = new Set();
        for (const item of corpusParagraphs) {
            if (item.doc.id === currentDoc.id)
                continue;
            const otherLower = item.text.toLowerCase();
            const matchedPhrases = keyPhrases.filter(kp => otherLower.includes(kp));
            if (matchedPhrases.length >= 1) {
                corroboratingDocs.add(item.doc.id);
            }
        }
        // If verified by 2+ external documents in corpus, award high consensus score
        if (corroboratingDocs.size >= 3)
            return 0.96;
        if (corroboratingDocs.size === 2)
            return 0.85;
        if (corroboratingDocs.size === 1)
            return 0.68;
        return 0.35; // single isolated claim without multi-document confirmation
    }
    /**
     * 5. Language Register: Formal/Statutory > informal
     */
    calculateRegister(register) {
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
    hasSynonymMatch(token, targetText) {
        const synonymMap = {
            dismissal: ['termination', 'severance', 'fire', 'licenciement', 'exit'],
            termination: ['dismissal', 'severance', 'resignation', 'notice period'],
            severance: ['indemnity', 'indemnité', 'package', 'compensation'],
            parental: ['maternity', 'paternity', 'childcare', 'beeg', 'caregiver'],
            invention: ['patent', 'ip', 'proprietary', 'intellectual property', 'software', 'side project'],
            remote: ['work-from-anywhere', 'telework', 'relocation', 'abroad', 'disconnect', 'tax'],
            law: ['statute', 'statutory', 'code', 'bgb', 'act', 'directive', 'nachwg']
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
    tokenize(text) {
        const stopWords = new Set([
            'a', 'an', 'and', 'are', 'at', 'be', 'by', 'do', 'does', 'for', 'from',
            'how', 'in', 'is', 'of', 'on', 'or', 'the', 'to', 'what', 'when', 'with'
        ]);
        return (text.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
            .filter(token => token.length > 1 && !stopWords.has(token))
            .map(token => this.normalizeToken(token));
    }
    normalizeToken(token) {
        if (token.length > 4 && token.endsWith('ies'))
            return `${token.slice(0, -3)}y`;
        if (token.length > 4 && token.endsWith('s') && !token.endsWith('ss'))
            return token.slice(0, -1);
        return token;
    }
}
exports.ScoringEngine = ScoringEngine;
