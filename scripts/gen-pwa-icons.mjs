// Genera 3 PNGs (192, 512, 512-maskable) para la PWA.
// "A" blanca sobre fondo negro, con quiet zone para maskable.
// No requiere sharp: usa pngjs (JS puro).
import { PNG } from 'pngjs';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, '../public/pwa');
mkdirSync(OUT, { recursive: true });

// Bitmap 8×8 crudo para la letra "A" (1 = tinta, 0 = fondo)
const A = [
  '00011000',
  '00111100',
  '01100110',
  '11000011',
  '11111111',
  '11000011',
  '11000011',
  '11000011',
];

function draw(size, { maskable }) {
  const png = new PNG({ width: size, height: size });
  // pad interno para maskable (10% de safe zone en el borde exterior)
  const pad = maskable ? Math.round(size * 0.1) : 0;
  const inner = size - pad * 2;
  const cell = inner / 8;
  const offsetX = pad + Math.round((inner - cell * 8) / 2);
  const offsetY = pad + Math.round((inner - cell * 8) / 2);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) << 2;
      // Fondo negro
      let r = 0, g = 0, b = 0, a = 255;
      // Letra blanca dentro del área de arte
      const gx = Math.floor((x - offsetX) / cell);
      const gy = Math.floor((y - offsetY) / cell);
      if (gx >= 0 && gx < 8 && gy >= 0 && gy < 8) {
        if (A[gy][gx] === '1') { r = 255; g = 255; b = 255; }
      }
      png.data[idx] = r;
      png.data[idx + 1] = g;
      png.data[idx + 2] = b;
      png.data[idx + 3] = a;
    }
  }
  return PNG.sync.write(png);
}

writeFileSync(resolve(OUT, 'icon-192.png'), draw(192, { maskable: false }));
writeFileSync(resolve(OUT, 'icon-512.png'), draw(512, { maskable: false }));
writeFileSync(resolve(OUT, 'icon-maskable-512.png'), draw(512, { maskable: true }));
console.log('OK — iconos PWA generados en public/pwa/');
