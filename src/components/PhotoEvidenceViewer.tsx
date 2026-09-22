import React, { useState, useEffect, useRef } from 'react';
import {
  Camera,
  CameraOff,
  X,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Download,
  Copy,
  Check,
  ShieldCheck,
  Database,
  MapPin,
  Calendar,
  AlertTriangle,
  Upload,
  RefreshCw,
  Sparkles,
  Layers,
  Flame,
  CheckCircle2,
  ExternalLink
} from 'lucide-react';
import { IssueReportSample } from '../types/civic';
import { CameraCapturePlaceholder, CapturedImageInfo } from './CameraCapturePlaceholder';
import { simulateSaveIncidentPhoto } from '../utils/civicMediaStorage';

export interface PhotoEvidenceViewerProps {
  isOpen: boolean;
  onClose: () => void;
  report: IssueReportSample | null;
  clusterReports?: IssueReportSample[];
  onAttachPhoto?: (
    reportId: string,
    dataUrl: string,
    metadata?: IssueReportSample['imageStorageMetadata']
  ) => void;
}

const CATEGORY_PRESET_IMAGES: Record<string, { url: string; label: string }> = {
  pothole: {
    url: 'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=1200&auto=format&fit=crop&q=80',
    label: 'Asphalt Road Crater & Trench',
  },
  streetlight: {
    url: 'https://images.unsplash.com/photo-1509198397868-475647b2a1e5?w=1200&auto=format&fit=crop&q=80',
    label: 'Defective Street Luminaire',
  },
  garbage: {
    url: 'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=1200&auto=format&fit=crop&q=80',
    label: 'Solid Waste Accumulation',
  },
  drainage: {
    url: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=1200&auto=format&fit=crop&q=80',
    label: 'Stormwater Sump Inundation',
  },
  water_leak: {
    url: 'https://images.unsplash.com/photo-1584467735815-f778f274e296?w=1200&auto=format&fit=crop&q=80',
    label: 'Pressurized Pipe Fracture',
  },
};

