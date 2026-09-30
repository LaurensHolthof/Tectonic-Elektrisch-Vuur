"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Annotator = void 0;
/**
 * Annotator
 *
 * Computes exact character offsets [startIndex, endIndex] for inline legal highlighting.
 * Generates:
 * - Yellow highlights: Authoritative, verified legal facts & literal answers supported by high-trust sources.
 * - Red highlights: Conflicting, outdated, or legally unenforceable/problematic assertions with detailed paralegal warnings.
 *
 * Production Second Brain Hook:
 * - In a production system, an LLM paralegal auditor or deterministic rule-engine / claim extractor
 *   runs offset matching against grounded citations using exact substring alignment or fuzzy Levenshtein span matching.
 */
class Annotator {
    /**
     * Identifies highlight spans within the exact paragraph text without altering string length.
     */
    annotateParagraph(paragraphText, doc, query) {
        const highlights = [];
        // Red highlight rules (conflicts, legal liabilities, unenforceable terms)
        const redRules = [
            {
                pattern: /2 weeks notice/i,
                reason: 'CRITICAL CONFLICT: Violates German Civil Code (BGB §622(2)). Statutory notice after 2 years must be at least 1 month to the end of a calendar month. Unilateral reduction to 2 weeks is legally null and void.',
                conflictSources: ['german-bgb-notice-severance', 'master-employment-contract-template']
            },
            {
                pattern: /We don't need to offer any severance pay unless they negotiate through an attorney/i,
                reason: 'LEGAL HAZARD: Dismissals without genuine statutory justification expose the company to wrongful termination lawsuits (Kündigungsschutzklage) with back-pay liability.',
                conflictSources: ['german-bgb-notice-severance', 'french-code-du-travail-severance']
            },
            {
                pattern: /give 12 weeks written notice prior to commencing parental leave/i,
                reason: 'STATUTORY CONFLICT: German BEEG §16 caps mandatory notice at 7 weeks (for children under 3). Company handbook policy cannot unilaterally prolong statutory notice obligations.',
                conflictSources: ['statutory-beeg-germany']
            },
            {
                pattern: /all software code, libraries, and open-source contributions created by engineering employees during their tenure are the exclusive property of the company/i,
                reason: 'OVERREACH / UNENFORCEABLE: Under the Employee Inventions Act (ArbEG) and IP doctrine, employer rights are restricted to service inventions. Claims over private weekend work without company resources are legally void.',
                conflictSources: ['german-arbeg-employee-inventions-act', 'master-ip-assignment-agreement']
            },
            {
                pattern: /prohibited from contributing to personal side projects or open-source repositories on weekends without prior VP approval, and any such code automatically assigns to the enterprise without compensation/i,
                reason: 'STATUTORY VIOLATION: ArbEG §9 grants unwaivable statutory rights to reasonable remuneration for inventions. Complete unpaid appropriation of weekend projects violates statutory public policy.',
                conflictSources: ['german-arbeg-employee-inventions-act', 'master-ip-assignment-agreement']
            },
            {
                pattern: /so probably fine for Germany too unless the candidate asks for paper!/i,
                reason: 'REGULATORY VIOLATION: Under the German Nachweisgesetz (NachwG), wet-ink handwritten signatures on physical paper are mandatory for key terms by Day 1. Electronic DocuSign is invalid and incurs administrative fines up to €2,000.',
                conflictSources: ['german-nachweisgesetz-documentation-rules']
            },
            {
                pattern: /company assumes no liability/i,
                reason: 'CORPORATE TAX MISREPRESENTATION: Employees working remotely abroad for over 183 days trigger unavoidable Corporate Permanent Establishment tax liability and mandatory EU A1 social security obligations under EU Reg 883/2004.',
                conflictSources: ['eu-remote-work-crossborder-tax-guideline']
            }
        ];
        // Yellow highlight rules (verified legal answers & high-trust statutory citations)
        const yellowRules = [
            {
                pattern: /seven weeks before the leave begins, provided the leave is taken for the period up to the child's third birthday/i,
                reason: 'VERIFIED STATUTE: Governed by German Federal Parental Allowance and Parental Leave Act (BEEG §16(1)).',
                supportedSources: ['statutory-beeg-germany']
            },
            {
                pattern: /four weeks to the fifteenth day or to the end of a calendar month/i,
                reason: 'VERIFIED STATUTE: Standard statutory baseline notice under German Civil Code (BGB §622(1)).',
                supportedSources: ['german-bgb-notice-severance']
            },
            {
                pattern: /after two years of service, one month to the end of a calendar month; after five years of service, two months to the end of a calendar month; after eight years of service, three months to the end of a calendar month/i,
                reason: 'VERIFIED STATUTE: Graduated statutory employer notice requirements under BGB §622(2).',
                supportedSources: ['german-bgb-notice-severance']
            },
            {
                pattern: /three months prior written notice to the end of a calendar quarter/i,
                reason: 'VERIFIED COVENANT: Standard bilateral contractual clause exceeding statutory minimums, fully enforceable.',
                supportedSources: ['master-employment-contract-template']
            },
            {
                pattern: /one-fourth of a month's salary per year of service for the first ten years/i,
                reason: 'VERIFIED STATUTE: Mandatory minimum statutory redundancy indemnity under French Code du travail (Art. R1234-2).',
                supportedSources: ['french-code-du-travail-severance']
            },
            {
                pattern: /one-third of a month's salary per year of seniority/i,
                reason: 'VERIFIED STATUTE: Enhanced statutory rate for 10+ years tenure under French Code du travail (Art. R1234-2).',
                supportedSources: ['french-code-du-travail-severance']
            },
            {
                pattern: /legally protected right to disconnect from all digital communication tools outside working hours/i,
                reason: 'VERIFIED STATUTE: Statutorily guaranteed under French Code du travail (Art. L. 2242-17).',
                supportedSources: ['french-right-to-disconnect-accord']
            },
            {
                pattern: /No disciplinary action, penalty, or negative evaluation may be imposed on an employee who refuses to respond to emails, messages, or calls between 20:00 and 08:00 and on weekends/i,
                reason: 'VERIFIED PROTECTION: Direct statutory prohibition against retaliatory sanctions under French and EU labor jurisprudence.',
                supportedSources: ['french-right-to-disconnect-accord']
            },
            {
                pattern: /unwaivable statutory right to reasonable remuneration for the claimed invention/i,
                reason: 'VERIFIED STATUTE: Mandatory employee protection under German Employee Inventions Act (ArbEG §9).',
                supportedSources: ['german-arbeg-employee-inventions-act']
            },
            {
                pattern: /written no later than seven weeks/i,
                reason: 'VERIFIED STATUTORY TIMELINE: 7-week notice benchmark under BEEG §16.',
                supportedSources: ['statutory-beeg-germany']
            },
            {
                pattern: /wet-ink signature no later than on the first day of work/i,
                reason: 'VERIFIED STATUTORY REQUIREMENT: Strict wet-ink compliance mandated under German Nachweisgesetz.',
                supportedSources: ['german-nachweisgesetz-documentation-rules']
            },
            {
                pattern: /prohibit any form of retaliation against reporting persons/i,
                reason: 'VERIFIED DIRECTIVE: Mandatory protection under EU Whistleblower Protection Directive 2019/1937.',
                supportedSources: ['eu-whistleblower-protection-directive']
            }
        ];
        // First scan for Red (Conflict) spans
        for (const rule of redRules) {
            this.findAndPushSpans(paragraphText, rule.pattern, 'red', rule.reason, rule.conflictSources, highlights);
        }
        // Next scan for Yellow (Verified) spans
        for (const rule of yellowRules) {
            this.findAndPushSpans(paragraphText, rule.pattern, 'yellow', rule.reason, rule.supportedSources, highlights);
        }
        // Dynamic query term highlighter for top-trust legal passages if no rule triggered yet
        if (highlights.length === 0 && (doc.sourceType === 'statutory_statute' || doc.sourceType === 'master_employment_contract')) {
            const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
            for (const word of queryWords) {
                const idx = paragraphText.toLowerCase().indexOf(word);
                if (idx > -1) {
                    // highlight word and surrounding phrase
                    const start = idx;
                    const end = Math.min(paragraphText.length, idx + word.length);
                    highlights.push({
                        startIndex: start,
                        endIndex: end,
                        color: 'yellow',
                        hoverReason: `Direct literal alignment with search keyword "${word}" in governing ${doc.sourceType.replace(/_/g, ' ')}.`,
                        supportedSourceIds: [doc.id],
                        severity: 'verified'
                    });
                    break;
                }
            }
        }
        // Sort spans by startIndex and eliminate overlaps to guarantee safe UI slicing
        return this.resolveOverlappingSpans(highlights);
    }
    findAndPushSpans(text, pattern, color, reason, sources, highlights) {
        if (typeof pattern === 'string') {
            const idx = text.indexOf(pattern);
            if (idx !== -1) {
                highlights.push({
                    startIndex: idx,
                    endIndex: idx + pattern.length,
                    color,
                    hoverReason: reason,
                    conflictSourceIds: color === 'red' ? sources : undefined,
                    supportedSourceIds: color === 'yellow' ? sources : undefined,
                    severity: color === 'red' ? 'critical' : 'verified'
                });
            }
        }
        else {
            let match;
            const flags = pattern.flags.includes('g') ? pattern.flags : pattern.flags + 'g';
            const regex = new RegExp(pattern.source, flags);
            while ((match = regex.exec(text)) !== null) {
                highlights.push({
                    startIndex: match.index,
                    endIndex: match.index + match[0].length,
                    color,
                    hoverReason: reason,
                    conflictSourceIds: color === 'red' ? sources : undefined,
                    supportedSourceIds: color === 'yellow' ? sources : undefined,
                    severity: color === 'red' ? 'critical' : 'verified'
                });
            }
        }
    }
    /**
     * Sorts spans and resolves any collisions/overlaps so that character slices never corrupt strings.
     */
    resolveOverlappingSpans(spans) {
        if (spans.length <= 1)
            return spans;
        // Sort primarily by startIndex ascending, secondarily by length descending
        spans.sort((a, b) => a.startIndex - b.startIndex || (b.endIndex - b.startIndex) - (a.endIndex - a.startIndex));
        const resolved = [];
        let lastEnd = -1;
        for (const span of spans) {
            if (span.startIndex >= lastEnd) {
                resolved.push(span);
                lastEnd = span.endIndex;
            }
            else if (span.color === 'red') {
                // Red (conflict) takes priority over yellow when overlapping
                const prev = resolved[resolved.length - 1];
                if (prev && prev.color === 'yellow') {
                    resolved.pop();
                    resolved.push(span);
                    lastEnd = span.endIndex;
                }
            }
        }
        return resolved;
    }
}
exports.Annotator = Annotator;
