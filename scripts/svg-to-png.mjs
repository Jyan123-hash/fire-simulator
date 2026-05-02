import sharp from 'sharp';
import { readFileSync } from 'fs';

const svg = readFileSync('public/og.svg');
await sharp(svg, { density: 144 })
  .resize(1200, 630, { fit: 'fill' })
  .png()
  .toFile('public/og.png');
console.log('Generated public/og.png');
