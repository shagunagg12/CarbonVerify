import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { UserProvider } from './context/UserContext';
import { Header } from './components/Header';
import { Capture } from './pages/Capture';
import { ReviewBoard } from './pages/ReviewBoard';
import { DocumentDetail } from './pages/DocumentDetail';
import { getQueue, removeFromQueue, updateQueueStatus } from './lib/syncQueue';

export const App: React.FC = () => {
  const [queueTrigger, setQueueTrigger] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  const incrementQueueTrigger = () => {
    setQueueTrigger((prev) => prev + 1);
  };

  // Background Sync Process when online
  const runSyncQueue = async () => {
    if (!navigator.onLine) return;

    const queue = await getQueue();
    const pending = queue.filter(item => item.status !== 'uploading');
    
    if (pending.length === 0) return;

    console.log(`Starting background sync for ${pending.length} evidence items...`);

    for (const item of pending) {
      try {
        await updateQueueStatus(item.id, 'uploading');
        incrementQueueTrigger();

        // Convert Blob back to File
        const file = new File([item.fileBlob], item.filename, { type: item.fileBlob.type });

        const formData = new FormData();
        formData.append('image', file);
        formData.append('userId', item.userId);

        const response = await fetch('${API_URL}/api/documents/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await response.json();

        // Handle success or duplicate (both mean the file is successfully dealt with)
        if (response.ok || response.status === 409) {
          await removeFromQueue(item.id);
          console.log(`Synced: ${item.filename} (Status: ${response.status === 409 ? 'Duplicate' : 'Success'})`);
        } else {
          throw new Error(data.error || 'Server rejected upload');
        }
      } catch (err: any) {
        console.error(`Failed to sync ${item.filename}:`, err);
        await updateQueueStatus(item.id, 'failed', err.message || 'Sync failed');
      } finally {
        incrementQueueTrigger();
      }
    }
  };

  // Run sync whenever online status changes or periodically when online
  useEffect(() => {
    // Run initial sync on mount
    runSyncQueue();

    const handleOnline = () => {
      setIsOnline(true);
      runSyncQueue();
    };

    const handleOffline = () => {
      setIsOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Periodically check connection and retry sync
    const interval = setInterval(() => {
      const currentOnline = navigator.onLine;
      setIsOnline(currentOnline);
      if (currentOnline) {
        runSyncQueue();
      }
    }, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <UserProvider>
      <Router>
        <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans pb-16">
          <Header isOnline={isOnline} queueVersion={queueTrigger} onSyncTrigger={runSyncQueue} />
          
          <main className="flex-1 w-full max-w-7xl mx-auto px-4">
            <Routes>
              <Route 
                path="/" 
                element={
                  <Capture 
                    isOnline={isOnline}
                    queueTrigger={queueTrigger} 
                    incrementQueueTrigger={incrementQueueTrigger} 
                  />
                } 
              />
              <Route path="/reviewer" element={<ReviewBoard />} />
              <Route path="/reviewer/document/:id" element={<DocumentDetail />} />
            </Routes>
          </main>
        </div>
      </Router>
    </UserProvider>
  );
};
export default App;
