import { useState, useEffect, useRef } from 'react';
import { supabase } from './lib/supabase';
import { Header } from './components/Header';
import { UploadZone } from './components/UploadZone';
import { SummaryBar } from './components/SummaryBar';
import { ClaimCard } from './components/ClaimCard';
import type { Claim } from './components/ClaimCard';
import { RotateCcw, AlertTriangle, ShieldCheck, Loader2 } from 'lucide-react';

function App() {
  const [documentId, setDocumentId] = useState<string | null>(null);
  const [filename, setFilename] = useState<string>('');
  const [isAnalyzing, setIsAnalyzing] = useState<boolean>(false);
  const [docStatus, setDocStatus] = useState<string>('processing');
  const [claims, setClaims] = useState<Claim[]>([]);
  const [error, setError] = useState<string | null>(null);

  const channelRef = useRef<any>(null);

  // Clean up realtime subscription on unmount or reset
  const unsubscribeRealtime = () => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }
  };

  useEffect(() => {
    return () => {
      unsubscribeRealtime();
    };
  }, []);

  const handleAnalyze = async (documentText: string, name: string) => {
    setIsAnalyzing(true);
    setError(null);
    setClaims([]);
    setFilename(name);
    setDocStatus('processing');

    try {
      // 1. Invoke Supabase Edge Function
      const { data, error: funcError } = await supabase.functions.invoke('fact-check', {
        body: { documentText, filename: name },
      });

      if (funcError) {
        throw new Error(funcError.message || 'Failed to call the analysis agent edge function.');
      }

      // Support multiple return structures (documentId, document_id, document: { id }, etc.)
      const docId = data?.documentId || data?.document_id || data?.id || data?.document?.id;
      
      if (!docId) {
        throw new Error('Analysis initiated successfully, but the server did not return a valid document ID reference.');
      }

      setDocumentId(docId);

      // 2. Fetch initial document status and claims that might have been created immediately
      const { data: docData, error: docFetchError } = await supabase
        .from('documents')
        .select('status')
        .eq('id', docId)
        .single();
      
      if (!docFetchError && docData) {
        setDocStatus(docData.status);
        if (docData.status === 'error') {
          setError('The backend claims analysis agent encountered an error processing this document. Please check that you supplied valid GEMINI_API_KEY and TAVILY_API_KEY project secrets on your Supabase dashboard.');
        }
      }

      const { data: initialClaims, error: claimsError } = await supabase
        .from('claims')
        .select('*')
        .eq('document_id', docId)
        .order('created_at', { ascending: false });

      if (claimsError) {
        console.warn('Could not fetch initial claims:', claimsError);
      } else if (initialClaims) {
        setClaims(initialClaims);
      }

      // 3. Subscribe to Realtime Postgres changes for this document
      unsubscribeRealtime();

      channelRef.current = supabase
        .channel(`realtime_claims_${docId}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'claims',
            filter: `document_id=eq.${docId}`,
          },
          (payload) => {
            console.log('Realtime payload received:', payload);
            const record = payload.new as Claim;

            if (payload.eventType === 'INSERT') {
              setClaims((prev) => {
                if (prev.some((c) => c.id === record.id)) {
                  return prev.map((c) => (c.id === record.id ? record : c));
                }
                return [record, ...prev];
              });
            } else if (payload.eventType === 'UPDATE') {
              setClaims((prev) => {
                if (prev.some((c) => c.id === record.id)) {
                  return prev.map((c) => (c.id === record.id ? record : c));
                }
                return [record, ...prev];
              });
            } else if (payload.eventType === 'DELETE') {
              const deleted = payload.old as { id: string };
              setClaims((prev) => prev.filter((c) => c.id !== deleted.id));
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'documents',
            filter: `id=eq.${docId}`,
          },
          (payload) => {
            console.log('Realtime document update received:', payload);
            const updatedDoc = payload.new as { status: string };
            setDocStatus(updatedDoc.status);
            
            if (updatedDoc.status === 'error') {
              setError('The backend claims analysis agent encountered an error processing this document. Please check that you supplied valid GEMINI_API_KEY and TAVILY_API_KEY project secrets on your Supabase dashboard.');
            }
          }
        )
        .subscribe((status) => {
          console.log(`Supabase Realtime subscription status: ${status}`);
        });

    } catch (err: any) {
      console.error('Analysis process failed:', err);
      setError(err?.message || 'An unexpected error occurred during document audit. Please try again.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleReset = () => {
    unsubscribeRealtime();
    setDocumentId(null);
    setFilename('');
    setClaims([]);
    setError(null);
    setDocStatus('processing');
    setIsAnalyzing(false);
  };

  // Derive counts from claims array
  const total = claims.length;
  const verified = claims.filter((c) => c.verdict?.toLowerCase() === 'verified').length;
  const inaccurate = claims.filter((c) => c.verdict?.toLowerCase() === 'inaccurate').length;
  const falseCount = claims.filter((c) => c.verdict?.toLowerCase() === 'false').length;

  const isAnalysisComplete =
    total > 0 &&
    claims.every(
      (c) =>
        c.verdict?.toLowerCase() !== 'pending' &&
        c.verdict?.toLowerCase() !== 'checking'
    );

  return (
    <div className="min-h-screen bg-forensic-bg text-forensic-text-primary flex flex-col antialiased selection:bg-forensic-verified/30 selection:text-forensic-verified">
      <Header />

      <main className="flex-1 mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8 flex flex-col gap-8">
        
        {/* Error Alert Display */}
        {error && (
          <div className="w-full max-w-2xl mx-auto bg-red-950/20 border border-forensic-false/30 rounded-xl p-4 flex gap-3 items-start animate-fade-in shadow-lg">
            <AlertTriangle className="h-5 w-5 text-forensic-false flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-semibold text-forensic-text-primary">Audit Execution Failed</h3>
              <p className="text-sm text-forensic-false mt-1 font-mono">{error}</p>
            </div>
            <button 
              onClick={() => setError(null)} 
              className="text-forensic-text-secondary hover:text-forensic-text-primary transition"
            >
              ✕
            </button>
          </div>
        )}

        {/* Upload State */}
        {!documentId && (
          <div className="flex-1 flex flex-col justify-center py-6">
            <div className="max-w-xl mx-auto text-center space-y-4 mb-8">
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold tracking-wider bg-forensic-verified/10 text-forensic-verified border border-forensic-verified/20 uppercase">
                Forensics Mode Active
              </span>
              <h2 className="text-3xl font-extrabold tracking-tight text-forensic-text-primary font-sans sm:text-4xl">
                Audit Your Documents for Claims
              </h2>
              <p className="text-base text-forensic-text-secondary max-w-md mx-auto">
                Extract statements client-side, run them through live Tavily web search, and verify their credibility with Gemini AI.
              </p>
            </div>
            <UploadZone onAnalyze={handleAnalyze} isAnalyzing={isAnalyzing} />
          </div>
        )}

        {/* Results / Ledger State */}
        {documentId && (
          <div className="space-y-6 animate-fade-in">
            {/* Header stats bar */}
            <SummaryBar
              total={total}
              verified={verified}
              inaccurate={inaccurate}
              falseCount={falseCount}
              filename={filename}
              status={docStatus}
            />

            {/* Reset / Action Header */}
            <div className="flex items-center justify-between border-b border-forensic-border pb-3">
              <h3 className="text-sm uppercase font-mono tracking-widest text-forensic-text-secondary flex items-center gap-2">
                <span>Claims Ledger</span>
                {isAnalysisComplete && (
                  <span className="flex items-center gap-1 text-forensic-verified text-[10px] bg-forensic-verified/10 border border-forensic-verified/20 px-2 py-0.5 rounded">
                    <ShieldCheck className="h-3 w-3" /> Fully Verified
                  </span>
                )}
              </h3>
              
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-3 py-1.5 bg-forensic-card hover:bg-[#1E2530] border border-forensic-border rounded-lg text-xs font-semibold text-forensic-text-primary transition"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Upload New Document
              </button>
            </div>

            {/* Claims cards list */}
            {claims.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 border border-dashed border-forensic-border rounded-xl bg-forensic-card/25 gap-4">
                <Loader2 className="h-8 w-8 text-forensic-verified animate-spin" />
                <div className="text-center">
                  <p className="text-base font-semibold text-forensic-text-primary">
                    Awaiting claim extractions...
                  </p>
                  <p className="text-xs text-forensic-text-secondary mt-1 font-mono">
                    Supabase backend is scanning sentences and parsing metadata.
                  </p>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {claims.map((claim) => (
                  <ClaimCard key={claim.id} claim={claim} />
                ))}
              </div>
            )}

            {/* Reset button at the bottom (shows after analysis completes) */}
            {isAnalysisComplete && (
              <div className="pt-6 pb-12 flex justify-center animate-fade-in">
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-6 py-3 bg-forensic-verified hover:bg-[#34be72] text-[#0E1117] rounded-lg font-bold transition shadow-lg shadow-forensic-verified/10"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reset & Upload Another PDF
                </button>
              </div>
            )}
          </div>
        )}
      </main>

      <footer className="border-t border-forensic-border bg-[#0E1117]/85 py-6">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <p className="text-xs font-mono text-forensic-text-secondary">
            FACTCHECK AGENT // EVIDENCE IDENTIFIER LAYER // DEEPMIND CO-PILOT PRO
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
