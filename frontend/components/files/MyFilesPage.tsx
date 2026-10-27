import React, { useCallback, useEffect, useRef, useState } from 'react';
import { FileText, Loader2, Trash2, Upload } from 'lucide-react';

import { deleteMyFile, listMyFiles, uploadMyFile, type MyFile } from '../../lib/api';
import { formatDate, formatSize } from '../../lib/format';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
import { SubPage } from '../layout/SubPage';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

interface MyFilesPageProps {
  onBack: () => void;
}

function usedInText(count: number): string {
  if (count === 0) return 'Not in any proposal';
  return count === 1 ? 'In 1 proposal' : `In ${count} proposals`;
}

/** Every file the signed-in user has uploaded, for reuse across proposals. */
export function MyFilesPage({ onBack }: MyFilesPageProps) {
  const [files, setFiles] = useState<MyFile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      setFiles(await listMyFiles());
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Could not load your files.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const handleUpload = async (list: FileList | null) => {
    const chosen = Array.from(list ?? []);
    if (chosen.length === 0) return;
    setIsUploading(true);
    setError(null);
    setNotice(null);
    try {
      for (const file of chosen) {
        await uploadMyFile(file);
      }
      setNotice(chosen.length === 1 ? `"${chosen[0].name}" was added.` : `${chosen.length} files were added.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'The upload failed.');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    }
  };

  const handleDelete = async (file: MyFile) => {
    const where =
      file.used_in > 0
        ? ` It is used in ${file.used_in === 1 ? '1 proposal' : `${file.used_in} proposals`} and will be removed from ${
            file.used_in === 1 ? 'it' : 'all of them'
          }.`
        : '';
    if (!window.confirm(`Delete "${file.filename}"?${where} This cannot be undone.`)) return;
    setBusyId(file.id);
    setError(null);
    setNotice(null);
    try {
      await deleteMyFile(file.id);
      setNotice(`"${file.filename}" was deleted.`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Could not delete the file.');
    } finally {
      setBusyId(null);
      await refresh();
    }
  };

  return (
    <SubPage
      title="My files"
      onBack={onBack}
      description="Everything you have uploaded. Only you can see these files. Upload a file once and add it to any proposal from the builder with “Add from My files”."
    >
        <div className="mb-6">
          <Button className="bg-forest hover:bg-forest-dark text-white gap-2" disabled={isUploading} asChild>
            <label className="cursor-pointer">
              {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              {isUploading ? 'Uploading…' : 'Upload files'}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(event) => handleUpload(event.target.files)}
              />
            </label>
          </Button>
        </div>

        {notice && (
          <p role="status" className="mb-4 text-sm text-forest-dark bg-forest-tint border border-forest/20 rounded-lg px-4 py-2">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <Card className="border border-line">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-8 text-center text-ink-muted">Loading…</p>
            ) : files.length === 0 ? (
              <div className="p-10 text-center text-ink-muted">
                <FileText className="w-8 h-8 mx-auto mb-3 text-ink-muted" />
                <p>You haven't uploaded any files yet.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>File</TableHead>
                    <TableHead>Used</TableHead>
                    <TableHead>Added</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {files.map((file) => (
                    <TableRow key={file.id}>
                      <TableCell>
                        <div className="text-ink">{file.filename}</div>
                        <div className="text-xs text-ink-muted">{formatSize(file.size_bytes)}</div>
                      </TableCell>
                      <TableCell>{usedInText(file.used_in)}</TableCell>
                      <TableCell>{formatDate(file.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === file.id}
                          onClick={() => handleDelete(file)}
                          className="gap-1 text-red-700 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
    </SubPage>
  );
}
