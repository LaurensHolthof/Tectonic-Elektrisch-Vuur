import fs from 'fs';
import path from 'path';
import { SourceDocument, SourceType, LanguageRegister } from '../../../shared/types';

/**
 * Interface-driven document reader.
 * Reads documents from the local topic folders (TXT, MD, DOCX, PDF).
 * 
 * In production:
 * - PDF documents are extracted via `pdf-parse` or OCR pipeline (e.g., Unstructured.io, AWS Textract).
 * - DOCX documents are extracted via `mammoth` or `docx-parser`.
 * - Chunking strategies (sliding window or paragraph-aware chunkers) integrate with LangChain / LlamaIndex.
 */
export class DocumentReader {
  private corpusBasePath: string;

  constructor(corpusBasePath: string) {
    this.corpusBasePath = corpusBasePath;
  }

  /**
   * Scans all topic folders and returns parsed SourceDocument instances.
   */
  public async loadAllDocuments(): Promise<SourceDocument[]> {
    const documents: SourceDocument[] = [];
    if (!fs.existsSync(this.corpusBasePath)) {
      console.warn(`[DocumentReader] Corpus directory not found: ${this.corpusBasePath}`);
      return documents;
    }

    const topicFolders = fs.readdirSync(this.corpusBasePath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folder of topicFolders) {
      const folderPath = path.join(this.corpusBasePath, folder);
      const files = fs.readdirSync(folderPath, { withFileTypes: true })
        .filter(dirent => dirent.isFile() && !dirent.name.startsWith('.'));

      for (const file of files) {
        const filePath = path.join(folderPath, file.name);
        const parsedDoc = this.parseDocumentFile(filePath, folder, file.name);
        if (parsedDoc) {
          documents.push(parsedDoc);
        }
      }
    }

    return documents;
  }

  /**
   * Parses an individual file and extracts frontmatter metadata + paragraphs.
   */
  private parseDocumentFile(filePath: string, topicFolder: string, fileName: string): SourceDocument | null {
    try {
      const ext = path.extname(fileName).toLowerCase().replace('.', '') as 'pdf' | 'txt' | 'md' | 'docx';
      const rawText = fs.readFileSync(filePath, 'utf-8');

      const { metadata, content } = this.extractMetadata(rawText, fileName, ext);
      const sourceType = metadata.sourceType || this.inferSourceType(fileName);
      const countryOfInterest = metadata.countryOfInterest || metadata.jurisdiction || 'Global';
      const countryOfOrigin = metadata.countryOfOrigin || this.inferCountryOfOrigin(sourceType, countryOfInterest);

      // Cleanly split into paragraphs by double newlines, preserving exact paragraph strings
      const paragraphs = content
        .split(/\r?\n\s*\r?\n/)
        .map(p => p.trim())
        .filter(p => p.length > 20); // ignore empty or single-word noise

      const id = `${topicFolder}__${path.parse(fileName).name}`;

      return {
        id,
        title: metadata.title || fileName,
        filePath,
        fileFormat: ext,
        topicFolder,
        sourceType,
        date: metadata.date || '2025-01-01',
        countryOfOrigin,
        countryOfInterest,
        jurisdiction: countryOfInterest,
        language: metadata.language || 'en',
        register: metadata.register || this.inferRegister(metadata.sourceType),
        rawContent: content,
        paragraphs
      };
    } catch (err) {
      console.error(`[DocumentReader] Error parsing ${filePath}:`, err);
      return null;
    }
  }

  /**
   * Extracts YAML-style header metadata if present, or provides default fallback metadata.
   */
  private extractMetadata(rawContent: string, fileName: string, ext: string): { metadata: Partial<SourceDocument>; content: string } {
    const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
    const match = rawContent.match(frontmatterRegex);

    if (match) {
      const yamlBlock = match[1];
      const bodyContent = match[2];
      const meta: Record<string, any> = {};

      yamlBlock.split(/\r?\n/).forEach(line => {
        const colonIdx = line.indexOf(':');
        if (colonIdx > -1) {
          const key = line.slice(0, colonIdx).trim();
          const val = line.slice(colonIdx + 1).trim();
          meta[key] = val;
        }
      });

      return {
        metadata: {
          title: meta.title,
          sourceType: meta.sourceType as SourceType,
          date: meta.date,
          jurisdiction: meta.jurisdiction,
          countryOfOrigin: meta.countryOfOrigin,
          countryOfInterest: meta.countryOfInterest,
          language: meta.language,
          register: meta.register as LanguageRegister
        },
        content: bodyContent.trim()
      };
    }

    return {
      metadata: {
        title: fileName.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '),
        sourceType: this.inferSourceType(fileName)
      },
      content: rawContent.trim()
    };
  }

  private inferSourceType(fileName: string): SourceType {
    const lower = fileName.toLowerCase();
    if (lower.includes('statut') || lower.includes('act') || lower.includes('code') || lower.includes('bgb')) return 'statutory_statute';
    if (lower.includes('contract') || lower.includes('agreement') || lower.includes('piia')) return 'master_employment_contract';
    if (lower.includes('employee-file') || lower.includes('employee-record')) return 'employee_record';
    if (lower.includes('policy') || lower.includes('handbook')) return 'internal_hr_policy';
    if (lower.includes('memo') || lower.includes('guidelines')) return 'internal_memo';
    if (lower.includes('slack') || lower.includes('chat')) return 'slack_communication';
    return 'internal_email';
  }

  private inferRegister(sourceType?: SourceType): LanguageRegister {
    switch (sourceType) {
      case 'statutory_statute':
        return 'statutory_legal';
      case 'master_employment_contract':
        return 'formal_contractual';
      case 'internal_hr_policy':
      case 'employee_record':
      case 'internal_memo':
        return 'corporate_standard';
      default:
        return 'informal_internal';
    }
  }

  private inferCountryOfOrigin(sourceType: SourceType, countryOfInterest: string): string | undefined {
    // For national legislation the issuing country is unambiguous. Other
    // source types need an explicit frontmatter value; their scope alone does
    // not tell us where the document was produced.
    if (sourceType === 'statutory_statute' && countryOfInterest !== 'Global') {
      return countryOfInterest;
    }
    return undefined;
  }
}
