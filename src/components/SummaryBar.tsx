import React from 'react';
import { FileText, CheckCircle2, AlertTriangle, XCircle, BarChart3 } from 'lucide-react';

interface SummaryBarProps {
  total: number;
  verified: number;
  inaccurate: number;
  falseCount: number;
  filename: string;
  status: string;
}

export const SummaryBar: React.FC<SummaryBarProps> = ({
  total,
  verified,
  inaccurate,
  falseCount,
  filename,
  status,
}) => {
  return (
    <div className="w-full bg-forensic-card border border-forensic-border rounded-xl p-5 md:p-6 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-5 border-b border-forensic-border pb-4">
        <div className="flex items-center gap-3">
          <FileText className="h-5 w-5 text-forensic-text-secondary" />
          <div>
            <span className="text-xs uppercase font-mono tracking-widest text-forensic-text-secondary">
              Currently Auditing
            </span>
            <h2 className="text-lg font-semibold text-forensic-text-primary m-0 font-sans truncate max-w-md">
              {filename}
            </h2>
          </div>
        </div>
        <div className="flex items-center gap-2 font-mono text-xs text-forensic-text-secondary bg-[#0E1117] border border-forensic-border px-3 py-1.5 rounded">
          <span>STATUS:</span>
          {status === 'error' ? (
            <span className="text-forensic-false uppercase">Error</span>
          ) : status === 'completed' ? (
            <span className="text-forensic-verified uppercase font-semibold">Audit Complete</span>
          ) : (
            <span className="text-forensic-inaccurate uppercase animate-pulse">Processing Claims...</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {/* Total Claims */}
        <div className="bg-[#0E1117] border border-forensic-border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2.5 bg-[#1E2530] rounded-lg">
            <BarChart3 className="h-5 w-5 text-forensic-text-primary" />
          </div>
          <div>
            <p className="text-xs font-mono text-forensic-text-secondary uppercase tracking-wider">
              Total Claims
            </p>
            <p className="text-2xl font-bold text-forensic-text-primary font-mono mt-0.5">
              {total}
            </p>
          </div>
        </div>

        {/* Verified Claims */}
        <div className="bg-[#0E1117] border border-forensic-border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2.5 bg-forensic-verified/10 rounded-lg">
            <CheckCircle2 className="h-5 w-5 text-forensic-verified" />
          </div>
          <div>
            <p className="text-xs font-mono text-forensic-text-secondary uppercase tracking-wider">
              Verified
            </p>
            <p className="text-2xl font-bold text-forensic-verified font-mono mt-0.5">
              {verified}
            </p>
          </div>
        </div>

        {/* Inaccurate Claims */}
        <div className="bg-[#0E1117] border border-forensic-border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2.5 bg-forensic-inaccurate/10 rounded-lg">
            <AlertTriangle className="h-5 w-5 text-forensic-inaccurate" />
          </div>
          <div>
            <p className="text-xs font-mono text-forensic-text-secondary uppercase tracking-wider">
              Inaccurate
            </p>
            <p className="text-2xl font-bold text-forensic-inaccurate font-mono mt-0.5">
              {inaccurate}
            </p>
          </div>
        </div>

        {/* False Claims */}
        <div className="bg-[#0E1117] border border-forensic-border rounded-lg p-4 flex items-center gap-3">
          <div className="p-2.5 bg-forensic-false/10 rounded-lg">
            <XCircle className="h-5 w-5 text-forensic-false" />
          </div>
          <div>
            <p className="text-xs font-mono text-forensic-text-secondary uppercase tracking-wider">
              False
            </p>
            <p className="text-2xl font-bold text-forensic-false font-mono mt-0.5">
              {falseCount}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
