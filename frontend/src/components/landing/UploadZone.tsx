'use client';
import React, { useEffect, useRef, useCallback, useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';

const T = {
  darkblue: "#2776F5",
  paper: "#F1ECDE",
  card: "#FBF8EF",
  ink: "#100F0C",
  lime: "#AEE63E",
  amber: "#F2B33D",
  cyan: "#53CFE6",
  purple: "#A98BEA",
  red: "#E8463A",
  muted: "#6F6E63",
  darkamber: "#e16517",
  lines: "#cdcdcd"
};
const MONO = 'ui-monospace, "Cascadia Code", "Courier New", monospace';
const shadow = (n: number) => `${n}px ${n}px 0 ${T.ink}`;

type Props = {
  onFiles: (files: FileList | File[] | null) => void;
};

type FileWithRelativePath = File & { webkitRelativePath?: string };
type FileSystemFileHandleLike = {
  kind: 'file';
  name: string;
  getFile: () => Promise<File>;
};
type FileSystemDirectoryHandleLike = {
  kind: 'directory';
  name: string;
  values: () => AsyncIterable<FileSystemFileHandleLike | FileSystemDirectoryHandleLike>;
};
type WindowWithDirectoryPicker = Window & {
  showDirectoryPicker?: () => Promise<FileSystemDirectoryHandleLike>;
};
type FileSystemEntryLike = {
  isFile: boolean;
  isDirectory: boolean;
  name: string;
};
type FileSystemFileEntryLike = FileSystemEntryLike & {
  file: (success: (file: File) => void, error?: (error: DOMException) => void) => void;
};
type FileSystemDirectoryEntryLike = FileSystemEntryLike & {
  createReader: () => {
    readEntries: (
      success: (entries: FileSystemEntryLike[]) => void,
      error?: (error: DOMException) => void,
    ) => void;
  };
};
type DataTransferItemWithEntry = DataTransferItem & {
  webkitGetAsEntry?: () => FileSystemEntryLike | null;
};

function withRelativePath(file: File, relativePath: string): FileWithRelativePath {
  try {
    Object.defineProperty(file, 'webkitRelativePath', {
      value: relativePath,
      configurable: true,
    });
  } catch {
    // Some browser File objects are not extensible. The file still uploads.
  }
  return file as FileWithRelativePath;
}

async function collectDirectoryFiles(
  directory: FileSystemDirectoryHandleLike,
  prefix = '',
): Promise<File[]> {
  const files: File[] = [];
  for await (const handle of directory.values()) {
    const relativePath = `${prefix}${handle.name}`;
    if (handle.kind === 'file') {
      const file = await handle.getFile();
      if (/\.csv$/i.test(file.name)) files.push(withRelativePath(file, relativePath));
    } else {
      files.push(...await collectDirectoryFiles(handle, `${relativePath}/`));
    }
  }
  return files;
}

function readFileEntry(entry: FileSystemFileEntryLike, path: string): Promise<File> {
  return new Promise((resolve, reject) => {
    entry.file(
      (file) => resolve(withRelativePath(file, `${path}${file.name}`)),
      reject,
    );
  });
}

function readDirectoryEntries(entry: FileSystemDirectoryEntryLike): Promise<FileSystemEntryLike[]> {
  const reader = entry.createReader();
  const entries: FileSystemEntryLike[] = [];

  return new Promise((resolve, reject) => {
    const readBatch = () => {
      reader.readEntries((batch) => {
        if (batch.length === 0) {
          resolve(entries);
          return;
        }
        entries.push(...batch);
        readBatch();
      }, reject);
    };
    readBatch();
  });
}

async function collectDroppedEntryFiles(entry: FileSystemEntryLike, path = ''): Promise<File[]> {
  if (entry.isFile) {
    const file = await readFileEntry(entry as FileSystemFileEntryLike, path);
    return /\.csv$/i.test(file.name) || /\.zip$/i.test(file.name) ? [file] : [];
  }

  if (!entry.isDirectory) return [];

  const directory = entry as FileSystemDirectoryEntryLike;
  const children = await readDirectoryEntries(directory);
  const files = await Promise.all(
    children.map((child) => collectDroppedEntryFiles(child, `${path}${entry.name}/`)),
  );
  return files.flat();
}

export default function UploadZone({ onFiles }: Props) {
  const folderInputRef = useRef<HTMLInputElement>(null);
  const dragDepthRef = useRef(0);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const preventFileNavigation = (event: DragEvent) => {
      if (Array.from(event.dataTransfer?.types ?? []).includes('Files')) {
        event.preventDefault();
      }
    };

    window.addEventListener('dragover', preventFileNavigation);
    window.addEventListener('drop', preventFileNavigation);
    return () => {
      window.removeEventListener('dragover', preventFileNavigation);
      window.removeEventListener('drop', preventFileNavigation);
    };
  }, []);

  const openFilePicker = useCallback(() => {
    document.getElementById('upload-zone-input')?.click();
  }, []);

  const openFolderPicker = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    const picker = (window as WindowWithDirectoryPicker).showDirectoryPicker;
    if (picker) {
      try {
        const directory = await picker.call(window);
        onFiles(await collectDirectoryFiles(directory));
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }
    folderInputRef.current?.click();
  }, [onFiles]);

  const collectDroppedFiles = useCallback(async (dataTransfer: DataTransfer) => {
    const items = Array.from(dataTransfer.items ?? []) as DataTransferItemWithEntry[];
    const entries = items
      .map((item) => item.webkitGetAsEntry?.() as FileSystemEntryLike | null | undefined)
      .filter((entry): entry is FileSystemEntryLike => !!entry);

    if (entries.length > 0) {
      const files = (await Promise.all(entries.map((entry) => collectDroppedEntryFiles(entry)))).flat();
      if (files.length > 0) return files;
    }

    return dataTransfer.files?.length ? dataTransfer.files : null;
  }, []);

  const handleDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      dragDepthRef.current = 0;
      setIsDragging(false);
      onFiles(await collectDroppedFiles(e.dataTransfer));
    },
    [collectDroppedFiles, onFiles],
  );

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = 'copy';
  }, []);

  return (
    <section aria-label="Upload your Letterboxd data">
      <div
        data-testid="upload-drop-zone"
        style={{
          display: 'flex',
          minHeight: 220,
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          border: `2.5px solid ${T.ink}`,
          background: isDragging ? T.lime : T.card,
          padding: 24,
          transition: 'all 90ms',
          maxWidth: 720,
          margin: '0 auto',
          boxShadow: isDragging ? shadow(3) : shadow(2),
          color: T.ink,
        }}
        onDragEnter={handleDragEnter}
        onDragLeave={handleDragLeave}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
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
          ref={(el) => {
            (folderInputRef as React.MutableRefObject<HTMLInputElement | null>).current = el;
            if (el) (el as HTMLInputElement & { webkitdirectory: boolean }).webkitdirectory = true;
          }}
          type="file"
          multiple
          onChange={(e) => onFiles(e.target.files)}
          className="hidden"
        />
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <div style={{ marginBottom: 20, width: 56, height: 56, display: 'flex', alignItems: 'center', justifyContent: 'center', border: `2.5px solid ${T.ink}`, background: T.amber, boxShadow: shadow(2) }}>
            <Upload className="w-7 h-7" style={{ color: T.ink }} />
          </div>
          <p style={{ fontSize: 24, fontWeight: 700, marginBottom: 12, fontFamily: 'Georgia, serif' }}>Begin Your Cinema Reveal</p>
          <p style={{ marginTop: 8, fontSize: 14, color: T.muted, fontFamily: MONO }}>
            {isDragging ? 'Drop to upload your export.' : 'Drag a ZIP, CSV files, or an extracted export folder here.'}
          </p>
          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <button
              type="button"
              onClick={openFilePicker}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 14px',
                border: `2.5px solid ${T.ink}`,
                background: T.lime,
                color: T.ink,
                cursor: 'pointer',
                boxShadow: shadow(2),
                transition: 'all 90ms',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget;
                btn.style.background = T.amber;
                btn.style.boxShadow = shadow(3);
                btn.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget;
                btn.style.background = T.lime;
                btn.style.boxShadow = shadow(2);
                btn.style.transform = 'none';
              }}
            >
              <Upload className="h-4 w-4" />
              Choose ZIP or CSV
            </button>
            <button
              type="button"
              onClick={openFolderPicker}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                fontFamily: MONO,
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: '0.1em',
                textTransform: 'uppercase',
                padding: '10px 14px',
                border: `2.5px solid ${T.ink}`,
                background: T.purple,
                color: T.ink,
                cursor: 'pointer',
                boxShadow: shadow(2),
                transition: 'all 90ms',
              }}
              onMouseEnter={(e) => {
                const btn = e.currentTarget;
                btn.style.background = T.red;
                btn.style.boxShadow = shadow(3);
                btn.style.transform = 'translate(-1px, -1px)';
              }}
              onMouseLeave={(e) => {
                const btn = e.currentTarget;
                btn.style.background = T.purple;
                btn.style.boxShadow = shadow(2);
                btn.style.transform = 'none';
              }}
            >
              <FolderOpen className="h-4 w-4" />
              Choose Export Folder
            </button>
          </div>
          <p style={{ marginTop: 12, fontSize: 11, color: T.muted, fontFamily: MONO }}>Use the folder button if your browser blocks folder drag-and-drop.</p>
        </div>
      </div>
    </section>
  );
}
