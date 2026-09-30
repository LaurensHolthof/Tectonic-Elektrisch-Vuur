"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Annotator = void 0;
/**
 * Annotator
 *
 * Computes exact character offsets [startIndex, endIndex] for inline source highlighting.
 * Generates:
 * - Yellow highlights: Complete source sentences that answer the query.
 * - Red highlights: Complete sentences containing conflicts, risks, or outdated guidance.
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
                pattern: /up to a maximum of €750 per calendar year/i,
                reason: 'OUTDATED POLICY CONFLICT: The former €750 cap was replaced by the active €1,500 Professional Growth Allowance.',
                conflictSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /Only permanent full-time employees with at least twelve consecutive months of service may participate/i,
                reason: 'OUTDATED ELIGIBILITY CONFLICT: Permanent full-time and part-time employees now qualify immediately after completing probation.',
                conflictSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /Self-paced courses, virtual courses, online learning subscriptions, books, software, travel, and examination resits are excluded/i,
                reason: 'OUTDATED COVERAGE CONFLICT: The active policy expressly covers role-relevant online and self-paced courses.',
                conflictSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /written approval from both their department vice president and the Learning and Development Director before registering/i,
                reason: 'OUTDATED APPROVAL CHAIN: A standard request within the allowance requires only the direct manager’s written pre-approval.',
                conflictSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /must repay 100% of the amount/i,
                reason: 'OUTDATED REPAYMENT CONFLICT: Approved learning at or below the active €1,500 allowance has no repayment obligation.',
                conflictSources: ['doc-2-updated-professional-growth-policy']
            },
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
            },
            {
                pattern: /You can work from Portugal for up to 60 days without filing a request/i,
                reason: 'POLICY CONFLICT: This informal approval exceeds Lumen Harbor’s 20-working-day limit and skips the required Payroll, Security, and People Operations review.',
                conflictSources: ['06-lumen-harbor-people-ops__lumen-harbor-hybrid-work-policy']
            },
            {
                pattern: /skip the written improvement plan and move directly to termination/i,
                reason: 'PROCESS RISK: The request bypasses the documented performance process, including clear expectations, support, employee context, and People Operations review.',
                conflictSources: ['06-lumen-harbor-people-ops__lumen-harbor-performance-guide']
            },
            {
                pattern: /upload medical documentation to the shared manager folder/i,
                reason: 'PRIVACY RISK: Medical documentation belongs in the restricted case-management system, not a broadly accessible manager folder.',
                conflictSources: ['06-lumen-harbor-people-ops__lumen-harbor-accommodation-process']
            }
        ];
        // Yellow highlight rules (verified legal answers & high-trust statutory citations)
        const yellowRules = [
            {
                pattern: /professional development allowance of up to €1,500 per calendar year/i,
                reason: 'CURRENT VALID POLICY: Active annual professional development allowance.',
                supportedSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /Eligible expenses include instructor-led or self-paced online courses/i,
                reason: 'CURRENT VALID COVERAGE: Role-relevant online courses are eligible expenses.',
                supportedSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /must obtain written approval from their direct manager before enrolling, purchasing, or making any non-refundable commitment/i,
                reason: 'CURRENT VALID WORKFLOW: Direct-manager approval is required before enrollment or purchase.',
                supportedSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /Standard requests within the €1,500 annual limit do not require approval from a vice president or People Operations/i,
                reason: 'CURRENT VALID WORKFLOW: No VP or People Operations approval is needed for a standard in-limit request.',
                supportedSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /An employee who has passed probation and has not used any of their 2026 allowance may request a €1,400 online data analytics course/i,
                reason: 'CURRENT POLICY EXAMPLE: The requested €1,400 online data analytics course fits within the 2026 allowance.',
                supportedSources: ['doc-2-updated-professional-growth-policy']
            },
            {
                pattern: /budget maximal de 1 500 € par année civile/i,
                reason: 'RÈGLE EN VIGUEUR : Confirmation du budget annuel de développement professionnel.',
                supportedSources: ['doc-3-french-learning-allowance-wiki']
            },
            {
                pattern: /Avant toute inscription, tout achat ou tout engagement non remboursable, le salarié doit obtenir l'accord écrit de son responsable hiérarchique direct/i,
                reason: 'RÈGLE EN VIGUEUR : Accord écrit du responsable direct obligatoire avant l’inscription.',
                supportedSources: ['doc-3-french-learning-allowance-wiki']
            },
            {
                pattern: /Un cours en ligne d'analyse de données coûtant 1 400 € peut être financé sur le budget 2026/i,
                reason: 'EXEMPLE VALIDE : Le wiki français confirme que le cours en ligne de 1 400 € peut être financé.',
                supportedSources: ['doc-3-french-learning-allowance-wiki']
            },
            {
                pattern: /up to €1,500 to spend on approved professional development during the calendar year/i,
                reason: 'OPERATIONAL CONFIRMATION: People Programs confirms the active annual allowance.',
                supportedSources: ['doc-4-supporting-email-learning-allowance']
            },
            {
                pattern: /get their approval in writing before you click enroll or pay the provider/i,
                reason: 'OPERATIONAL CONFIRMATION: The employee announcement restates the manager pre-approval requirement.',
                supportedSources: ['doc-4-supporting-email-learning-allowance']
            },
            {
                pattern: /a role-relevant €1,400 online data analytics course can be covered in full/i,
                reason: 'OPERATIONAL CONFIRMATION: The supporting email confirms full coverage for the example course.',
                supportedSources: ['doc-4-supporting-email-learning-allowance']
            },
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
        // Dynamic source-match highlighter. Relevance filtering happens before this
        // pass, so policies and internal guidance can be surfaced alongside law.
        if (highlights.length === 0) {
            const stopWords = new Set(['what', 'when', 'where', 'which', 'with', 'from', 'that', 'this', 'does', 'have']);
            const queryWords = (query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [])
                .filter(word => word.length > 3 && !stopWords.has(word));
            const titleWords = new Set(doc.title.toLowerCase().match(/[\p{L}\p{N}]+/gu) || []);
            const topicalWords = queryWords.filter(word => !titleWords.has(word));
            const highlightWords = topicalWords.length > 0 ? topicalWords : queryWords;
            const highlightSynonyms = {
                role: ['position', 'title', 'designer', 'engineer', 'analyst', 'specialist'],
                pay: ['salary', 'compensation', 'wage'],
                manager: ['reporting to', 'supervisor']
            };
            for (const word of highlightWords) {
                const lowerParagraph = paragraphText.toLowerCase();
                let matchedTerm = word;
                let idx = lowerParagraph.indexOf(word);
                if (idx === -1) {
                    matchedTerm = (highlightSynonyms[word] || []).find(term => lowerParagraph.includes(term)) || word;
                    idx = lowerParagraph.indexOf(matchedTerm);
                }
                if (idx > -1) {
                    highlights.push({
                        startIndex: idx,
                        endIndex: Math.min(paragraphText.length, idx + matchedTerm.length),
                        color: 'yellow',
                        hoverReason: `This source sentence matches the search topic "${word}".`,
                        supportedSourceIds: [doc.id],
                        severity: 'verified'
                    });
                    break;
                }
            }
        }
        // Every match is expanded to its sentence boundary before overlaps are
        // resolved. The UI therefore never receives a single-word highlight.
        const sentenceHighlights = highlights.map(span => this.expandToSentence(paragraphText, span));
        return this.resolveOverlappingSpans(sentenceHighlights);
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
    expandToSentence(text, span) {
        const segmenter = new Intl.Segmenter(undefined, { granularity: 'sentence' });
        let startIndex;
        let endIndex;
        for (const sentence of segmenter.segment(text)) {
            const sentenceStart = sentence.index;
            const sentenceEnd = sentence.index + sentence.segment.length;
            const overlapsMatch = sentenceEnd > span.startIndex && sentenceStart < span.endIndex;
            if (overlapsMatch) {
                startIndex ??= sentenceStart;
                endIndex = sentenceEnd;
            }
        }
        if (startIndex === undefined || endIndex === undefined) {
            return { ...span, startIndex: 0, endIndex: text.length };
        }
        while (startIndex < endIndex && /\s/.test(text[startIndex]))
            startIndex++;
        while (endIndex > startIndex && /\s/.test(text[endIndex - 1]))
            endIndex--;
        return { ...span, startIndex, endIndex };
    }
}
exports.Annotator = Annotator;
