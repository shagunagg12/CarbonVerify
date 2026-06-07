import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Search, Eye, Filter, RefreshCw, Compass, FileText, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { getQueue } from '../lib/syncQueue';
import type { QueueItem } from '../lib/syncQueue';
import { API_URL } from "../config";

export const ReviewBoard: React.FC = () => {
  const [documents, setDocuments] = useState<any[]>([]);
  const [offlineQueue, setOfflineQueue] = useState<QueueItem[]>([]);
  const [metrics, setMetrics] = useState<any>({
    PROCESSING: 0,
    PENDING: 0,
    APPROVED: 0,
    REJECTED: 0,
    TOTAL: 0
  });
  const [loading, setLoading] = useState(true);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Search filter states
  const [vehicleNum, setVehicleNum] = useState('');
  const [status, setStatus] = useState('');
  const [minWeight, setMinWeight] = useState('');
  const [maxWeight, setMaxWeight] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Fetch metrics & list
  useEffect(() => {
    const fetchDashboardData = async () => {
      setLoading(true);
      try {
        // Fetch offline queue items first
        try {
          const q = await getQueue();
          setOfflineQueue(q);
        } catch (queueErr) {
          console.error('Failed to get offline queue:', queueErr);
        }

        // Build query string
        const queryParams = new URLSearchParams();
        if (vehicleNum) queryParams.append('vehicleNum', vehicleNum);
        if (status) queryParams.append('status', status);
        if (minWeight) queryParams.append('minWeight', minWeight);
        if (maxWeight) queryParams.append('maxWeight', maxWeight);
        if (startDate) queryParams.append('startDate', startDate);
        if (endDate) queryParams.append('endDate', endDate);

        // Fetch docs
        const docsRes = await fetch(`${API_URL}/api/documents?${queryParams.toString()}`);
        if (docsRes.ok) {
          const docsData = await docsRes.json();
          setDocuments(docsData);
        }

        // Fetch metrics
        const metricsRes = await fetch('${API_URL}/api/documents/metrics');
        if (metricsRes.ok) {
          const metricsData = await metricsRes.json();
          setMetrics(metricsData);
        }
      } catch (err) {
        console.error('Failed to load dashboard data', err);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [refreshTrigger, vehicleNum, status, minWeight, maxWeight, startDate, endDate]);

  const handleClearFilters = () => {
    setVehicleNum('');
    setStatus('');
    setMinWeight('');
    setMaxWeight('');
    setStartDate('');
    setEndDate('');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-8">
      {/* 1. Header with Refresh */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-white tracking-tight">Evidence Review Board</h2>
          <p className="text-sm text-slate-400">Verifying extracted field parameters against carbon-removal guidelines.</p>
        </div>
        <button
          onClick={() => setRefreshTrigger(prev => prev + 1)}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold p-2.5 rounded-lg border border-slate-700 hover:border-slate-600 transition flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          <span className="text-sm">Refresh Data</span>
        </button>
      </div>

      {/* 2. Operations Dashboard Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="glass-card rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Pending Review</span>
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <p className="text-2xl font-black text-white mt-4">{metrics.PENDING}</p>
        </div>
        
        <div className="glass-card rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Approved</span>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <p className="text-2xl font-black text-white mt-4">{metrics.APPROVED}</p>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Rejected</span>
            <XCircle className="h-5 w-5 text-rose-500" />
          </div>
          <p className="text-2xl font-black text-white mt-4">{metrics.REJECTED}</p>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-col justify-between">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Processing OCR</span>
            <RefreshCw className="h-5 w-5 text-sky-500 animate-spin-slow" />
          </div>
          <p className="text-2xl font-black text-white mt-4">{metrics.PROCESSING}</p>
        </div>

        <div className="glass-card rounded-xl p-4 flex flex-col justify-between col-span-2 md:col-span-1 bg-gradient-to-br from-brand-950/20 to-slate-900/40 border-brand-500/20">
          <div className="flex justify-between items-start">
            <span className="text-xs text-slate-400 font-bold tracking-wider uppercase font-mono">Total Uploaded</span>
            <FileText className="h-5 w-5 text-slate-400" />
          </div>
          <p className="text-2xl font-black text-white mt-4">{metrics.TOTAL}</p>
        </div>
      </div>

      {/* 3. Search / Filters Panel */}
      <div className="glass-card rounded-2xl p-5 border border-slate-800">
        <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
          <Filter className="h-4 w-4 text-brand-400" /> Search & Filter Parameters
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* Vehicle Number Search */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Vehicle Number</label>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
              <input
                type="text"
                placeholder="e.g. GJ01AB1234"
                value={vehicleNum}
                onChange={(e) => setVehicleNum(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg pl-9 pr-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Status filter */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Audit Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
            >
              <option value="">All Statuses</option>
              <option value="PROCESSING">Processing</option>
              <option value="PENDING">Pending Review</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          {/* Date range filter */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Upload Date Range</label>
            <div className="flex gap-2">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <span className="self-center text-slate-500 text-xs">-</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Weight Range */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-[11px] font-bold text-slate-400 uppercase font-mono">Weight Range (Tonnes)</label>
            <div className="flex gap-2">
              <input
                type="number"
                step="0.01"
                placeholder="Min Weight"
                value={minWeight}
                onChange={(e) => setMinWeight(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
              <span className="self-center text-slate-500 text-xs">-</span>
              <input
                type="number"
                step="0.01"
                placeholder="Max Weight"
                value={maxWeight}
                onChange={(e) => setMaxWeight(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
              />
            </div>
          </div>

          {/* Reset Filters button */}
          <div className="flex items-end md:col-span-2">
            <button
              onClick={handleClearFilters}
              className="py-2 px-4 rounded-lg bg-slate-800 text-xs text-slate-300 font-bold hover:bg-slate-700 hover:text-white transition"
            >
              Clear Search Criteria
            </button>
          </div>
        </div>
      </div>

      {/* 4. Table / List of Documents */}
      <div className="glass-card rounded-2xl overflow-hidden border border-slate-800 shadow-xl">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
            <RefreshCw className="h-8 w-8 animate-spin text-brand-400" />
            <span className="text-sm font-semibold">Retrieving Evidence Documents...</span>
          </div>
        ) : (documents.length === 0 && offlineQueue.length === 0) ? (
          <div className="py-20 text-center text-slate-400">
            <Compass className="h-10 w-10 mx-auto text-slate-600 mb-2" />
            <p className="text-sm font-bold">No documents match the search criteria.</p>
            <p className="text-xs text-slate-600 mt-1">Try adjusting your filters or upload new evidence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-800/60 text-[10px] font-bold text-slate-400 tracking-wider uppercase font-mono border-b border-slate-800">
                  <th className="px-6 py-4">Evidence Doc</th>
                  <th className="px-6 py-4">Vehicle ID</th>
                  <th className="px-6 py-4">Weight (T)</th>
                  <th className="px-6 py-4">Date</th>
                  <th className="px-6 py-4">Audit Status</th>
                  <th className="px-6 py-4">Uploaded At</th>
                  <th className="px-6 py-4 text-right">Review Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {[
                  ...offlineQueue
                    .filter(_item => !status || status === 'PROCESSING')
                    .map(item => ({
                      id: item.id,
                      filename: item.filename,
                      filePath: '',
                      status: 'OFFLINE_QUEUE',
                      uploadedAt: item.timestamp,
                      isOffline: true,
                      extractedData: null
                    })),
                  ...documents
                ].map((doc) => {
                  const ext = doc.extractedData;
                  return (
                    <tr key={doc.id} className="hover:bg-slate-800/30 transition text-sm text-slate-300">
                      
                      {/* Document Details */}
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded bg-slate-900 border border-slate-700/60 overflow-hidden shrink-0 flex items-center justify-center">
                            {doc.isOffline ? (
                              <FileText className="h-6 w-6 text-amber-500 animate-pulse" />
                            ) : (
                              <img
                                src={`${API_URL}${doc.filePath}`}
                                alt={doc.filename}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                }}
                              />
                            )}
                          </div>
                          <div className="overflow-hidden max-w-[160px]">
                            <p className="font-semibold text-white truncate">{doc.filename}</p>
                            <p className="text-[10px] text-slate-500 font-mono truncate">{doc.id.substring(0, 8)}...</p>
                          </div>
                        </div>
                      </td>

                      {/* Vehicle Num */}
                      <td className="px-6 py-4 font-mono font-bold">
                        {ext?.vehicleNum || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Weight */}
                      <td className="px-6 py-4">
                        {ext?.weight !== null && ext?.weight !== undefined ? (
                          <span>{ext.weight} t</span>
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      {/* Date */}
                      <td className="px-6 py-4">
                        {ext?.date || <span className="text-slate-600">—</span>}
                      </td>

                      {/* Status */}
                      <td className="px-6 py-4">
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${
                          doc.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                          doc.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                          doc.status === 'PROCESSING' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
                          doc.status === 'OFFLINE_QUEUE' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20 animate-pulse' :
                          'bg-amber-500/10 text-amber-400 border-amber-500/20'
                        }`}>
                          {doc.status === 'OFFLINE_QUEUE' ? 'WAITING SYNC' : doc.status}
                        </span>
                      </td>

                      {/* Uploaded At */}
                      <td className="px-6 py-4 text-xs text-slate-500 font-mono">
                        {new Date(doc.uploadedAt).toLocaleString()}
                      </td>

                      {/* Review Link */}
                      <td className="px-6 py-4 text-right">
                        {doc.isOffline ? (
                          <span className="text-xs text-slate-500 italic font-medium px-3 py-1.5 inline-block">
                            Waiting sync
                          </span>
                        ) : (
                          <Link
                            to={`/reviewer/document/${doc.id}`}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white border border-slate-700 transition"
                          >
                            <Eye className="h-3.5 w-3.5" />
                            <span>Review</span>
                          </Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
