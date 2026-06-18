import React, { useState, useRef } from 'react';
import { ShieldAlert, Upload, FileText, CheckCircle2, Loader2, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker URL
pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js`;

interface UploadZoneProps {
  onAnalyze: (documentText: string, filename: string) => Promise<void>;
  isAnalyzing: boolean;
}

export const UploadZone: React.FC<UploadZoneProps> = ({ onAnalyze, isAnalyzing }) => {
  const [dragActive, setDragActive] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [pageCount, setPageCount] = useState<number | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [status, setStatus] = useState<'idle' | 'extracting' | 'ready' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  // PDF Text Extraction Logic
  const handleExtractText = async (selectedFile: File) => {
    setStatus('extracting');
    setErrorMessage('');
    try {
      const arrayBuffer = await selectedFile.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      setPageCount(pdf.numPages);
      
      let fullText = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        fullText += content.items.map((item: any) => item.str).join(' ') + '\n';
      }

      if (!fullText.trim()) {
        throw new Error('The PDF appears to be empty or contains no extractable text.');
      }

      setExtractedText(fullText);
      setFile(selectedFile);
      setStatus('ready');
    } catch (err: any) {
      console.error('Text extraction failed:', err);
      setStatus('error');
      setErrorMessage(err?.message || 'Failed to parse the PDF. Make sure it is a valid, readable file.');
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        await handleExtractText(droppedFile);
      } else {
        setStatus('error');
        setErrorMessage('Only PDF files are supported.');
      }
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        await handleExtractText(selectedFile);
      } else {
        setStatus('error');
        setErrorMessage('Only PDF files are supported.');
      }
    }
  };

  const onButtonClick = () => {
    fileInputRef.current?.click();
  };

  const handleAnalyzeClick = async () => {
    if (!file || !extractedText) return;
    await onAnalyze(extractedText, file.name);
  };

  const handleReset = () => {
    setFile(null);
    setPageCount(null);
    setExtractedText('');
    setStatus('idle');
    setErrorMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative flex flex-col items-center justify-center min-h-[300px] border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
          dragActive
            ? 'border-forensic-verified bg-forensic-verified/5'
            : 'border-forensic-border bg-forensic-card hover:border-forensic-text-secondary'
        } ${isAnalyzing ? 'pointer-events-none opacity-50' : ''}`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileChange}
          className="hidden"
          disabled={isAnalyzing || status === 'extracting'}
        />

        {status === 'idle' && (
          <div className="flex flex-col items-center gap-4 cursor-pointer" onClick={onButtonClick}>
            <div className="p-4 bg-[#1E2530] rounded-full border border-forensic-border">
              <Upload className="h-8 w-8 text-forensic-text-secondary" />
            </div>
            <div>
              <p className="text-lg font-semibold text-forensic-text-primary">
                Drop a PDF to fact-check
              </p>
              <p className="text-sm text-forensic-text-secondary mt-1">
                or click to browse
              </p>
            </div>
            <div className="text-xs text-forensic-text-secondary font-mono border border-forensic-border px-3 py-1.5 rounded bg-[#0E1117]">
              MAX FILE SIZE: 20MB
            </div>
          </div>
        )}

        {status === 'extracting' && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-10 w-10 text-forensic-verified animate-spin" />
            <div>
              <p className="text-lg font-semibold text-forensic-text-primary">
                Extracting Document Content
              </p>
              <p className="text-sm text-forensic-text-secondary mt-1 font-mono">
                Reading pages client-side using pdfjs-dist...
              </p>
            </div>
          </div>
        )}

        {status === 'ready' && file && (
          <div className="flex flex-col items-center gap-5 w-full">
            <div className="flex items-center gap-3 bg-[#1E2530] border border-forensic-border p-4 rounded-lg w-full max-w-md text-left">
              <FileText className="h-10 w-10 text-forensic-verified flex-shrink-0" />
              <div className="overflow-hidden">
                <p className="font-semibold text-forensic-text-primary truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-forensic-text-secondary font-mono mt-0.5">
                  {pageCount} Page{pageCount !== 1 ? 's' : ''} • {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
              <CheckCircle2 className="h-6 w-6 text-forensic-verified ml-auto flex-shrink-0" />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 w-full max-w-md">
              <button
                type="button"
                onClick={handleReset}
                className="flex-1 px-4 py-2.5 bg-[#1E2530] hover:bg-[#252E3C] border border-forensic-border rounded-lg font-semibold text-forensic-text-primary transition font-sans"
              >
                Clear File
              </button>
              <button
                type="button"
                onClick={handleAnalyzeClick}
                disabled={isAnalyzing}
                className="flex-1 px-6 py-2.5 bg-forensic-verified hover:bg-[#34be72] disabled:opacity-50 text-[#0E1117] rounded-lg font-bold transition flex items-center justify-center gap-2 font-sans"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ShieldAlert className="h-5 w-5" />
                    Analyze Document
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {status === 'error' && (
          <div className="flex flex-col items-center gap-4">
            <div className="p-4 bg-[#2D1B1E] rounded-full border border-forensic-false/30">
              <AlertCircle className="h-8 w-8 text-forensic-false" />
            </div>
            <div>
              <p className="text-lg font-semibold text-forensic-text-primary">
                Processing Error
              </p>
              <p className="text-sm text-forensic-false mt-1 max-w-md">
                {errorMessage}
              </p>
            </div>
            <button
              type="button"
              onClick={handleReset}
              className="mt-2 px-6 py-2 bg-[#1E2530] hover:bg-[#252E3C] border border-forensic-border rounded-lg font-semibold text-forensic-text-primary transition font-sans"
            >
              Try Again
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
