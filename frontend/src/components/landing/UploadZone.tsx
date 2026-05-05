'use client';
import React, { useRef, useEffect, useCallback } from 'react';
import { Upload } from 'lucide-react';

type Props = {
  onFiles: (files: FileList | null) => void;
};

export default function UploadZone({ onFiles }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    folderInputRef.current?.setAttribute('webkitdirectory', '');
  }, []);

  const openFilePicker = useCallback(() => {
    document.getElementById('upload-zone-input')?.click();
  }, []);

  const openFolderPicker = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    folderInputRef.current?.click();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer.files?.length > 0) onFiles(e.dataTransfer.files);
    },
    [onFiles],
  );

  return (
    <section aria-label="Upload your Letterboxd data">
      <div
        className="group rounded-2xl border border-slate-700/50 bg-slate-800/50 p-8 md:p-10 min-h-[220px] sm:min-h-[260px] flex items-center justify-center text-center cursor-pointer transition-all duration-300 hover:border-orange-400/40 hover:shadow-[0_0_40px_-12px_rgba(251,146,60,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/50 max-w-3xl mx-auto"
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDrop}
        onClick={openFilePicker}
        role="button"
        tabIndex={0}
      >
        <input
          id="upload-zone-input"
          type="file"
          multiple
          accept=".zip,.csv,.CSV"
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
        />
        <input
          ref={folderInputRef}
          type="file"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
        />
        <div className="flex flex-col items-center">
          <div className="mb-5 h-14 w-14 rounded-2xl bg-orange-500/10 border border-orange-400/25 flex items-center justify-center transition-colors group-hover:bg-orange-500/20">
            <Upload className="w-7 h-7 text-orange-300" />
          </div>
          <p className="text-xl sm:text-2xl font-bold tracking-tight">Begin Your Cinema Reveal</p>
          <p className="mt-2 text-sm text-slate-400">Drag your Letterboxd export (.zip) or click to upload</p>
          <p className="mt-1 text-xs text-slate-500">
            or{' '}
            <button
              onClick={openFolderPicker}
              className="underline underline-offset-2 hover:text-slate-300 transition-colors"
            >
              choose an exported folder
            </button>
          </p>
        </div>
      </div>
    </section>
  );
}
