import { DetectedEntity, EntityRoutingInfo, SourceDocument } from '../../../shared/types';

/**
 * EntityScopeRouter
 * 
 * Inspects incoming semantic queries for entity signals (countries, languages, regions, jurisdictions).
 * When recognized, automatically injects high-trust statutory and master-contract documents
 * covering those jurisdictions into the active search scope.
 * 
 * In production:
 * - This interfaces with an NER (Named Entity Recognition) model (e.g., spaCy, GLiNER, or an LLM classifier).
 * - Queries a metadata-filtered vector index (e.g. Pinecone metadata filters: `{ jurisdiction: { $in: [...] } }`).
 */
export class EntityScopeRouter {
  private entityRules: Array<{
    name: string;
    type: 'country' | 'language' | 'region';
    keywords: string[];
    targetJurisdiction: string;
  }> = [
    {
      name: 'Germany',
      type: 'country',
      keywords: ['germany', 'german', 'deutschland', 'berlin', 'munich', 'hamburg', 'bgb', 'nachwg', 'arbeg', 'beeg'],
      targetJurisdiction: 'Germany'
    },
    {
      name: 'France',
      type: 'country',
      keywords: ['france', 'french', 'paris', 'code du travail', 'macron', 'r1234-2', 'l. 2242-17'],
      targetJurisdiction: 'France'
    },
    {
      name: 'United Kingdom',
      type: 'country',
      keywords: ['uk', 'united kingdom', 'britain', 'british', 'england', 'london', 'employment rights act'],
      targetJurisdiction: 'United Kingdom'
    },
    {
      name: 'European Union',
      type: 'region',
      keywords: ['eu', 'european union', 'europe', 'cross-border', 'a1 certificate', 'emea', 'whistleblower directive'],
      targetJurisdiction: 'Global' // or EU cross-border
    }
  ];

  /**
   * Evaluates a query and returns routed candidate documents and entity routing metadata.
   */
  public routeScope(query: string, allDocuments: SourceDocument[]): {
    routedDocuments: SourceDocument[];
    routingInfo: EntityRoutingInfo;
  } {
    const lowerQuery = query.toLowerCase();
    const detectedEntities: DetectedEntity[] = [];
    const injectedDocIds = new Set<string>();

    for (const rule of this.entityRules) {
      const matchedKeyword = rule.keywords.find(kw => {
        // match word boundaries to prevent false positives
        const regex = new RegExp(`\\b${kw.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}\\b`, 'i');
        return regex.test(lowerQuery);
      });

      if (matchedKeyword) {
        detectedEntities.push({
          name: rule.name,
          type: rule.type,
          matchedTerm: matchedKeyword
        });

        // Find statutory and legal documents corresponding to this entity
        const entityDocs = allDocuments.filter(doc => 
          (doc.jurisdiction?.toLowerCase() === rule.targetJurisdiction.toLowerCase() ||
           doc.jurisdiction === 'Global') &&
          (doc.sourceType === 'statutory_statute' || doc.sourceType === 'master_employment_contract')
        );

        entityDocs.forEach(d => injectedDocIds.add(d.id));
      }
    }

    const injectedList = Array.from(injectedDocIds);
    let routingReason = '';

    if (detectedEntities.length > 0) {
      const entityNames = detectedEntities.map(e => `${e.name} (${e.type}: "${e.matchedTerm}")`).join(', ');
      routingReason = `Detected jurisdictional entities: ${entityNames}. Injected ${injectedList.length} governing statutory & master contract documents into search scope.`;
    } else {
      routingReason = 'Standard multi-topic scope active; no explicit single-jurisdiction override triggered.';
    }

    // Combine injected statutory documents with documents matching detected jurisdictions or Global
    const finalDocPool = allDocuments.filter(doc => {
      // Always include if explicitly injected
      if (injectedDocIds.has(doc.id)) return true;
      // If no specific entity detected, include all documents
      if (detectedEntities.length === 0) return true;
      // Keep documents that match detected jurisdiction OR are Global
      const matchesJurisdiction = detectedEntities.some(entity => {
        const rule = this.entityRules.find(r => r.name === entity.name);
        return rule && doc.jurisdiction?.toLowerCase() === rule.targetJurisdiction.toLowerCase();
      });
      return matchesJurisdiction || doc.jurisdiction === 'Global';
    });

    return {
      routedDocuments: finalDocPool.length > 0 ? finalDocPool : allDocuments,
      routingInfo: {
        detectedEntities,
        injectedDocumentIds: injectedList,
        routingReason
      }
    };
  }
}
