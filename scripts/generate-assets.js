const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

async function run() {
  const brandDir = path.join(__dirname, '../public/brand');
  const pubDir = path.join(__dirname, '../public');

  const iconTrimmedBuf = fs.readFileSync(path.join(brandDir, 'rotabeat-icon-trimmed.png'));
  const b64 = iconTrimmedBuf.toString('base64');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 861 612" width="100%" height="100%">
  <image href="data:image/png;base64,${b64}" width="861" height="612" />
</svg>`;
  fs.writeFileSync(path.join(pubDir, 'icon.svg'), svg);
  console.log('Generated icon.svg');

  // Let's create an App Icon Light (like in the brand guidelines):
  // Rounded squircle (white bg, subtle border) with the icon centered
  const squircleSize = 512;
  const padding = 100;
  const iconInSquircle = await sharp(path.join(brandDir, 'rotabeat-icon-trimmed.png'))
    .resize(squircleSize - padding * 2, squircleSize - padding * 2, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const lightBgSvg = Buffer.from(`
    <svg width="${squircleSize}" height="${squircleSize}">
      <rect x="0" y="0" width="${squircleSize}" height="${squircleSize}" rx="110" ry="110" fill="#FFFFFF" stroke="#E2E8F0" stroke-width="4"/>
    </svg>
  `);

  await sharp(lightBgSvg)
    .composite([{ input: iconInSquircle, gravity: 'center' }])
    .png()
    .toFile(path.join(brandDir, 'rotabeat-app-icon-light.png'));

  // Dark squircle
  const darkBgSvg = Buffer.from(`
    <svg width="${squircleSize}" height="${squircleSize}">
      <rect x="0" y="0" width="${squircleSize}" height="${squircleSize}" rx="110" ry="110" fill="#0F172A"/>
    </svg>
  `);

  await sharp(darkBgSvg)
    .composite([{ input: iconInSquircle, gravity: 'center' }])
    .png()
    .toFile(path.join(brandDir, 'rotabeat-app-icon-dark.png'));

  // Mobile / Home Screen (Gradient purple-indigo squircle)
  const mobileBgSvg = Buffer.from(`
    <svg width="${squircleSize}" height="${squircleSize}">
      <defs>
        <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#6366F1"/>
          <stop offset="100%" stop-color="#4F46E5"/>
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="${squircleSize}" height="${squircleSize}" rx="110" ry="110" fill="url(#g)"/>
    </svg>
  `);

  await sharp(mobileBgSvg)
    .composite([{ input: iconInSquircle, gravity: 'center' }])
    .png()
    .toFile(path.join(brandDir, 'rotabeat-mobile-icon.png'));

  console.log('All brand variations generated successfully!');
}

run().catch(console.error);
