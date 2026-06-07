import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { getQueue } from '../lib/syncQueue';
import { Wifi, WifiOff, RefreshCw, Layers } from 'lucide-react';
import { API_URL } from "../config";

interface HeaderProps {
  isOnline: boolean;
  queueVersion: number;
  onSyncTrigger: () => void;
}

export const Header: React.FC<HeaderProps> = ({ isOnline, queueVersion, onSyncTrigger }) => {
  const { users, currentUser, setCurrentUser } = useUser();
  const [pendingCount, setPendingCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    const checkQueue = async () => {
      const q = await getQueue();
      setPendingCount(q.length);
    };
    checkQueue();
  }, [queueVersion]);

  return (
    <header className="glass sticky top-0 z-50 px-6 py-4 flex flex-wrap justify-between items-center gap-4 shadow-lg mb-8">
      {/* Brand logo */}
      <div className="flex items-center space-x-3">
        <div className="bg-brand-500 text-slate-900 p-2 rounded-lg font-bold shadow-md shadow-brand-500/20">
          <Layers className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
            CarbonVerify <span className="text-xs bg-brand-500/20 text-brand-400 px-2 py-0.5 rounded font-mono">MVP</span>
          </h1>
          <p className="text-[10px] text-slate-400">Field Evidence Auditable Pipeline</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex space-x-1 bg-slate-800/80 p-1.5 rounded-lg border border-slate-700/50">
        <Link
          to="/"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            location.pathname === '/' 
              ? 'bg-brand-500 text-slate-950 shadow-md font-bold' 
              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          Capture Center
        </Link>
        
        <Link
          to="/reviewer"
          className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            location.pathname.startsWith('/reviewer') 
              ? 'bg-brand-500 text-slate-950 shadow-md font-bold' 
              : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
          }`}
        >
          Review Board
        </Link>
      </nav>

      {/* Connection status, Sync Queue status, and Mock login */}
      <div className="flex items-center gap-4">
        {/* Connection status */}
        <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
          isOnline ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
        }`}>
          {isOnline ? (
            <>
              <Wifi className="h-3.5 w-3.5" />
              <span>Online Mode</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3.5 w-3.5" />
              <span>Offline Mode</span>
            </>
          )}
        </div>

        {/* Sync queue count */}
        {pendingCount > 0 && (
          <button
            onClick={onSyncTrigger}
            disabled={!isOnline}
            className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold transition ${
              isOnline 
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/35 hover:bg-amber-500/30' 
                : 'bg-slate-800 text-slate-400 border border-slate-700 cursor-not-allowed'
            }`}
            title={isOnline ? "Click to trigger manual upload sync" : "Network offline, cannot sync now"}
          >
            <RefreshCw className={`h-3 w-3 ${isOnline ? 'animate-spin-slow' : ''}`} />
            <span>{pendingCount} Pending Sync</span>
          </button>
        )}

        {/* Mock Login Switcher */}
        <div className="flex items-center gap-2 bg-slate-800/80 px-3 py-1.5 rounded-lg border border-slate-700/50">
          <span className="text-xs text-slate-400 font-mono">User:</span>
          <select
            value={currentUser?.id || ''}
            onChange={(e) => {
              const selected = users.find(u => u.id === e.target.value);
              if (selected) setCurrentUser(selected);
            }}
            className="bg-transparent text-xs text-white focus:outline-none font-semibold cursor-pointer"
          >
            {users.map(u => (
              <option key={u.id} value={u.id} className="bg-slate-900 text-slate-100">
                {u.name} ({u.role})
              </option>
            ))}
          </select>
        </div>
      </div>
    </header>
  );
};
