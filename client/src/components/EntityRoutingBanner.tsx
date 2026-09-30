import React from 'react';
import { EntityRoutingInfo } from '../types';
import { Globe, ArrowRight, ShieldCheck, Layers } from 'lucide-react';

interface EntityRoutingBannerProps {
  routing: EntityRoutingInfo;
}

export const EntityRoutingBanner: React.FC<EntityRoutingBannerProps> = ({ routing }) => {
  if (!routing.detectedEntities || routing.detectedEntities.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-3xl mx-auto my-4 p-3 bg-gradient-to-r from-blue-50/80 via-indigo-50/80 to-purple-50/80 rounded-xl border border-blue-200/80 text-xs text-slate-700 shadow-sm animate-fade-in">
      <div className="flex items-start gap-2.5">
        <div className="p-1.5 bg-blue-600 text-white rounded-lg mt-0.5">
          <Globe className="w-4 h-4" />
        </div>

        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span className="font-semibold text-slate-900">
              Autonomous Entity Scope Injection
            </span>
            <div className="flex items-center gap-1">
              {routing.detectedEntities.map((entity) => (
                <span
                  key={entity.name}
                  className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 font-mono text-[11px] font-semibold border border-blue-200"
                >
                  {entity.name} ({entity.type})
                </span>
              ))}
            </div>
          </div>

          <p className="text-slate-600 leading-relaxed text-[11px]">
            {routing.routingReason}
          </p>

          <div className="mt-1.5 pt-1.5 border-t border-blue-200/50 flex items-center justify-between text-[11px] text-blue-700">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Injected <strong>{routing.injectedDocumentIds.length}</strong> governing statutes into search scope</span>
            </span>
            <span className="font-mono text-slate-400">Deterministic Scope Routing</span>
          </div>
        </div>
      </div>
    </div>
  );
};
