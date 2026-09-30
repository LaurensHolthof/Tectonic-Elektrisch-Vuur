"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DocumentReader = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
/**
 * Interface-driven document reader.
 * Reads documents from the local topic folders (TXT, MD, DOCX, PDF).
 *
 * In production:
 * - PDF documents are extracted via `pdf-parse` or OCR pipeline (e.g., Unstructured.io, AWS Textract).
 * - DOCX documents are extracted via `mammoth` or `docx-parser`.
 * - Chunking strategies (sliding window or paragraph-aware chunkers) integrate with LangChain / LlamaIndex.
 */
class DocumentReader {
    static SUPPORTED_EXTENSIONS = new Set(['pdf', 'txt', 'md', 'docx']);
    corpusBasePath;
    constructor(corpusBasePath) {
        this.corpusBasePath = path_1.default.resolve(corpusBasePath);
    }
    /**
     * Scans all topic folders and returns parsed SourceDocument instances.
     */
    async loadAllDocuments() {
        const documents = [];
        if (!fs_1.default.existsSync(this.corpusBasePath)) {
            console.warn(`[DocumentReader] Corpus directory not found: ${this.corpusBasePath}`);
            return documents;
        }
        const topicFolders = fs_1.default.readdirSync(this.corpusBasePath, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);
        for (const folder of topicFolders) {
            const folderPath = path_1.default.join(this.corpusBasePath, folder);
            const files = fs_1.default.readdirSync(folderPath, { withFileTypes: true })
                .filter(dirent => dirent.isFile() &&
                !dirent.name.startsWith('.') &&
                dirent.name.toLowerCase() !== 'question.txt');
            for (const file of files) {
                const filePath = path_1.default.resolve(folderPath, file.name);
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
    parseDocumentFile(filePath, topicFolder, fileName) {
        try {
            const ext = path_1.default.extname(fileName).toLowerCase().replace('.', '');
            if (fileName !== path_1.default.basename(fileName) ||
                !DocumentReader.SUPPORTED_EXTENSIONS.has(ext) ||
                !this.isPathWithinCorpus(filePath)) {
                console.warn(`[DocumentReader] Skipping invalid corpus file path: ${filePath}`);
                return null;
            }
            // filePath is constructed from directory entries under corpusBasePath and
            // is containment-checked above; request data never reaches this file read.
            const rawText = fs_1.default.readFileSync(path_1.default.resolve(filePath), 'utf-8');
            const { metadata, content } = this.extractMetadata(rawText, fileName, ext);
            const sourceType = metadata.sourceType || this.inferSourceType(fileName);
            const countryOfInterest = metadata.countryOfInterest || metadata.jurisdiction || 'Global';
            const countryOfOrigin = metadata.countryOfOrigin || this.inferCountryOfOrigin(sourceType, countryOfInterest);
            // Cleanly split into paragraphs by double newlines, preserving exact paragraph strings
            const paragraphs = content
                .split(/\r?\n\s*\r?\n/)
                .map(p => p.trim())
                .filter(p => p.length > 20); // ignore empty or single-word noise
            const id = `${topicFolder}__${path_1.default.parse(fileName).name}`;
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
        }
        catch (err) {
            console.error(`[DocumentReader] Error parsing ${filePath}:`, err);
            return null;
        }
    }
    isPathWithinCorpus(filePath) {
        const relativePath = path_1.default.relative(this.corpusBasePath, path_1.default.resolve(filePath));
        return relativePath.length > 0 &&
            relativePath !== '..' &&
            !relativePath.startsWith(`..${path_1.default.sep}`) &&
            !path_1.default.isAbsolute(relativePath);
    }
    /**
     * Extracts YAML-style header metadata if present, or provides default fallback metadata.
     */
    extractMetadata(rawContent, fileName, ext) {
        const frontmatterRegex = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;
        const match = rawContent.match(frontmatterRegex);
        if (match) {
            const yamlBlock = match[1];
            const bodyContent = match[2];
            const meta = {};
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
                    sourceType: meta.sourceType,
                    date: meta.date,
                    jurisdiction: meta.jurisdiction,
                    countryOfOrigin: meta.countryOfOrigin,
                    countryOfInterest: meta.countryOfInterest,
                    language: meta.language,
                    register: meta.register
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
    inferSourceType(fileName) {
        const lower = fileName.toLowerCase();
        if (lower.includes('statut') || lower.includes('act') || lower.includes('code') || lower.includes('bgb'))
            return 'statutory_statute';
        if (lower.includes('contract') || lower.includes('agreement') || lower.includes('piia'))
            return 'master_employment_contract';
        if (lower.includes('employee-file') || lower.includes('employee-record'))
            return 'employee_record';
        if (lower.includes('policy') || lower.includes('handbook'))
            return 'internal_hr_policy';
        if (lower.includes('memo') || lower.includes('guidelines'))
            return 'internal_memo';
        if (lower.includes('slack') || lower.includes('chat'))
            return 'slack_communication';
        return 'internal_email';
    }
    inferRegister(sourceType) {
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
    inferCountryOfOrigin(sourceType, countryOfInterest) {
        // For national legislation the issuing country is unambiguous. Other
        // source types need an explicit frontmatter value; their scope alone does
        // not tell us where the document was produced.
        if (sourceType === 'statutory_statute' && countryOfInterest !== 'Global') {
            return countryOfInterest;
        }
        return undefined;
    }
}
exports.DocumentReader = DocumentReader;
