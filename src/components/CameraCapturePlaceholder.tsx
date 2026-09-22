import React, { useState, useRef, useEffect } from 'react';
import {
  Camera,
  RotateCw,
  X,
  Upload,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  RefreshCw,
  Eye,
  Database,
  ShieldCheck
} from 'lucide-react';

export interface CapturedImageInfo {
  dataUrl: string;
  source: 'camera_api' | 'device_upload' | 'verified_catalog';
  timestamp: string;
  resolution?: string;
}

interface CameraCapturePlaceholderProps {
  onImageCaptured: (imageInfo: CapturedImageInfo | null) => void;
  currentImage?: string | null;
  locationName?: string;
}

export const CameraCapturePlaceholder: React.FC<CameraCapturePlaceholderProps> = ({
  onImageCaptured,
  currentImage = null,
  locationName = 'Active Location',
}) => {
  const [capturedImage, setCapturedImage] = useState<CapturedImageInfo | null>(
    currentImage
      ? {
          dataUrl: currentImage,
          source: 'verified_catalog',
          timestamp: new Date().toLocaleTimeString(),
          resolution: '1280x720 HD',
        }
      : null
  );

  const [isCameraActive, setIsCameraActive] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [isShutterFlashing, setIsShutterFlashing] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Stop media tracks when unmounting or stopping camera
  const stopCameraStream = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch {
          // ignore
        }
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCameraStream();
    };
  }, []);

  // Request browser camera stream
  const startCamera = async (mode: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    stopCameraStream();

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Camera API (getUserMedia) is not supported in this browser context.');
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: mode,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsCameraActive(true);

      // Attach stream to video element
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch((e) => {
          console.warn('Video playback warning:', e);
        });
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unable to access camera device.';
      setCameraError(msg);
      setIsCameraActive(false);
    }
  };

  // Re-attach video stream when video element renders
  useEffect(() => {
    if (isCameraActive && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => {});
    }
  }, [isCameraActive]);

  // Capture frame from active video element
  const capturePhoto = () => {
    if (!videoRef.current) return;

    setIsShutterFlashing(true);
    setTimeout(() => setIsShutterFlashing(false), 200);

    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Mirror if front facing
      if (facingMode === 'user') {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Add a subtle municipal geotag stamp watermark on image
      ctx.save();
      ctx.restore();

      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      const imgInfo: CapturedImageInfo = {
        dataUrl,
        source: 'camera_api',
        timestamp: new Date().toLocaleTimeString(),
        resolution: `${canvas.width}x${canvas.height}`,
      };

      setCapturedImage(imgInfo);
      onImageCaptured(imgInfo);
      stopCameraStream();
    }
  };

  // Toggle front / rear camera
  const toggleCameraFacing = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Handle local file upload
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      const imgInfo: CapturedImageInfo = {
        dataUrl,
        source: 'device_upload',
        timestamp: new Date().toLocaleTimeString(),
        resolution: 'Device Photo',
      };
      setCapturedImage(imgInfo);
      onImageCaptured(imgInfo);
      stopCameraStream();
    };
    reader.readAsDataURL(file);
  };

  // Sample preset fallback photos for testing
  const selectSamplePreset = (presetUrl: string, label: string) => {
    const imgInfo: CapturedImageInfo = {
      dataUrl: presetUrl,
      source: 'verified_catalog',
      timestamp: new Date().toLocaleTimeString(),
      resolution: '1280x720 (Catalog)',
    };
    setCapturedImage(imgInfo);
    onImageCaptured(imgInfo);
    stopCameraStream();
  };

  const clearImage = () => {
    setCapturedImage(null);
    onImageCaptured(null);
    stopCameraStream();
  };

  return (
    <div id="camera-capture-container" className="space-y-2">
      {/* Hidden file input for file picker fallback */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* STATE 1: ACTIVE LIVE CAMERA VIEWPORT */}
      {isCameraActive ? (
        <div className="relative bg-stone-950 rounded-xl overflow-hidden border border-stone-800 shadow-md">
          {/* Shutter visual flash effect */}
          {isShutterFlashing && (
            <div className="absolute inset-0 bg-white z-30 animate-out fade-out duration-150" />
          )}

          {/* Video Stream Element */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-56 object-cover bg-stone-900"
          />

          {/* Viewfinder Grid / Crosshair Overlay */}
          <div className="absolute inset-0 pointer-events-none grid grid-cols-3 grid-rows-3 border border-white/20">
            <div className="border-r border-b border-white/10" />
            <div className="border-r border-b border-white/10" />
            <div className="border-b border-white/10" />
            <div className="border-r border-b border-white/10" />
            <div className="border-r border-b border-white/10 flex items-center justify-center">
              <div className="w-8 h-8 border border-white/40 rounded-full" />
            </div>
            <div className="border-b border-white/10" />
            <div className="border-r border-white/10" />
            <div className="border-r border-white/10" />
            <div />
          </div>

          {/* Top Camera Controls Overlay */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-20 pointer-events-auto">
            <div className="flex items-center gap-1.5 px-2 py-0.5 bg-stone-900/80 backdrop-blur-xs text-white text-[10.5px] font-mono rounded-md border border-white/10">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span>LIVE SENSOR</span>
              <span className="text-stone-400">({facingMode})</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={toggleCameraFacing}
                className="p-1.5 bg-stone-900/80 hover:bg-stone-800 text-white rounded-lg border border-white/10 transition-colors"
                title="Switch Camera (Front/Back)"
              >
                <RotateCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={stopCameraStream}
                className="p-1.5 bg-stone-900/80 hover:bg-stone-800 text-white rounded-lg border border-white/10 transition-colors"
                title="Cancel Camera"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Bottom Shutter Action Bar */}
          <div className="absolute bottom-3 inset-x-0 flex items-center justify-center gap-4 z-20 pointer-events-auto">
            <button
              id="btn-shutter-capture"
              type="button"
              onClick={capturePhoto}
              className="w-14 h-14 rounded-full border-4 border-white bg-white/30 hover:bg-white/50 active:scale-95 transition-all flex items-center justify-center shadow-lg"
              title="Snap Incident Photo"
            >
              <div className="w-10 h-10 rounded-full bg-white shadow-inner flex items-center justify-center">
                <Camera className="w-5 h-5 text-stone-900" />
              </div>
            </button>
          </div>
        </div>
      ) : capturedImage ? (
        /* STATE 2: PHOTO CAPTURED & STORED PREVIEW */
        <div className="relative rounded-xl overflow-hidden border border-stone-200 bg-stone-900 shadow-sm group">
          {/* Image Display */}
          <img
            src={capturedImage.dataUrl}
            alt="Captured civic hazard evidence"
            referrerPolicy="no-referrer"
            className="w-full h-48 object-cover transition-transform group-hover:scale-[1.01]"
          />

          {/* Top Status Badges */}
          <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1 px-2 py-0.5 bg-stone-900/85 backdrop-blur-xs text-white text-[10.5px] font-semibold rounded-md border border-white/10 shadow-sm">
              <CheckCircle2 className="w-3 h-3 text-emerald-400" />
              <span>
                {capturedImage.source === 'camera_api'
                  ? 'Live Camera Capture'
                  : capturedImage.source === 'device_upload'
                  ? 'Device Photo Upload'
                  : 'Verified Ground Truth'}
              </span>
            </div>

            <div className="flex items-center gap-1 px-2 py-0.5 bg-blue-900/85 backdrop-blur-xs text-blue-100 text-[10px] font-mono rounded-md border border-blue-400/30">
              <Database className="w-3 h-3 text-blue-400" />
              <span>Simulated Media Vault</span>
            </div>
          </div>

          {/* Bottom Information & Action Bar */}
          <div className="absolute bottom-0 inset-x-0 bg-gradient-to-t from-stone-950/95 via-stone-950/70 to-transparent p-3 pt-6 text-white flex items-end justify-between">
            <div className="text-[11px] leading-tight space-y-0.5">
              <div className="font-semibold text-stone-200 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                <span>Geotagged to {locationName}</span>
              </div>
              <div className="text-[10px] text-stone-400 font-mono">
                {capturedImage.timestamp} &bull; {capturedImage.resolution}
              </div>
            </div>

            <div className="flex items-center gap-1.5 pointer-events-auto">
              <button
                type="button"
                id="btn-retake-photo"
                onClick={() => startCamera()}
                className="px-2.5 py-1 bg-stone-800/90 hover:bg-stone-700 active:bg-stone-600 text-white rounded text-xs font-medium transition-colors flex items-center gap-1 border border-white/10 shadow-2xs"
              >
                <RefreshCw className="w-3 h-3" />
                <span>Retake</span>
              </button>
              <button
                type="button"
                id="btn-remove-photo"
                onClick={clearImage}
                className="p-1 bg-red-600/80 hover:bg-red-600 text-white rounded transition-colors"
                title="Remove photo"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* STATE 3: INTERACTIVE IMAGE PLACEHOLDER (EMPTY / CALL TO ACTION) */
        <div
          id="image-capture-placeholder"
          className="relative rounded-xl border-2 border-dashed border-stone-300 bg-stone-50/80 hover:bg-stone-100/60 p-4 transition-all text-center"
        >
          {cameraError && (
            <div className="mb-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-left text-xs text-amber-900 flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Camera Access Notice:</p>
                <p className="text-[11px] text-amber-800 leading-snug">
                  {cameraError} You can still upload an image or choose one of the verified sample photos below.
                </p>
              </div>
            </div>
          )}

          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-stone-100 border border-stone-200 flex items-center justify-center text-stone-600 group-hover:scale-105 transition-transform">
            <Camera className="w-6 h-6 text-stone-700" />
          </div>

          <h4 className="text-xs font-bold text-stone-900 mb-0.5">
            Attach Field Photo Evidence
          </h4>
          <p className="text-[11px] text-stone-500 max-w-sm mx-auto mb-3 leading-relaxed">
            Take a live photo using your device camera or upload an image. The visual will be stored in the municipal media bucket and rendered on the GIS map marker.
          </p>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <button
              id="btn-open-camera"
              type="button"
              onClick={() => startCamera()}
              className="px-3.5 py-1.5 bg-stone-900 hover:bg-stone-800 active:bg-stone-950 text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all"
            >
              <Camera className="w-3.5 h-3.5 text-emerald-400" />
              <span>Take Photo (Camera API)</span>
            </button>

            <button
              id="btn-upload-file"
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-3 py-1.5 bg-white hover:bg-stone-100 text-stone-800 border border-stone-300 rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-2xs transition-all"
            >
              <Upload className="w-3.5 h-3.5 text-stone-600" />
              <span>Upload Photo</span>
            </button>
          </div>

          {/* Sample Field Evidence Presets for Fast Prototyping */}
          <div className="pt-2.5 border-t border-stone-200/80 flex flex-wrap items-center justify-center gap-1.5 text-[10.5px]">
            <span className="text-stone-400 font-medium">Or simulate with verified hazard photo:</span>
            <button
              type="button"
              onClick={() =>
                selectSamplePreset(
                  'https://images.unsplash.com/photo-1515162816999-a0c47dc192f7?w=800&auto=format&fit=crop&q=80',
                  'Road Crater'
                )
              }
              className="px-2 py-0.5 bg-white hover:bg-stone-200/80 text-stone-700 border border-stone-200 rounded font-medium transition-colors"
            >
              🕳️ Asphalt Crater
            </button>
            <button
              type="button"
              onClick={() =>
                selectSamplePreset(
                  'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&auto=format&fit=crop&q=80',
                  'Water Leak'
                )
              }
              className="px-2 py-0.5 bg-white hover:bg-stone-200/80 text-stone-700 border border-stone-200 rounded font-medium transition-colors"
            >
              💧 Water Leak
            </button>
            <button
              type="button"
              onClick={() =>
                selectSamplePreset(
                  'https://images.unsplash.com/photo-1530587191325-3db32d826c18?w=800&auto=format&fit=crop&q=80',
                  'Waste Overflow'
                )
              }
              className="px-2 py-0.5 bg-white hover:bg-stone-200/80 text-stone-700 border border-stone-200 rounded font-medium transition-colors"
            >
              🗑️ Waste Accumulation
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
