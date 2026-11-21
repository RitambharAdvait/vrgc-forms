"use client";

import React, { useEffect, useRef, useState } from 'react';

interface CameraQrScannerProps {
  onScanSuccess: (decodedText: string) => void;
  onScanError?: (error: string) => void;
  onClose: () => void;
}

export default function CameraQrScanner({
  onScanSuccess,
  onScanError,
  onClose,
}: CameraQrScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState<boolean>(false);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<any>(null);
  const [hasScanned, setHasScanned] = useState<boolean>(false);

  // Initialize camera with native MediaDevices
  const startCamera = async (mode: 'environment' | 'user') => {
    stopCamera();
    setErrorMessage('');

    if (typeof navigator === 'undefined' || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setErrorMessage('Camera access is not supported on this browser or requires HTTPS.');
      return;
    }

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: { ideal: mode },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true'); // essential for iOS Safari
        await videoRef.current.play();
        setCameraActive(true);
        startScanningLoop();
      }
    } catch (err: any) {
      console.warn('Camera stream error:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMessage('Camera permission denied. Please allow camera access in your browser settings.');
      } else {
        setErrorMessage(`Could not open camera (${err.message || 'Unknown error'}). Try switching cameras or paste code.`);
      }
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraActive(false);
  };

  const toggleTorch = async () => {
    if (!streamRef.current) return;
    const track = streamRef.current.getVideoTracks()[0];
    if (track && 'applyConstraints' in track) {
      try {
        const nextTorch = !torchOn;
        await (track as any).applyConstraints({
          advanced: [{ torch: nextTorch }],
        });
        setTorchOn(nextTorch);
      } catch (err) {
        console.warn('Torch not supported on this device/camera.');
      }
    }
  };

  const flipCamera = () => {
    const nextMode = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextMode);
    startCamera(nextMode);
  };

  // Continuous scanning loop using native BarcodeDetector if available, or lightweight canvas analyzer
  const startScanningLoop = () => {
    if (scanIntervalRef.current) clearInterval(scanIntervalRef.current);

    const isBarcodeDetectorSupported = typeof window !== 'undefined' && 'BarcodeDetector' in window;
    let detector: any = null;

    if (isBarcodeDetectorSupported) {
      try {
        detector = new (window as any).BarcodeDetector({ formats: ['qr_code'] });
      } catch (e) {
        detector = null;
      }
    }

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2 || hasScanned) return;

      const video = videoRef.current;

      // Path A: Native Chrome/Android/iOS 17+ BarcodeDetector (instant, zero overhead, 60fps)
      if (detector) {
        try {
          const barcodes = await detector.detect(video);
          if (barcodes && barcodes.length > 0) {
            const raw = barcodes[0].rawValue;
            if (raw) {
              setHasScanned(true);
              stopCamera();
              onScanSuccess(raw);
              return;
            }
          }
        } catch (detectErr) {
          // ignore transient frame decode errors
        }
      }

      // Path B: Fallback via lightweight CDN zxing reader if detector is unavailable
      if (!detector && (window as any).ZXing) {
        try {
          if (!canvasRef.current) return;
          const canvas = canvasRef.current;
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          }
        } catch {}
      }
    }, 200);
  };

  // Load fallback script asynchronously if BarcodeDetector isn't native
  useEffect(() => {
    if (typeof window !== 'undefined' && !('BarcodeDetector' in window)) {
      const scriptId = 'barcode-detector-polyfill-cdn';
      if (!document.getElementById(scriptId)) {
        const script = document.createElement('script');
        script.id = scriptId;
        script.src = 'https://cdn.jsdelivr.net/npm/barcode-detector@2/dist/index.umd.min.js';
        script.async = true;
        document.body.appendChild(script);
      }
    }

    startCamera(facingMode);

    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/90 backdrop-blur-md">
      <div className="relative w-full max-w-md bg-[#120524] border border-rose-500/40 rounded-3xl overflow-hidden shadow-[0_0_60px_rgba(244,63,94,0.35)] flex flex-col">
        {/* Header Bar */}
        <div className="p-4 bg-black/60 border-b border-white/10 flex items-center justify-between z-10">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-xs font-mono font-bold uppercase tracking-wider text-white">
              GTA VI Live Pass Scanner
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={flipCamera}
              className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-all text-xs flex items-center justify-center"
              title="Flip Camera (Front/Back)"
            >
              <span className="material-symbols-outlined text-base">flip_camera_ios</span>
            </button>
            <button
              onClick={toggleTorch}
              className={`p-1.5 rounded-lg transition-all text-xs flex items-center justify-center ${
                torchOn ? 'bg-amber-400 text-black' : 'bg-white/10 text-white hover:bg-white/20'
              }`}
              title="Toggle Flashlight / Torch"
            >
              <span className="material-symbols-outlined text-base">flashlight_on</span>
            </button>
            <button
              onClick={() => {
                stopCamera();
                onClose();
              }}
              className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:text-white hover:bg-white/20 transition-all"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Video Viewport & Tactical HUD Target Box */}
        <div className="relative aspect-[4/3] sm:aspect-square w-full bg-black overflow-hidden flex items-center justify-center">
          <video
            ref={videoRef}
            muted
            playsInline
            autoPlay
            className="absolute inset-0 w-full h-full object-cover"
          />

          <canvas ref={canvasRef} className="hidden" />

          {/* Scanner Overlay HUD */}
          {cameraActive && (
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              {/* Darkened Vignette Outside Target Box */}
              <div className="absolute inset-0 bg-black/40" />

              {/* Target Aim Box */}
              <div className="relative w-64 h-64 border-2 border-dashed border-rose-400/80 rounded-2xl shadow-[0_0_30px_rgba(244,63,94,0.3)] flex items-center justify-center z-10">
                {/* Laser scan line animation */}
                <div className="absolute left-2 right-2 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_10px_#00f0ff] animate-bounce" />

                {/* Corner Accents */}
                <span className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-rose-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-rose-400" />
                <span className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-rose-400" />
                <span className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-rose-400" />

                <span className="text-[10px] uppercase font-mono tracking-widest text-cyan-300 bg-black/70 px-2.5 py-1 rounded-md border border-cyan-500/30">
                  Align QR Code
                </span>
              </div>
            </div>
          )}

          {/* Error / Permission Prompt */}
          {errorMessage && (
            <div className="absolute inset-0 bg-black/90 p-6 flex flex-col items-center justify-center text-center space-y-3 z-20">
              <span className="material-symbols-outlined text-4xl text-rose-400">videocam_off</span>
              <p className="text-xs text-rose-200 font-mono leading-relaxed">{errorMessage}</p>
              <button
                onClick={() => startCamera(facingMode)}
                className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold"
              >
                Retry Camera
              </button>
            </div>
          )}
        </div>

        {/* Footer Guidance */}
        <div className="p-4 bg-[#0a0214] border-t border-white/10 flex items-center justify-between text-xs text-slate-400 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm text-cyan-400">photo_camera</span>
            <span>Mobile Back Camera</span>
          </span>
          <button
            onClick={() => {
              stopCamera();
              onClose();
            }}
            className="text-purple-300 hover:text-white font-bold"
          >
            Use Manual Code
          </button>
        </div>
      </div>
    </div>
  );
}
