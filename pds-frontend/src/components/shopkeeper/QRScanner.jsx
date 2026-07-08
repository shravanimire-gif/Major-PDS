import { BrowserMultiFormatReader } from '@zxing/browser';
import { NotFoundException } from '@zxing/library';
import { useEffect, useRef } from 'react';

const QRScanner = ({ onScan, onError }) => {
  const videoRef = useRef(null);
  const readerRef = useRef(null);
  const scannedRef = useRef(false);

  useEffect(() => {
    scannedRef.current = false;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const stopScanner = () => {
      try {
        readerRef.current?.reset();
      } catch (error) {
        // Ignore scanner cleanup errors.
      }

      const stream = videoRef.current?.srcObject;
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };

    reader
      .decodeFromVideoDevice(undefined, videoRef.current, (result, error) => {
        if (result && !scannedRef.current) {
          scannedRef.current = true;
          stopScanner();
          onScan?.(result.getText());
          return;
        }

        if (error && !(error instanceof NotFoundException)) {
          onError?.(error);
        }
      })
      .catch((error) => {
        onError?.(error);
      });

    return () => {
      stopScanner();
    };
  }, [onError, onScan]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 w-full">
      <div className="relative aspect-square w-full max-w-sm overflow-hidden rounded-[var(--radius-lg)] border border-border-strong bg-black shadow-[var(--shadow-lg)]">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        <span className="pointer-events-none absolute left-3 top-3 h-12 w-12 rounded-tl-lg border-l-4 border-t-4 border-brand-500" />
        <span className="pointer-events-none absolute right-3 top-3 h-12 w-12 rounded-tr-lg border-r-4 border-t-4 border-brand-500" />
        <span className="pointer-events-none absolute bottom-3 left-3 h-12 w-12 rounded-bl-lg border-b-4 border-l-4 border-brand-500" />
        <span className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 rounded-br-lg border-b-4 border-r-4 border-brand-500" />
      </div>

      <p className="text-sm text-text-secondary">Point camera at QR code</p>
    </div>
  );
};

export default QRScanner;
