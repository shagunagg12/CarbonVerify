import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { addToQueue, getQueue } from '../lib/syncQueue';
import type { QueueItem } from '../lib/syncQueue';
import { API_URL } from '../config';
import { Upload, Camera, FileImage, ShieldAlert, CheckCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';

interface CaptureProps {
  isOnline: boolean;
  queueTrigger: number;
  incrementQueueTrigger: () => void;
}

export const Capture: React.FC<CaptureProps> = ({ isOnline, queueTrigger, incrementQueueTrigger }) => {
  const { currentUser } = useUser();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [status, setStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error' | 'duplicate'; message: string }>({
    type: 'idle',
    message: ''
  });
  const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load offline queue list
  const loadQueueList = async () => {
    const q = await getQueue();
    setOfflineQueue(q.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()));
  };

  useEffect(() => {
    loadQueueList();
  }, [queueTrigger]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    // Validate type
    if (!selectedFile.type.match(/^image\/(jpeg|png|webp)/i)) {
      setStatus({ type: 'error', message: 'Invalid file type. Only JPG, PNG, and WEBP images are supported.' });
      setFile(null);
      setPreview(null);
      return;
    }

    // Validate size (10MB limit)
    if (selectedFile.size > 10 * 1024 * 1024) {
      setStatus({ type: 'error', message: 'File is too large. Maximum allowed size is 10MB.' });
      setFile(null);
      setPreview(null);
      return;
    }

    setFile(selectedFile);
    setPreview(URL.createObjectURL(selectedFile));
    setStatus({ type: 'idle', message: '' });
  };

  // Submit / Upload function
  const handleUploadSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !currentUser) return;

    setStatus({ type: 'loading', message: 'Processing evidence upload...' });

    // 1. If Offline: Store in Sync Queue
    if (!isOnline) {
      try {
        await addToQueue(file, currentUser.id, currentUser.name);
        setStatus({
          type: 'success',
          message: 'Saved to offline sync queue. Upload will start automatically when network returns.'
        });
        resetForm();
        incrementQueueTrigger();
      } catch (err: any) {
        setStatus({ type: 'error', message: `IndexedDB Error: ${err.message}` });
      }
      return;
    }

    // 2. If Online: Attempt direct upload to server
    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('userId', currentUser.id);

      const response = await fetch(`${API_URL}/api/documents/upload`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (response.status === 409) {
        setStatus({
          type: 'duplicate',
          message: `Duplicate document detected! Same file was already uploaded: ${data.document?.filename || 'Evidence File'}`
        });
      } else if (!response.ok) {
        throw new Error(data.error || 'Server error uploading file.');
      } else {
        setStatus({
          type: 'success',
          message: 'Evidence successfully uploaded to server. OCR extraction started in background.'
        });
        resetForm();
      }
    } catch (err: any) {
      console.warn('Direct upload failed. Falling back to offline queue.', err);
      // Fallback to queue on upload failure
      try {
        await addToQueue(file, currentUser.id, currentUser.name);
        setStatus({
          type: 'success',
          message: 'Upload failed due to network instability. Saved to sync queue for auto-retry.'
        });
        resetForm();
        incrementQueueTrigger();
      } catch (dbErr: any) {
        setStatus({ type: 'error', message: `Failed to queue file offline: ${dbErr.message}` });
      }
    }
  };

  const resetForm = () => {
    setFile(null);
    setPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const triggerSelectFile = () => {
    fileInputRef.current?.click();
  };

  return (
    <div className="max-w-4xl mx-auto px-4">
      <div className="grid md:grid-cols-2 gap-8">
        
        {/* Upload/Capture Section */}
        <div className="glass-card rounded-2xl p-6 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
              <Camera className="h-5 w-5 text-brand-400" /> Evidence Capture Flow
            </h2>
            <p className="text-sm text-slate-400 mb-6">
              Snap a clean photograph of the weighbridge slip, vehicle license plate, or challan. Supports offline storage.
            </p>

            <form onSubmit={handleUploadSubmit} className="space-y-6">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept="image/jpeg,image/png,image/webp"
                className="hidden"
              />

              {/* Upload Dropzone */}
              {!preview ? (
                <button
                  type="button"
                  onClick={triggerSelectFile}
                  className="w-full aspect-[4/3] border-2 border-dashed border-slate-700 hover:border-brand-500/80 bg-slate-800/40 rounded-xl flex flex-col items-center justify-center gap-3 transition group"
                >
                  <div className="bg-slate-800 p-4 rounded-full text-slate-400 group-hover:text-brand-400 group-hover:bg-slate-700/60 transition shadow-inner">
                    <Upload className="h-8 w-8" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-semibold text-slate-300">Tap to snap or select photo</p>
                    <p className="text-xs text-slate-500 mt-1">Supports JPEG, PNG, WEBP up to 10MB</p>
                  </div>
                </button>
              ) : (
                <div className="relative w-full aspect-[4/3] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
                  <img src={preview} alt="Evidence preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={resetForm}
                    className="absolute top-3 right-3 bg-red-600/90 hover:bg-red-700 text-white font-bold py-1 px-3 rounded-full text-xs transition shadow-lg"
                  >
                    Clear Photo
                  </button>
                </div>
              )}

              {/* Message indicators */}
              {status.type !== 'idle' && (
                <div className={`p-4 rounded-xl border flex gap-3 text-sm leading-relaxed ${
                  status.type === 'success' ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20' :
                  status.type === 'duplicate' ? 'bg-amber-500/10 text-amber-300 border-amber-500/20' :
                  status.type === 'loading' ? 'bg-sky-500/10 text-sky-300 border-sky-500/20' :
                  'bg-rose-500/10 text-rose-300 border-rose-500/20'
                }`}>
                  {status.type === 'success' ? (
                    <div className="flex flex-col gap-2 w-full">
                      <div className="flex gap-2 items-start">
                        <CheckCircle className="h-5 w-5 shrink-0 text-emerald-400 mt-0.5" />
                        <span>{status.message}</span>
                      </div>
                      <div className="pt-1">
                        <Link
                          to="/reviewer"
                          className="text-xs font-extrabold text-slate-900 bg-brand-400 hover:bg-brand-300 py-2 px-4 rounded-lg inline-flex items-center gap-1 transition-all"
                        >
                          Open Review Board & Dashboard →
                        </Link>
                      </div>
                    </div>
                  ) : (
                    <>
                      {status.type === 'duplicate' && <ShieldAlert className="h-5 w-5 shrink-0" />}
                      {status.type === 'loading' && <RefreshCw className="h-5 w-5 shrink-0 animate-spin" />}
                      {status.type === 'error' && <AlertCircle className="h-5 w-5 shrink-0" />}
                      <span>{status.message}</span>
                    </>
                  )}
                </div>
              )}

              <button
                type="submit"
                disabled={!file || status.type === 'loading'}
                className={`w-full py-3.5 px-6 rounded-xl font-bold transition flex items-center justify-center gap-2 ${
                  file && status.type !== 'loading'
                    ? 'bg-brand-500 text-slate-950 hover:bg-brand-400 hover:shadow-lg hover:shadow-brand-500/10 cursor-pointer'
                    : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
                }`}
              >
                {status.type === 'loading' ? 'Uploading...' : 'Save & Submit Evidence'}
              </button>
            </form>
          </div>
        </div>

        {/* Offline Queue Section */}
        <div className="glass-card rounded-2xl p-6 flex flex-col">
          <h2 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-400" /> Local Sync Queue ({offlineQueue.length})
          </h2>
          <p className="text-sm text-slate-400 mb-6">
            Documents waiting for network synchronization. Uploads will complete when connectivity returns.
          </p>

          <div className="flex-1 overflow-y-auto space-y-3.5 max-h-[400px] pr-2">
            {offlineQueue.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-800 rounded-xl bg-slate-900/30">
                <FileImage className="h-10 w-10 text-slate-700 mb-2" />
                <p className="text-sm font-semibold text-slate-400">Queue is empty</p>
                <p className="text-xs text-slate-600 mt-1">All captured documents have been synced.</p>
              </div>
            ) : (
              offlineQueue.map((item) => (
                <div key={item.id} className="p-3.5 rounded-xl border border-slate-800/80 bg-slate-900/50 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 overflow-hidden">
                    <div className="bg-slate-800 p-2.5 rounded-lg border border-slate-700 shrink-0">
                      <FileImage className="h-5 w-5 text-slate-400" />
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-xs font-semibold text-slate-200 truncate">{item.filename}</p>
                      <p className="text-[10px] text-slate-500 font-mono mt-0.5">
                        Captured: {item.timestamp.toLocaleTimeString()}
                      </p>
                      {item.error && (
                        <p className="text-[10px] text-rose-400 font-medium truncate mt-1">
                          Err: {item.error}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <div>
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border shrink-0 ${
                      item.status === 'uploading' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                      item.status === 'failed' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {item.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
