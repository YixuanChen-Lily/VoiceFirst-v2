import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, FileDown, FileText, FolderArchive, Loader2 } from 'lucide-react';

import { listProposalFiles } from '../../lib/api';

interface DownloadMenuProps {
  proposalId: string | null;
  isExporting: boolean;
  disabled?: boolean;
  onDownload: (includeFiles: boolean) => void;
  /** Open the menu above the button, for buttons near the bottom of the screen. */
  openUpward?: boolean;
  className?: string;
}

/** "Download" with a choice: the Word document alone, or a zip with the attachments as separate files. */
export function DownloadMenu({ proposalId, isExporting, disabled, onDownload, openUpward, className = '' }: DownloadMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  // How many attachments the proposal has; null while checking. Checked each time the menu opens,
  // since attachments may have been added on another step.
  const [attachmentCount, setAttachmentCount] = useState<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    let isCurrent = true;
    setAttachmentCount(null);
    if (!proposalId) {
      setAttachmentCount(0);
    } else {
      listProposalFiles(proposalId)
        .then((files) => isCurrent && setAttachmentCount(files.filter((file) => file.role === 'attachment').length))
        .catch(() => isCurrent && setAttachmentCount(0));
    }

    const closeOnOutsideClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('mousedown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      isCurrent = false;
      document.removeEventListener('mousedown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [isOpen, proposalId]);

  const choose = (includeFiles: boolean) => {
    setIsOpen(false);
    onDownload(includeFiles);
  };

  const zipNote =
    attachmentCount === null
      ? 'Checking your attachments…'
      : attachmentCount === 0
        ? 'No attachments added yet. Add them on the Attachments step.'
        : `A .zip file with the document and ${attachmentCount} attachment${attachmentCount === 1 ? '' : 's'}, each as its own file.`;

  const item = 'w-full flex items-start gap-3 px-4 py-3 text-left rounded-lg hover:bg-forest-tint disabled:opacity-50 disabled:hover:bg-transparent';

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        disabled={disabled || isExporting}
        aria-haspopup="menu"
        aria-expanded={isOpen}
        className="inline-flex items-center gap-2 min-h-[46px] px-5 rounded-[10px] bg-forest hover:bg-forest-dark text-white font-bold transition-colors disabled:opacity-60"
      >
        {isExporting ? (
          <Loader2 className="w-[18px] h-[18px] animate-spin" aria-hidden="true" />
        ) : (
          <FileDown className="w-[18px] h-[18px]" aria-hidden="true" />
        )}
        {isExporting ? 'Preparing…' : 'Download'}
        <ChevronDown className="w-4 h-4" aria-hidden="true" />
      </button>

      {isOpen && (
        <div
          role="menu"
          className={`absolute right-0 z-30 w-[340px] max-w-[calc(100vw-2rem)] p-1.5 bg-white border border-line rounded-xl shadow-lg text-ink ${
            openUpward ? 'bottom-full mb-2' : 'top-full mt-2'
          }`}
        >
          <button type="button" role="menuitem" onClick={() => choose(false)} className={item}>
            <FileText className="w-5 h-5 mt-0.5 shrink-0 text-forest" aria-hidden="true" />
            <span>
              <span className="block font-bold">Word document</span>
              <span className="block text-[15px] text-ink-muted">The proposal, with your attachments listed by name.</span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            onClick={() => choose(true)}
            disabled={!attachmentCount}
            className={item}
          >
            <FolderArchive className="w-5 h-5 mt-0.5 shrink-0 text-forest" aria-hidden="true" />
            <span>
              <span className="block font-bold">Word document and attachments</span>
              <span className="block text-[15px] text-ink-muted">{zipNote}</span>
            </span>
          </button>
        </div>
      )}
    </div>
  );
}
