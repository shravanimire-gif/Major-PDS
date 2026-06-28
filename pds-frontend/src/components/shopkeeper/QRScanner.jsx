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
      <div className="relative w-full max-w-sm aspect-square rounded-2xl bg-black overflow-hidden border border-gray-800 shadow-2xl">
        <video ref={videoRef} className="h-full w-full object-cover" muted playsInline />

        <span className="pointer-events-none absolute left-3 top-3 h-12 w-12 border-l-4 border-t-4 border-blue-500 rounded-tl-lg" />
        <span className="pointer-events-none absolute right-3 top-3 h-12 w-12 border-r-4 border-t-4 border-blue-500 rounded-tr-lg" />
        <span className="pointer-events-none absolute bottom-3 left-3 h-12 w-12 border-l-4 border-b-4 border-blue-500 rounded-bl-lg" />
        <span className="pointer-events-none absolute bottom-3 right-3 h-12 w-12 border-r-4 border-b-4 border-blue-500 rounded-br-lg" />
      </div>

      <p className="text-sm text-gray-400">Point camera at QR code</p>
    </div>
  );
};

export default QRScanner;
