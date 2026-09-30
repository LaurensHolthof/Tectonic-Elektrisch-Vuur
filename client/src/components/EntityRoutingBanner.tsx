import React from 'react';
import { EntityRoutingInfo } from '../types';
import { ChevronDown, Globe } from 'lucide-react';

interface EntityRoutingBannerProps {
  routing: EntityRoutingInfo;
}

export const EntityRoutingBanner: React.FC<EntityRoutingBannerProps> = ({ routing }) => {
  if (!routing.detectedEntities || routing.detectedEntities.length === 0) {
    return null;
  }

  return (
    <details className="group rounded-lg border border-blue-100 bg-blue-50/60 text-xs text-slate-600 animate-fade-in">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 marker:hidden">
        <Globe className="h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
        <span className="font-medium text-slate-800">
          {routing.detectedEntities.map((entity) => entity.name).join(', ')} detected
        </span>
        <span className="text-slate-400">·</span>
        <span>{routing.injectedDocumentIds.length} governing sources added</span>
        <ChevronDown className="ml-auto h-3.5 w-3.5 text-slate-400 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="border-t border-blue-100 px-9 py-2.5 leading-5 text-slate-500">
        {routing.routingReason}
      </div>
    </details>
  );
};
