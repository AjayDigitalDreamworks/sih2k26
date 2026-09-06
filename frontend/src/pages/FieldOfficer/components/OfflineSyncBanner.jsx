import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, RefreshCw, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { fieldOfficerQueue } from '@/lib/fieldOfficerQueue';
import ApiClient from '@/lib/api';

export default function OfflineSyncBanner() {
  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);
  const [queuedCount, setQueuedCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  const refreshQueueCount = async () => {
    try {
      const count = await fieldOfficerQueue.count();
      setQueuedCount(count);
    } catch {
      setQueuedCount(0);
    }
  };

  useEffect(() => {
    refreshQueueCount();

    const handleOnline = () => {
      setIsOnline(true);
      toast.success('Internet reconnected. Syncing offline data...');
      handleSync();
    };

    const handleOffline = () => {
      setIsOnline(false);
      toast.warning('Network offline. Actions will be saved locally in IndexedDB.');
    };

    const handleQueueUpdated = (e) => {
      if (e.detail && typeof e.detail.count === 'number') {
        setQueuedCount(e.detail.count);
      } else {
        refreshQueueCount();
      }
    };

    const handleSynced = (e) => {
      refreshQueueCount();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    window.addEventListener('field_queue_updated', handleQueueUpdated);
    window.addEventListener('field_officer_synced', handleSynced);

    const interval = setInterval(refreshQueueCount, 10000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('field_queue_updated', handleQueueUpdated);
      window.removeEventListener('field_officer_synced', handleSynced);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    if (!isOnline) {
      toast.error('Cannot sync while offline. Please connect to internet.');
      return;
    }
    setIsSyncing(true);
    try {
      const res = await fieldOfficerQueue.syncNow(ApiClient);
      if (res.success && res.synced > 0) {
        toast.success(res.message);
      } else if (!res.success) {
        toast.error(res.message);
      }
      await refreshQueueCount();
    } catch (err) {
      toast.error('Sync failed: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  if (isOnline && queuedCount === 0) {
    return null; // All in sync and online, no distraction
  }

  return (
    <div
      className={`w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold shadow-xs transition-colors ${
        !isOnline
          ? 'bg-amber-500 text-amber-950 border-b border-amber-600/30'
          : 'bg-emerald-600 text-white'
      }`}
    >
      <div className="flex items-center gap-2">
        {!isOnline ? (
          <>
            <WifiOff className="w-4 h-4 animate-pulse flex-shrink-0" />
            <span>Offline Mode — All verifications and reports are safely cached locally in IndexedDB.</span>
          </>
        ) : (
          <>
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>
              {queuedCount} {queuedCount === 1 ? 'item' : 'items'} waiting to sync to central servers.
            </span>
          </>
        )}
      </div>

      {queuedCount > 0 && isOnline && (
        <button
          onClick={handleSync}
          disabled={isSyncing}
          className="flex items-center gap-1.5 px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-white font-bold cursor-pointer transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
          <span>{isSyncing ? 'Syncing...' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
}

