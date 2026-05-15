import { useEffect, useRef, useState, useCallback } from 'react';
import { Html5Qrcode } from 'html5-qrcode';
import { Zap, AlertTriangle } from 'lucide-react';

interface QRScannerProps {
  onScan: (code: string) => void;
  scanning: boolean;
}

export default function QRScanner({ onScan, scanning }: QRScannerProps) {
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [flashOn, setFlashOn] = useState(false);

  const startScanner = useCallback(async () => {
    if (!containerRef.current) return;
    const id = 'qr-reader';

    try {
      const scanner = new Html5Qrcode(id);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 250, height: 250 },
          aspectRatio: 1,
        },
        (decodedText) => {
          onScan(decodedText);
        },
        () => {
          // ignore partial scan errors
        },
      );
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Camera access denied';
      setError(message);
    }
  }, [onScan]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {
        /* scanner may already be stopped */
      }
      scannerRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (scanning) {
      startScanner();
    } else {
      stopScanner();
    }
    return () => {
      stopScanner();
    };
  }, [scanning, startScanner, stopScanner]);

  const toggleFlash = async () => {
    if (!scannerRef.current) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const track = (scannerRef.current as any)
        .getRunningTrackCameraCapabilities?.();
      if (track?.torchFeature?.isSupported()) {
        await track.torchFeature.apply(!flashOn);
        setFlashOn(!flashOn);
      }
    } catch {
      /* flash not supported on this device */
    }
  };

  if (error) {
    return (
      <div style={{ textAlign: 'center', padding: 32, color: '#ef4444' }}>
        <AlertTriangle
          size={32}
          style={{ marginBottom: 8, display: 'inline-block' }}
        />
        <p>{error}</p>
        <p style={{ fontSize: 14, marginTop: 8, color: 'var(--color-text-secondary, #94a3b8)' }}>
          Verifica permisos de cámara en configuración del navegador
        </p>
      </div>
    );
  }

  return (
    <div style={{ position: 'relative' }}>
      <div id="qr-reader" ref={containerRef} style={{ width: '100%' }} />
      <button
        onClick={toggleFlash}
        aria-label={flashOn ? 'Apagar flash' : 'Encender flash'}
        style={{
          position: 'absolute',
          top: 8,
          right: 8,
          background: flashOn ? '#fbbf24' : 'rgba(0,0,0,0.5)',
          color: 'white',
          border: 'none',
          borderRadius: '50%',
          width: 40,
          height: 40,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Zap size={18} />
      </button>
    </div>
  );
}
