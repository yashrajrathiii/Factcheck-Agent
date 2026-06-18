import React from 'react';
import { ExternalLink, Link2, AlertTriangle, ShieldCheck, XOctagon, Loader2 } from 'lucide-react';

export interface Claim {
  id: string;
  document_id: string;
  claim_text: string;
  claim_type: 'STAT' | 'DATE' | 'FINANCIAL' | 'TECHNICAL' | string;
  verdict: 'verified' | 'inaccurate' | 'false' | 'pending' | string;
  reasoning: string | null;
  source_url: string | null;
  source_snippet: string | null;
  correct_fact: string | null;
  created_at: string;
}

interface ClaimCardProps {
  claim: Claim;
}

export const ClaimCard: React.FC<ClaimCardProps> = ({ claim }) => {
  const {
    claim_text,
    claim_type,
    verdict,
    reasoning,
    source_url,
    source_snippet,
    correct_fact,
  } = claim;

  const normalizedVerdict = verdict?.toLowerCase() || 'pending';

  // Defensive sanitization helper to handle stringified 'null', empty strings, etc.
  const sanitize = (val: any) => {
    if (val === null || val === undefined) return null;
    const s = String(val).trim();
    if (s.toLowerCase() === 'null' || s === '') return null;
    return s;
  };

  const cleanCorrectFact = sanitize(correct_fact);
  const cleanSourceUrl = sanitize(source_url);
  const cleanSourceSnippet = sanitize(source_snippet);
  const cleanReasoning = sanitize(reasoning);

  // Badge Styling based on Claim Type
  const getTypeBadgeStyles = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'STAT':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
      case 'DATE':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/30';
      case 'FINANCIAL':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
      case 'TECHNICAL':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/30';
    }
  };

  return (
    <div className="w-full bg-forensic-card border border-forensic-border rounded-xl p-5 md:p-6 transition-all duration-300 hover:border-forensic-border hover:shadow-[0_8px_30px_rgb(0,0,0,0.4)] animate-slide-in">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        {/* Left Side: Claim Content */}
        <div className="flex-1 space-y-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-semibold tracking-wider border ${getTypeBadgeStyles(
                claim_type
              )}`}
            >
              {claim_type || 'UNKNOWN'}
            </span>
            <span className="text-xs font-mono text-forensic-text-secondary">
              ID: {claim.id.slice(0, 8)}
            </span>
          </div>

          <p className="text-forensic-text-primary font-mono text-base md:text-lg leading-relaxed border-l-2 border-forensic-border pl-3 py-1">
            "{claim_text}"
          </p>
        </div>

        {/* Right Side: Animated Verdict Stamp */}
        <div className="flex-shrink-0 flex items-center justify-start sm:justify-end min-h-[50px]">
          {normalizedVerdict === 'pending' || normalizedVerdict === 'checking' ? (
            <div className="flex items-center gap-2 bg-[#1E2530] text-forensic-pending border border-forensic-border px-3 py-1.5 rounded font-mono text-xs uppercase tracking-widest animate-pulse">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Checking...
            </div>
          ) : normalizedVerdict === 'verified' ? (
            <div className="rubber-stamp text-forensic-verified border-forensic-verified text-sm md:text-base animate-stamp-in flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4" />
              Verified
            </div>
          ) : normalizedVerdict === 'inaccurate' ? (
            <div className="rubber-stamp text-forensic-inaccurate border-forensic-inaccurate text-sm md:text-base animate-stamp-in flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4" />
              Inaccurate
            </div>
          ) : normalizedVerdict === 'false' ? (
            <div className="rubber-stamp text-forensic-false border-forensic-false text-sm md:text-base animate-stamp-in flex items-center gap-1.5">
              <XOctagon className="h-4 w-4" />
              False
            </div>
          ) : (
            <div className="rubber-stamp text-forensic-pending border-forensic-pending text-sm md:text-base animate-stamp-in">
              {normalizedVerdict}
            </div>
          )}
        </div>
      </div>

      {/* Claim details (only shown when not pending) */}
      {(normalizedVerdict !== 'pending' && normalizedVerdict !== 'checking') && (
        <div className="mt-4 pt-4 border-t border-forensic-border space-y-3">
          {cleanReasoning && (
            <div className="space-y-1">
              <span className="text-xs uppercase font-mono text-forensic-text-secondary tracking-widest block">
                Reasoning / Evidence
              </span>
              <p className="text-sm text-forensic-text-secondary leading-relaxed">
                {cleanReasoning}
              </p>
            </div>
          )}

          {/* Highlighted box for correct fact */}
          {(normalizedVerdict === 'inaccurate' || normalizedVerdict === 'false') && cleanCorrectFact && (
            <div className="p-3.5 bg-red-950/20 border border-forensic-false/30 rounded-lg text-sm">
              <span className="text-xs font-bold text-forensic-false uppercase tracking-wider block font-mono">
                Correct Fact:
              </span>
              <p className="text-forensic-text-primary mt-1 font-sans font-medium">
                {cleanCorrectFact}
              </p>
            </div>
          )}

          {/* Source link and quote snippet */}
          {cleanSourceUrl && (
            <div className="flex flex-col gap-2 pt-1">
              <div className="flex items-center gap-2">
                <Link2 className="h-3.5 w-3.5 text-forensic-verified" />
                <a
                  href={cleanSourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium text-forensic-verified hover:underline flex items-center gap-1"
                >
                  Source Verification URL
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
              {cleanSourceSnippet && (
                <div className="text-xs text-forensic-text-secondary bg-[#0E1117] border border-forensic-border p-2.5 rounded font-mono italic max-h-24 overflow-y-auto">
                  "{cleanSourceSnippet}"
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
