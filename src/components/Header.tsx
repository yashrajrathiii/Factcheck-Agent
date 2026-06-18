import React from 'react';
import { Shield } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="w-full border-b border-forensic-border bg-forensic-card/50 backdrop-blur-md sticky top-0 z-50">
      <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6 lg:px-8">
        <div className="flex flex-col sm:flex-row items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="absolute inset-0 bg-forensic-verified/20 blur-md rounded-full"></div>
              <Shield className="relative h-8 w-8 text-forensic-verified" />
            </div>
            <div className="text-center sm:text-left">
              <h1 className="text-2xl font-bold tracking-tight text-forensic-text-primary m-0 font-sans leading-none">
                FactCheck <span className="text-forensic-verified">Agent</span>
              </h1>
              <p className="mt-1 text-sm text-forensic-text-secondary">
                AI-powered truth layer for marketing claims
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-forensic-verified opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-forensic-verified"></span>
            </span>
            <span className="text-xs font-mono text-forensic-text-secondary uppercase tracking-wider">
              System Active
            </span>
          </div>
        </div>
      </div>
    </header>
  );
};