export const PhotoEvidenceViewer: React.FC<PhotoEvidenceViewerProps> = ({
  isOpen,
  onClose,
  report,
  clusterReports = [],
  onAttachPhoto,
}) => {
  const [currentReportIndex, setCurrentReportIndex] = useState<number>(0);
  const [isZoomed, setIsZoomed] = useState<boolean>(false);
  const [isInlineCapturing, setIsInlineCapturing] = useState<boolean>(false);
  const [copiedKey, setCopiedKey] = useState<boolean>(false);
  const [imageLoadError, setImageLoadError] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Available reports list: prioritize cluster reports if given, otherwise just current report
  const reportList = clusterReports.length > 0
    ? clusterReports
    : report
    ? [report]
    : [];

  // Synchronize current report index whenever the incoming report prop changes
  useEffect(() => {
    if (report && reportList.length > 0) {
      const idx = reportList.findIndex((r) => r.id === report.id);
      if (idx !== -1) {
        setCurrentReportIndex(idx);
      } else {
        setCurrentReportIndex(0);
      }
    }
    setIsZoomed(false);
    setIsInlineCapturing(false);
    setImageLoadError(false);
  }, [report, clusterReports]);

  // Keyboard navigation & escape listener
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && reportList.length > 1) {
        setCurrentReportIndex((prev) => (prev + 1) % reportList.length);
        setIsZoomed(false);
        setIsInlineCapturing(false);
        setImageLoadError(false);
      } else if (e.key === 'ArrowLeft' && reportList.length > 1) {
        setCurrentReportIndex((prev) => (prev - 1 + reportList.length) % reportList.length);
        setIsZoomed(false);
        setIsInlineCapturing(false);
        setImageLoadError(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, reportList.length, onClose]);

  if (!isOpen || !report) return null;

  const activeReport = reportList[currentReportIndex] || report;
  const hasImage = !!activeReport.imagePreview && !imageLoadError;

  const storageBucket =
    activeReport.imageStorageMetadata?.storageBucket ||
    'civic-media-vault-india.s3.ap-south-1.amazonaws.com';
  const objectKey =
    activeReport.imageStorageMetadata?.objectKey ||
    `incidents/${activeReport.id}/evidence_${activeReport.category}.jpg`;
  const resolution = activeReport.imageStorageMetadata?.resolution || '1280x720 (HD)';
  const deviceSource = activeReport.imageStorageMetadata?.deviceSource || 'camera_api';
  const capturedTimestamp =
    activeReport.imageStorageMetadata?.capturedAt || activeReport.reportedAt;

  // Save new photo attachment
  const handlePhotoCaptured = (dataUrl: string, source: 'camera_api' | 'device_upload' | 'verified_catalog' = 'camera_api') => {
    const mediaRecord = simulateSaveIncidentPhoto(activeReport.id, dataUrl, {
      deviceSource: source,
      resolution: '1280x720 HD',
    });

    const metadata = {
      storageBucket: mediaRecord.storageBucket,
      objectKey: mediaRecord.objectKey,
      fileSizeBytes: mediaRecord.fileSizeBytes,
      capturedAt: mediaRecord.capturedAt,
      deviceSource: mediaRecord.deviceSource,
      resolution: mediaRecord.resolution,
    };

    if (onAttachPhoto) {
      onAttachPhoto(activeReport.id, dataUrl, metadata);
    }

    setIsInlineCapturing(false);
    setImageLoadError(false);
  };

  const handleCopyObjectKey = () => {
    navigator.clipboard.writeText(`s3://${storageBucket}/${objectKey}`);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  };

  const handleDownload = () => {
    if (!activeReport.imagePreview) return;
    const link = document.createElement('a');
    link.href = activeReport.imagePreview;
    link.download = `${activeReport.id}_evidence.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      handlePhotoCaptured(dataUrl, 'device_upload');
    };
    reader.readAsDataURL(file);
  };

  const preset = CATEGORY_PRESET_IMAGES[activeReport.category] || CATEGORY_PRESET_IMAGES.pothole;

  return (
    <div
      id="photo-evidence-viewer-modal"
      className="fixed inset-0 z-50 bg-stone-950/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-in fade-in duration-200"
      onClick={onClose}
    >
      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileUpload}
      />

      <div
        className="bg-stone-900 text-white rounded-2xl max-w-4xl w-full border border-stone-800 shadow-2xl overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* HEADER BAR */}
        <div className="p-3.5 sm:p-4 bg-stone-950 border-b border-stone-800/90 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-400 shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-stone-800 text-stone-200 border border-stone-700">
                  {activeReport.id}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded uppercase font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {activeReport.category.replace('_', ' ')}
                </span>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-stone-800/80 text-stone-400 border border-stone-700">
                  {activeReport.status}
                </span>
                {reportList.length > 1 && (
                  <span className="text-[11px] font-mono text-stone-400 hidden sm:inline">
                    ({currentReportIndex + 1} of {reportList.length} in cluster)
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate mt-0.5">
                {activeReport.title}
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {/* Cluster Navigation Controls if multiple reports */}
            {reportList.length > 1 && (
              <div className="flex items-center gap-1 bg-stone-800/70 p-1 rounded-lg border border-stone-700/80 mr-1">
                <button
                  type="button"
                  onClick={() => {
                    setCurrentReportIndex((prev) => (prev - 1 + reportList.length) % reportList.length);
                    setIsZoomed(false);
                    setIsInlineCapturing(false);
                    setImageLoadError(false);
                  }}
                  className="p-1 text-stone-300 hover:text-white hover:bg-stone-700 rounded transition-colors"
                  title="Previous Incident (Left Arrow)"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-[10.5px] font-mono px-1 text-stone-400">
                  {currentReportIndex + 1}/{reportList.length}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setCurrentReportIndex((prev) => (prev + 1) % reportList.length);
                    setIsZoomed(false);
                    setIsInlineCapturing(false);
                    setImageLoadError(false);
                  }}
                  className="p-1 text-stone-300 hover:text-white hover:bg-stone-700 rounded transition-colors"
                  title="Next Incident (Right Arrow)"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}

            {hasImage && !isInlineCapturing && (
              <>
                <button
                  type="button"
                  onClick={() => setIsZoomed(!isZoomed)}
                  className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                  title={isZoomed ? 'Zoom Out' : 'Zoom In'}
                >
                  {isZoomed ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
                </button>
                <button
                  type="button"
                  onClick={handleDownload}
                  className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors"
                  title="Download Evidence"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-stone-400 hover:text-white hover:bg-stone-800 rounded-lg transition-colors ml-1"
              title="Close (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* MAIN DISPLAY AREA */}
        <div className="relative flex-1 overflow-y-auto min-h-[300px] max-h-[58vh] bg-stone-950 flex items-center justify-center p-2 sm:p-4">
          {/* CASE A: INLINE CAMERA CAPTURE / UPLOAD IN PROGRESS */}
          {isInlineCapturing ? (
            <div className="w-full max-w-lg p-2 bg-stone-900 rounded-xl border border-stone-800 shadow-xl">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-stone-800">
                <span className="text-xs font-bold text-stone-200 flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-400" />
                  Capture Ground Evidence for {activeReport.id}
                </span>
                <button
                  type="button"
                  onClick={() => setIsInlineCapturing(false)}
                  className="text-stone-400 hover:text-white text-xs px-2 py-0.5 rounded hover:bg-stone-800"
                >
                  Cancel
                </button>
              </div>
              <CameraCapturePlaceholder
                onImageCaptured={(info) => {
                  if (info) {
                    handlePhotoCaptured(info.dataUrl, info.source);
                  }
                }}
                currentImage={activeReport.imagePreview}
                locationName={activeReport.address || activeReport.ward}
              />
            </div>
          ) : hasImage ? (
            /* CASE B: PHOTO EVIDENCE LIGHTBOX */
            <div className="relative w-full h-full flex flex-col items-center justify-center select-none group">
              <div
                className={`relative overflow-hidden transition-all duration-200 rounded-lg max-h-[52vh] flex items-center justify-center ${
                  isZoomed ? 'cursor-zoom-out scale-125 z-20' : 'cursor-zoom-in'
                }`}
                onClick={() => setIsZoomed(!isZoomed)}
              >
                <img
                  src={activeReport.imagePreview}
                  alt={`Incident ${activeReport.id} Field Evidence`}
                  referrerPolicy="no-referrer"
                  className="max-h-[50vh] max-w-full object-contain rounded-lg shadow-2xl border border-stone-800"
                  onError={() => setImageLoadError(true)}
                />

                {/* Overlaid HUD Geotag Badge */}
                <div className="absolute top-2.5 left-2.5 px-2 py-1 bg-stone-950/80 backdrop-blur-xs rounded-md text-[10px] font-mono text-stone-300 border border-white/10 flex items-center gap-1.5 pointer-events-none">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  <span>{capturedTimestamp}</span>
                  <span className="text-stone-500">&bull;</span>
                  <span>{resolution}</span>
                </div>

                {/* Overlaid Security Stamp */}
                <div className="absolute bottom-2.5 right-2.5 px-2 py-1 bg-stone-950/85 backdrop-blur-xs rounded-md text-[10px] font-mono text-emerald-400 border border-emerald-500/30 flex items-center gap-1 pointer-events-none">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>SHA-256 VAULT VERIFIED</span>
                </div>
              </div>
            </div>
          ) : (
            /* CASE C: GRACEFUL PLACEHOLDER WHEN NO IMAGE IS ATTACHED */
            <div
              id="photo-evidence-graceful-placeholder"
              className="w-full max-w-xl py-6 px-4 sm:px-8 text-center flex flex-col items-center justify-center animate-in fade-in duration-200"
            >
              {/* Radar & Camera Off Visual */}
              <div className="relative mb-4">
                <div className="w-20 h-20 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center text-stone-500 shadow-inner">
                  <CameraOff className="w-9 h-9 text-stone-400" />
                </div>
                <div className="absolute -inset-2 rounded-full border border-blue-500/20 animate-ping pointer-events-none" />
                <div className="absolute -top-1 -right-1 px-1.5 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 rounded text-[9px] font-mono font-bold">
                  NO EVIDENCE
                </div>
              </div>

              <h4 className="text-base font-bold text-white mb-1">
                No Field Photo Attached Yet
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto mb-4 leading-relaxed">
                Incident <span className="font-mono text-stone-200 font-bold">{activeReport.id}</span> was logged via GPS geotagging, but no photographic ground confirmation is currently in the municipal cloud media vault.
              </p>

              {/* Telemetry Capsule */}
              <div className="w-full bg-stone-900/90 border border-stone-800 rounded-xl p-3 mb-5 text-left grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs font-mono">
                <div className="p-2 rounded bg-stone-950/60 border border-stone-800/60">
                  <span className="text-stone-500 text-[10px] block">COORDINATES</span>
                  <span className="text-stone-200 text-[11px] font-semibold truncate block">
                    {activeReport.latitude.toFixed(4)}, {activeReport.longitude.toFixed(4)}
                  </span>
                </div>
                <div className="p-2 rounded bg-stone-950/60 border border-stone-800/60">
                  <span className="text-stone-500 text-[10px] block">SEVERITY / PRIORITY</span>
                  <span className="text-amber-400 text-[11px] font-semibold block">
                    {activeReport.severityScore}/10 ({activeReport.hazardWeight}x)
                  </span>
                </div>
                <div className="p-2 rounded bg-stone-950/60 border border-stone-800/60">
                  <span className="text-stone-500 text-[10px] block">WARD LOCATION</span>
                  <span className="text-stone-200 text-[11px] font-semibold truncate block" title={activeReport.ward || activeReport.address}>
                    {activeReport.ward || activeReport.address || 'Central'}
                  </span>
                </div>
                <div className="p-2 rounded bg-stone-950/60 border border-stone-800/60">
                  <span className="text-stone-500 text-[10px] block">CONFIRMATIONS</span>
                  <span className="text-emerald-400 text-[11px] font-semibold block">
                    {activeReport.upvotes} Upvotes
                  </span>
                </div>
              </div>

              {/* Action Buttons to Add Photo */}
              <div className="flex flex-wrap items-center justify-center gap-2.5">
                <button
                  id="btn-viewer-open-camera"
                  type="button"
                  onClick={() => setIsInlineCapturing(true)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white rounded-xl text-xs font-bold flex items-center gap-2 shadow-lg shadow-blue-900/30 transition-all hover:scale-102"
                >
                  <Camera className="w-4 h-4" />
                  <span>Take Live Photo (Camera API)</span>
                </button>

                <button
                  id="btn-viewer-upload-photo"
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3.5 py-2 bg-stone-800 hover:bg-stone-700 text-stone-200 border border-stone-700 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Upload Image</span>
                </button>

                <button
                  id="btn-viewer-simulate-preset"
                  type="button"
                  onClick={() => handlePhotoCaptured(preset.url, 'verified_catalog')}
                  className="px-3 py-2 bg-stone-800/60 hover:bg-stone-800 text-amber-400 hover:text-amber-300 border border-stone-700/80 rounded-xl text-xs font-mono font-medium flex items-center gap-1.5 transition-all"
                  title="Simulate verified municipal field evidence for presentation"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Simulate {activeReport.category} Photo</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* METADATA INSPECTOR FOOTER */}
        <div className="p-3 sm:p-4 bg-stone-950 border-t border-stone-800 text-xs font-mono text-stone-400">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            {/* Storage details */}
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-stone-300">
                <Database className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-stone-500">Cloud Media Vault:</span>
                <span className="text-stone-200 font-semibold truncate max-w-[220px]" title={storageBucket}>
                  {storageBucket.split('.')[0]}
                </span>
              </div>

              <span className="text-stone-700 hidden sm:inline">&bull;</span>

              <div className="flex items-center gap-1.5 text-stone-300">
                <span className="text-stone-500">Key:</span>
                <code className="text-stone-200 bg-stone-900 px-1.5 py-0.5 rounded border border-stone-800 truncate max-w-[180px] sm:max-w-[240px]">
                  {objectKey}
                </code>
                <button
                  type="button"
                  onClick={handleCopyObjectKey}
                  className="p-1 hover:text-white text-stone-500 rounded transition-colors"
                  title="Copy S3 URI"
                >
                  {copiedKey ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              {hasImage && (
                <button
                  type="button"
                  onClick={() => setIsInlineCapturing(true)}
                  className="px-2.5 py-1 text-xs bg-stone-800 hover:bg-stone-700 text-stone-200 rounded-lg flex items-center gap-1.5 transition-colors"
                  title="Update with camera capture"
                >
                  <RefreshCw className="w-3 h-3 text-emerald-400" />
                  <span>Update Photo</span>
                </button>
              )}

              <div className="text-[11px] text-stone-500 flex items-center gap-1">
                <MapPin className="w-3 h-3 text-stone-400" />
                <span className="truncate max-w-[180px]">
                  {activeReport.address || activeReport.ward || `${activeReport.latitude.toFixed(4)}, ${activeReport.longitude.toFixed(4)}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
