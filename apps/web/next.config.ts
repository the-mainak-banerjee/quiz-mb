import type { NextConfig } from 'next';
import { webEnv } from './src/lib/env';

void webEnv;
const config: NextConfig = { reactStrictMode: true };
export default config;
