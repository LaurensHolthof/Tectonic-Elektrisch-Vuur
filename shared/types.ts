/**
 * Shared TypeScript definitions for Digital HR Paralegal Semantic Search Engine.
 * 
 * Strict API Contract: The backend MUST NOT generate new conversational text;
 * it returns exact paragraph excerpts accompanied by character offsets and legal annotations.
 */

export type SourceType =
  | 'statutory_statute'        // e.g. German BGB, French Code du Travail, UK Employment Rights Act
  | 'master_employment_contract' // Standard executed bilateral agreements
  | 'internal_hr_policy'       // Official company handbook / global policy
  | 'internal_memo'            // HR memo / department guidelines
  | 'internal_email'           // Informal communications, supervisor emails
  | 'slack_communication';     // Chat logs / instant messages

export type LanguageRegister =
  | 'statutory_legal'      // Statutory provisions, statutory codes (highest formal weight)
  | 'formal_contractual'    // Binding bilateral covenants, master templates
  | 'corporate_standard'   // Human resources handbooks, operational standards
  | 'informal_internal';   // Casual communications, slack messages, quick email notes

export type HighlightColor = 'yellow' | 'red';

export interface HighlightSpan {
  startIndex: number;        // Inclusive character start index within paragraphText
  endIndex: number;          // Exclusive character end index within paragraphText
  color: HighlightColor;     // 'yellow' for verified answers; 'red' for conflicting/problematic terms
  hoverReason: string;       // Legal explanation displayed on hover (e.g. why conflicting or verified)
  conflictSourceIds?: string[]; // IDs of documents presenting conflicting covenants or provisions
  supportedSourceIds?: string[];// IDs of authoritative documents corroborating this clause
  severity?: 'critical' | 'warning' | 'verified';
}

export interface ScoreBreakdownWeights {
  authority: number;
  recency: number;
  semantic: number;
  crossVerification: number;
  register: number;
}

export interface ScoreMetrics {
  authority: number;          // 0.0 - 1.0 based on SourceType (Statutory = 1.0 > Email = 0.2)
  recency: number;            // 0.0 - 1.0 based on recency decay (recent > 2 years ago)
  semantic: number;           // 0.0 - 1.0 vector / semantic relevance score
  crossVerification: number;  // 0.0 - 1.0 boost if literal consensus exists across multiple documents
  register: number;           // 0.0 - 1.0 based on formality of legal register
  totalScore: number;         // 0.0 - 1.0 weighted aggregate composite score
  weightsUsed: ScoreBreakdownWeights;
}

export interface AnnotatedParagraph {
  paragraphId: string;
  sourceId: string;
  sourceTitle: string;
  sourceType: SourceType;
  topic: string;
  documentDate: string;       // ISO 8601 string (e.g., '2026-04-10')
  documentJurisdiction?: string; // e.g., 'Germany', 'France', 'United Kingdom', 'California'
  paragraphIndex: number;
  paragraphText: string;      // The EXACT text slice from the source document (NO conversational LLM text)
  scoreMetrics: ScoreMetrics;
  highlights: HighlightSpan[];
}

export interface DetectedEntity {
  name: string;
  type: 'country' | 'language' | 'region';
  matchedTerm: string;
}

export interface EntityRoutingInfo {
  detectedEntities: DetectedEntity[];
  injectedDocumentIds: string[];
  routingReason: string;
}

export interface SearchQuery {
  query: string;
  filters?: {
    topic?: string;
    jurisdiction?: string;
    sourceType?: SourceType;
  };
  weightsOverride?: Partial<ScoreBreakdownWeights>;
}

export interface SearchResponse {
  query: string;
  routing: EntityRoutingInfo;
  results: AnnotatedParagraph[];
  totalResults: number;
  scannedCorpusCount: number;
  executionTimeMs: number;
}

export interface SourceDocument {
  id: string;
  title: string;
  filePath: string;
  fileFormat: 'pdf' | 'txt' | 'md' | 'docx';
  topicFolder: string;
  sourceType: SourceType;
  date: string;               // ISO 8601 string
  jurisdiction?: string;
  language: string;
  register: LanguageRegister;
  rawContent: string;
  paragraphs: string[];
}
