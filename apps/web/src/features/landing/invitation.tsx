'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { cn } from '@/lib/utils';
import { PREVIEW_JOIN_PATH } from './content';

export function LandingQrCode({ className }: { className?: string }) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let active = true;
    const destination = new URL(PREVIEW_JOIN_PATH, window.location.origin).toString();
    void QRCode.toDataURL(destination, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    }).then((value) => {
      if (active) setSource(value);
    });
    return () => {
      active = false;
    };
  }, []);

  return source ? (
    <Image
      unoptimized
      src={source}
      width={512}
      height={512}
      alt="QR code opening the QuizMB participant preview"
      className={cn('size-24', className)}
    />
  ) : (
    <span className={cn('size-24 animate-pulse rounded-control bg-surface-muted', className)} aria-hidden="true" />
  );
}
