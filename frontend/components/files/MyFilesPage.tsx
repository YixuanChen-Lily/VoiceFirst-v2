import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, FileText, FolderOpen, Loader2, Trash2, Upload } from 'lucide-react';

import { deleteMyFile, listMyFiles, uploadMyFile, type MyFile } from '../../lib/api';
import { formatDate, formatSize } from '../../lib/format';
import { Button } from '../ui/button';
import { Card, CardContent } from '../ui/card';
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
    <div className="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-stone-50">
      <div className="max-w-5xl mx-auto px-6 py-8">
        <Button variant="ghost" onClick={onBack} className="gap-2 text-stone-600 hover:text-stone-900 mb-6">
          <ArrowLeft className="w-4 h-4" />
          Back to Home
        </Button>

        <div className="flex items-center gap-3 mb-2">
          <FolderOpen className="w-8 h-8 text-emerald-600" />
          <h1 className="text-stone-900">My files</h1>
        </div>
        <p className="text-stone-600 mb-8 max-w-3xl">
          Everything you have uploaded. Only you can see these files. Upload a file once and add it to any proposal
          from the builder with “Add from My files”.
        </p>

        <div className="mb-6">
          <Button className="bg-emerald-600 hover:bg-emerald-700 text-white gap-2" disabled={isUploading} asChild>
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
          <p role="status" className="mb-4 text-sm text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg px-4 py-2">
            {notice}
          </p>
        )}
        {error && (
          <p role="alert" className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}

        <Card className="border border-stone-200">
          <CardContent className="p-0">
            {isLoading ? (
              <p className="p-8 text-center text-stone-500">Loading…</p>
            ) : files.length === 0 ? (
              <div className="p-10 text-center text-stone-500">
                <FileText className="w-8 h-8 mx-auto mb-3 text-stone-400" />
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
                        <div className="text-stone-900">{file.filename}</div>
                        <div className="text-xs text-stone-500">{formatSize(file.size_bytes)}</div>
                      </TableCell>
                      <TableCell>{usedInText(file.used_in)}</TableCell>
                      <TableCell>{formatDate(file.created_at)}</TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={busyId === file.id}
                          onClick={() => handleDelete(file)}
                          className="gap-1 text-red-600 hover:text-red-700"
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
      </div>
    </div>
  );
}
