import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { ImageResponse } from 'next/og';
import { SOCIAL_IMAGE } from '@/config/seo';

// The link preview for every page (Open Graph and X), rendered once at build
// time. Pages point to it through sharingMetadata (config/seo.ts).
export const alt = SOCIAL_IMAGE.alt;
export const size = { width: SOCIAL_IMAGE.width, height: SOCIAL_IMAGE.height };
export const contentType = SOCIAL_IMAGE.type;

// Brand colours (as in src/styles/tokens.css); the image renderer cannot
// read CSS, and it needs the font files themselves (OFL, src/assets/fonts).
const CANVAS = '#f9faf8';
const INK = '#1b3022';
const MUTED = '#5c665f';
const BORDER = '#e6e9e4';

export default async function OpengraphImage() {
  const file = (path: string) => readFile(join(process.cwd(), path));
  const [regular, bold, logo, screenshot] = await Promise.all([
    file('src/assets/fonts/PlusJakartaSans-Regular.ttf'),
    file('src/assets/fonts/PlusJakartaSans-Bold.ttf'),
    file('src/app/icon.svg'),
    file('public/landing/host-console.png'),
  ]);

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 48,
        padding: 64,
        background: CANVAS,
        color: INK,
        fontFamily: 'Plus Jakarta Sans',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', width: 460 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={`data:image/svg+xml;base64,${logo.toString('base64')}`}
            width={48}
            height={48}
            alt=""
          />
          <div style={{ fontSize: 34, fontWeight: 700 }}>QuizMB</div>
        </div>
        <div
          style={{
            marginTop: 40,
            fontSize: 54,
            fontWeight: 700,
            lineHeight: 1.1,
            letterSpacing: '-0.02em',
          }}
        >
          Turn your next live session into a quiz challenge.
        </div>
        <div style={{ marginTop: 24, fontSize: 26, color: MUTED }}>
          Live quizzes for classes and communities.
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          padding: 8,
          borderRadius: 20,
          border: `1px solid ${BORDER}`,
          background: '#fff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`data:image/png;base64,${screenshot.toString('base64')}`}
          width={560}
          height={350}
          alt=""
          style={{ borderRadius: 12 }}
        />
      </div>
    </div>,
    {
      ...size,
      fonts: [
        { name: 'Plus Jakarta Sans', data: regular, weight: 400 },
        { name: 'Plus Jakarta Sans', data: bold, weight: 700 },
      ],
    },
  );
}
