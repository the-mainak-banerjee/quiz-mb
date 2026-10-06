'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Text } from '@/components/ui';
import { formatLocalDateTime } from '@/components/local-date-time';
import type { PublishedQuizViewModel } from './types';

export function QuizQrCode({ url }: { url: string }) {
  const [source, setSource] = useState('');

  useEffect(() => {
    let current = true;
    void QRCode.toDataURL(url, {
      errorCorrectionLevel: 'M',
      margin: 1,
      width: 512,
    }).then((value) => {
      if (current) setSource(value);
    });
    return () => {
      current = false;
    };
  }, [url]);

  if (!source)
    return (
      <Text variant="caption" tone="secondary">
        Preparing QR code…
      </Text>
    );

  return (
    <Image
      unoptimized
      src={source}
      width={512}
      height={512}
      alt="QR code for this quiz’s public registration page"
      className="h-2/3 w-2/3"
    />
  );
}

function designToken(styles: CSSStyleDeclaration, name: string) {
  const value = styles.getPropertyValue(name).trim();
  if (!value) throw new Error(`Missing design token ${name}.`);
  return value;
}

function roundedRectangle(
  context: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  context.beginPath();
  context.roundRect(x, y, width, height, radius);
  context.fill();
}

function wrappedText(
  context: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
) {
  const words = text.trim().split(/\s+/);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth) {
      line = candidate;
      continue;
    }
    if (line) lines.push(line);
    line = word;
    if (lines.length === maxLines) break;
  }
  if (line && lines.length < maxLines) lines.push(line);
  const truncated = lines.join(' ').length < text.trim().length;
  if (truncated && lines.length) {
    let last = lines.at(-1)!;
    while (
      last.length > 1 &&
      context.measureText(`${last}…`).width > maxWidth
    ) {
      last = last.slice(0, -1);
    }
    lines[lines.length - 1] = `${last.trimEnd()}…`;
  }
  lines.forEach((value, index) =>
    context.fillText(value, x, y + index * lineHeight),
  );
  return y + lines.length * lineHeight;
}

async function loadImage(source: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new window.Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not render the QR code.'));
    image.src = source;
  });
}

export async function downloadQuizPoster(
  quiz: PublishedQuizViewModel,
  fileName: string,
) {
  await document.fonts.ready;
  const canvas = document.createElement('canvas');
  canvas.width = 1200;
  canvas.height = 1600;
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Image downloads are unavailable.');

  const styles = getComputedStyle(document.documentElement);
  const colors = {
    canvas: designToken(styles, '--color-canvas'),
    surface: designToken(styles, '--color-surface'),
    surfaceLow: designToken(styles, '--color-surface-low'),
    primary: designToken(styles, '--color-action-primary'),
    onPrimary: designToken(styles, '--color-action-on-primary'),
    text: designToken(styles, '--color-text-primary'),
    secondaryText: designToken(styles, '--color-text-secondary'),
    accent: designToken(styles, '--color-accent'),
    border: designToken(styles, '--color-border-surface'),
  };
  const fontFamily = getComputedStyle(document.body).fontFamily;

  context.fillStyle = colors.canvas;
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = colors.primary;
  context.fillRect(0, 0, canvas.width, 230);
  context.fillStyle = colors.onPrimary;
  context.font = `600 34px ${fontFamily}`;
  context.fillText('QuizMB', 72, 88);
  context.font = `600 22px ${fontFamily}`;
  context.fillText('LIVE QUIZ INVITATION', 72, 140);

  context.fillStyle = colors.surface;
  roundedRectangle(context, 64, 178, 1072, 1380, 32);
  context.strokeStyle = colors.border;
  context.lineWidth = 2;
  context.stroke();

  const contentX = 112;
  const contentWidth = 976;
  context.fillStyle = colors.accent;
  context.font = `600 22px ${fontFamily}`;
  context.fillText(quiz.project.toUpperCase(), contentX, 250);

  context.fillStyle = colors.text;
  context.font = `600 54px ${fontFamily}`;
  let nextY = wrappedText(
    context,
    quiz.title,
    contentX,
    326,
    contentWidth,
    66,
    3,
  );

  context.fillStyle = colors.secondaryText;
  context.font = `400 27px ${fontFamily}`;
  nextY = wrappedText(
    context,
    quiz.description,
    contentX,
    nextY + 18,
    contentWidth,
    40,
    4,
  );

  const detailsY = nextY + 34;
  context.fillStyle = colors.surfaceLow;
  roundedRectangle(context, contentX, detailsY, contentWidth, 154, 20);
  context.fillStyle = colors.secondaryText;
  context.font = `600 18px ${fontFamily}`;
  context.fillText('DATE & TIME', contentX + 32, detailsY + 44);
  context.fillText('REGISTRATION', contentX + 540, detailsY + 44);
  context.fillStyle = colors.text;
  context.font = `600 26px ${fontFamily}`;
  // Drawn in the browser, so these are the viewer's local date and time.
  context.fillText(
    formatLocalDateTime(quiz.plannedStartAt, 'longDate'),
    contentX + 32,
    detailsY + 84,
  );
  context.fillText(
    formatLocalDateTime(quiz.plannedStartAt, 'time'),
    contentX + 32,
    detailsY + 122,
  );
  context.fillText(
    `${quiz.registeredCount} registered`,
    contentX + 540,
    detailsY + 84,
  );
  context.fillText(
    `${quiz.registrationLimit} participant capacity`,
    contentX + 540,
    detailsY + 122,
  );

  const qrSource = await QRCode.toDataURL(quiz.publicUrl, {
    errorCorrectionLevel: 'M',
    margin: 1,
    width: 512,
  });
  const qrImage = await loadImage(qrSource);
  const qrSize = 500;
  const qrX = (canvas.width - qrSize) / 2;
  const qrY = detailsY + 205;
  context.fillStyle = colors.surface;
  context.strokeStyle = colors.border;
  context.lineWidth = 2;
  context.fillRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);
  context.strokeRect(qrX - 24, qrY - 24, qrSize + 48, qrSize + 48);
  context.drawImage(qrImage, qrX, qrY, qrSize, qrSize);

  context.textAlign = 'center';
  context.fillStyle = colors.text;
  context.font = `600 30px ${fontFamily}`;
  context.fillText('Scan to view and register', canvas.width / 2, qrY + 574);
  context.fillStyle = colors.secondaryText;
  context.font = `500 21px ${fontFamily}`;
  context.fillText(quiz.publicUrl, canvas.width / 2, qrY + 616);
  context.textAlign = 'left';

  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (value) =>
        value ? resolve(value) : reject(new Error('Could not create image.')),
      'image/png',
    ),
  );
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
}
