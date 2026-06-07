import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useUser } from '../context/UserContext';
import { Check, X, ArrowLeft, RefreshCw, AlertCircle, FileText, Shield, Activity } from 'lucide-react';

export const DocumentDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser } = useUser();

  const [document, setDocument] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Form states
  const [weight, setWeight] = useState('');
  const [vehicleNum, setVehicleNum] = useState('');
  const [date, setDate] = useState('');
  const [driverName, setDriverName] = useState('');
  
  // Highlight state for bounding boxes
  const [hoveredField, setHoveredField] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const fetchDocument = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/documents/${id}`);
      if (!res.ok) {
        throw new Error('Failed to load document details');
      }
      const data = await res.json();
      setDocument(data);
      
      // Initialize form values
      if (data.extractedData) {
        setWeight(data.extractedData.weight?.toString() || '');
        setVehicleNum(data.extractedData.vehicleNum || '');
        setDate(data.extractedData.date || '');
        setDriverName(data.extractedData.driverName || '');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocument();
  }, [id]);

  const handleReview = async (newStatus: 'APPROVED' | 'REJECTED' | 'PENDING') => {
    if (!currentUser) return;
    setSaving(true);
    try {
      const response = await fetch(`${API_URL}/api/documents/${id}/review`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: newStatus,
          weight: weight ? parseFloat(weight) : null,
          vehicleNum,
          date,
          driverName,
          userId: currentUser.id
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || 'Failed to update review status.');
      }

      await fetchDocument(); // Refresh to load new audit logs
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-slate-400 gap-3">
        <RefreshCw className="h-8 w-8 animate-spin text-brand-400" />
        <span className="text-sm font-semibold">Retrieving Evidence Details & Extraction Coordinates...</span>
      </div>
    );
  }

  if (error || !document) {
    return (
      <div className="max-w-2xl mx-auto py-10 px-4 text-center space-y-4">
        <AlertCircle className="h-12 w-12 mx-auto text-rose-500" />
        <h2 className="text-xl font-bold text-white">Error Loading Document</h2>
        <p className="text-slate-400">{error || 'The requested document does not exist.'}</p>
        <button
          onClick={() => navigate('/reviewer')}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-sm font-bold text-white rounded-lg border border-slate-700 transition"
        >
          Back to Review Board
        </button>
      </div>
    );
  }

  const ext = document.extractedData;

  // Helper to check if a value has been manually edited
  const isEdited = (fieldName: string, _currentVal: any) => {
    if (!ext) return false;
    return ext[`${fieldName}Source`] === 'MANUAL';
  };

  // Helper to color code confidence scores
  const getConfidenceBadgeClass = (score: number | null | undefined) => {
    if (score === null || score === undefined) return 'bg-slate-800 text-slate-500';
    if (score >= 85) return 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30';
    if (score >= 60) return 'bg-amber-500/15 text-amber-400 border border-amber-500/30';
    return 'bg-rose-500/15 text-rose-400 border border-rose-500/30';
  };

  return (
    <div className="max-w-7xl mx-auto px-4 space-y-6">
      {/* Navigation & Header */}
      <div className="flex justify-between items-center flex-wrap gap-4">
        <button
          onClick={() => navigate('/reviewer')}
          className="inline-flex items-center gap-2 text-sm text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Review Board
        </button>
        
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400">Document Status:</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
            document.status === 'APPROVED' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
            document.status === 'REJECTED' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
            document.status === 'PROCESSING' ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' :
            'bg-amber-500/10 text-amber-400 border-amber-500/20'
          }`}>
            {document.status}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-8">
        {/* Left: Original Document Image with Bounding Box overlays (SVG-based) */}
        <div className="lg:col-span-6 space-y-4">
          <div className="glass-card rounded-2xl p-4 flex flex-col">
            <h3 className="text-sm font-bold text-white mb-3 flex items-center gap-2">
              <FileText className="h-4 w-4 text-brand-400" /> Original Document
            </h3>
            
            <div className="relative w-full aspect-[4/5] bg-slate-950 rounded-xl overflow-hidden border border-slate-800 shadow-2xl flex items-center justify-center">
              <img
                src={`${API_URL}${document.filePath}`}
                alt={document.filename}
                className="w-full h-full object-contain pointer-events-none select-none"
              />

              {/* Bounding Box SVG overlay using normalized % coordinates */}
              <svg className="absolute inset-0 w-full h-full select-none pointer-events-none">
                {ext && ['weight', 'vehicleNum', 'date', 'driverName'].map((key) => {
                  const box = ext[`${key}Box`];
                  if (!box || typeof box !== 'object') return null;
                  
                  const isHovered = hoveredField === key;
                  
                  return (
                    <g key={key}>
                      {/* Bounding box rectangle */}
                      <rect
                        x={`${box.x0}%`}
                        y={`${box.y0}%`}
                        width={`${box.x1 - box.x0}%`}
                        height={`${box.y1 - box.y0}%`}
                        className={`transition-all duration-200 fill-none stroke-[2px] ${
                          isHovered 
                            ? 'stroke-brand-400 fill-brand-500/10 stroke-[3px]' 
                            : 'stroke-amber-500/40 fill-none'
                        }`}
                      />
                      {/* Bounding Box label (shown when hovered) */}
                      {isHovered && (
                        <foreignObject
                          x={`${box.x0}%`}
                          y={`${Math.max(0, box.y0 - 5)}%`}
                          width="120"
                          height="20"
                          className="overflow-visible"
                        >
                          <div className="bg-brand-500 text-slate-950 text-[9px] font-bold px-1 py-0.5 rounded shadow shadow-brand-500/30 whitespace-nowrap capitalize inline-block -translate-y-1">
                            {key === 'vehicleNum' ? 'Vehicle Num' : key}
                          </div>
                        </foreignObject>
                      )}
                    </g>
                  );
                })}
              </svg>
            </div>
            
            <p className="text-[10px] text-slate-500 mt-2 text-center">
              Bounding boxes show where the OCR pipeline located the extracted parameters on the image.
            </p>
          </div>
        </div>

        {/* Right: Extracted fields forms + Audit logs */}
        <div className="lg:col-span-6 space-y-6">
          {/* Extracted Fields Form */}
          <div className="glass-card rounded-2xl p-6 space-y-6">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Shield className="h-5 w-5 text-brand-400" /> Extracted Parameters Verification
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Edit extracted parameters if OCR confidence is low. Verify values against original document document.
              </p>
            </div>

            <div className="space-y-4">
              {/* Field: Weight */}
              <div
                className={`p-3 rounded-xl border transition ${
                  hoveredField === 'weight' ? 'bg-slate-800/40 border-brand-500/40' : 'bg-slate-900/30 border-slate-800'
                }`}
                onMouseEnter={() => setHoveredField('weight')}
                onMouseLeave={() => setHoveredField(null)}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    Weighbridge Slip weight (Tonnes)
                    {isEdited('weight', weight) && (
                      <span className="bg-brand-500/10 text-brand-400 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-500/25 uppercase tracking-wide">
                        Corrected
                      </span>
                    )}
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getConfidenceBadgeClass(ext?.weightConf)}`}>
                    OCR Conf: {ext?.weightConf ?? 0}%
                  </span>
                </div>
                <input
                  type="number"
                  step="0.01"
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Field: Vehicle Num */}
              <div
                className={`p-3 rounded-xl border transition ${
                  hoveredField === 'vehicleNum' ? 'bg-slate-800/40 border-brand-500/40' : 'bg-slate-900/30 border-slate-800'
                }`}
                onMouseEnter={() => setHoveredField('vehicleNum')}
                onMouseLeave={() => setHoveredField(null)}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    Vehicle Number
                    {isEdited('vehicleNum', vehicleNum) && (
                      <span className="bg-brand-500/10 text-brand-400 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-500/25 uppercase tracking-wide">
                        Corrected
                      </span>
                    )}
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getConfidenceBadgeClass(ext?.vehicleNumConf)}`}>
                    OCR Conf: {ext?.vehicleNumConf ?? 0}%
                  </span>
                </div>
                <input
                  type="text"
                  value={vehicleNum}
                  onChange={(e) => setVehicleNum(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 font-mono font-bold"
                />
              </div>

              {/* Field: Date */}
              <div
                className={`p-3 rounded-xl border transition ${
                  hoveredField === 'date' ? 'bg-slate-800/40 border-brand-500/40' : 'bg-slate-900/30 border-slate-800'
                }`}
                onMouseEnter={() => setHoveredField('date')}
                onMouseLeave={() => setHoveredField(null)}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    Dispatch Date
                    {isEdited('date', date) && (
                      <span className="bg-brand-500/10 text-brand-400 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-500/25 uppercase tracking-wide">
                        Corrected
                      </span>
                    )}
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getConfidenceBadgeClass(ext?.dateConf)}`}>
                    OCR Conf: {ext?.dateConf ?? 0}%
                  </span>
                </div>
                <input
                  type="text"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>

              {/* Field: Driver Name */}
              <div
                className={`p-3 rounded-xl border transition ${
                  hoveredField === 'driverName' ? 'bg-slate-800/40 border-brand-500/40' : 'bg-slate-900/30 border-slate-800'
                }`}
                onMouseEnter={() => setHoveredField('driverName')}
                onMouseLeave={() => setHoveredField(null)}
              >
                <div className="flex justify-between items-center mb-1.5">
                  <label className="text-[11px] font-bold text-slate-400 uppercase font-mono flex items-center gap-1.5">
                    Driver / Operator Name
                    {isEdited('driverName', driverName) && (
                      <span className="bg-brand-500/10 text-brand-400 text-[9px] font-semibold px-1.5 py-0.5 rounded border border-brand-500/25 uppercase tracking-wide">
                        Corrected
                      </span>
                    )}
                  </label>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${getConfidenceBadgeClass(ext?.driverNameConf)}`}>
                    OCR Conf: {ext?.driverNameConf ?? 0}%
                  </span>
                </div>
                <input
                  type="text"
                  value={driverName}
                  onChange={(e) => setDriverName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700/60 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500"
                />
              </div>
            </div>

            {/* Review Decision Buttons */}
            <div className="grid grid-cols-3 gap-3 pt-4 border-t border-slate-800">
              <button
                type="button"
                onClick={() => handleReview('REJECTED')}
                disabled={saving || currentUser?.role !== 'REVIEWER'}
                className="py-3 px-4 rounded-xl font-bold bg-rose-600 hover:bg-rose-500 text-white transition flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Reject Doc
              </button>
              
              <button
                type="button"
                onClick={() => handleReview('PENDING')}
                disabled={saving || currentUser?.role !== 'REVIEWER'}
                className="py-3 px-4 rounded-xl font-bold bg-slate-800 hover:bg-slate-700 text-white transition flex items-center justify-center gap-1.5 text-xs border border-slate-700 disabled:opacity-50"
              >
                Save Edits
              </button>

              <button
                type="button"
                onClick={() => handleReview('APPROVED')}
                disabled={saving || currentUser?.role !== 'REVIEWER'}
                className="py-3 px-4 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black transition flex items-center justify-center gap-1.5 text-xs disabled:opacity-50"
              >
                <Check className="h-4 w-4 text-slate-950 stroke-[3px]" />
                Approve Doc
              </button>
            </div>
            {currentUser?.role !== 'REVIEWER' && (
              <p className="text-[10px] text-rose-400 mt-1 font-medium text-center">
                * Please switch your mock user profile in the header header to "Reviewer" to approve or reject this document.
              </p>
            )}
          </div>

          {/* Audit Logs Trail */}
          <div className="glass-card rounded-2xl p-6 space-y-4">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-brand-400" /> Complete Audit Trail
            </h3>

            <div className="space-y-4 max-h-[250px] overflow-y-auto pr-2">
              {document.auditLogs.map((log: any) => {
                return (
                  <div key={log.id} className="text-xs border-l-2 border-slate-800 pl-3 py-0.5 space-y-1 relative">
                    {/* Timestamp bullet */}
                    <div className="absolute w-2 h-2 rounded-full bg-slate-700 -left-[5px] top-1.5" />
                    
                    <div className="flex justify-between text-slate-400 font-mono text-[10px]">
                      <span>{log.user?.name || 'OCR pipeline'}</span>
                      <span>{new Date(log.timestamp).toLocaleString()}</span>
                    </div>

                    <p className="text-slate-200">
                      {log.action === 'UPLOAD' && (
                        <span>Uploaded document <strong className="text-slate-100 font-medium">"{log.newValue}"</strong></span>
                      )}
                      {log.action === 'OCR_EXTRACT' && (
                        <span>System OCR extracted <span className="capitalize">{log.field === 'vehicleNum' ? 'Vehicle Num' : log.field}</span>: <strong className="text-white">"{log.newValue}"</strong></span>
                      )}
                      {log.action === 'EDIT_FIELD' && (
                        <span>Corrected <span className="capitalize">{log.field === 'vehicleNum' ? 'Vehicle Num' : log.field}</span> from <span className="text-slate-400">"{log.oldValue || '—'}"</span> to <strong className="text-white">"{log.newValue || '—'}"</strong></span>
                      )}
                      {log.action === 'APPROVED' && (
                        <span className="text-emerald-400 font-semibold uppercase">Document Approved</span>
                      )}
                      {log.action === 'REJECTED' && (
                        <span className="text-rose-400 font-semibold uppercase">Document Rejected</span>
                      )}
                      {log.action === 'OCR_FAILED' && (
                        <span className="text-rose-400 font-semibold">OCR processing failed: "{log.newValue}"</span>
                      )}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
