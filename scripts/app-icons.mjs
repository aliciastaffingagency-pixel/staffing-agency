// Generates the mobile app icons and Play Store graphics from the brand mark.
//   node scripts/app-icons.mjs
// Outputs to mobile/assets/images (app) and mobile/store (Play Console uploads).
import sharp from 'sharp'
import { mkdirSync } from 'node:fs'

const CREAM = '#FFF8F1'
const MAGENTA = '#D61F7A'
const NAVY = '#1C1F4A'

// The logo mark (crown + house + heart) on a 64×64 grid, as in src/app/icon.svg.
const mark = (fill = null) => `
  <path d="M20 15 22 5l5 5 5-7 5 7 5-5 2 10Z" fill="${fill ?? '#D4A43A'}"/>
  <rect x="20" y="15" width="24" height="3.2" rx="1.2" fill="${fill ?? '#B3862A'}"/>
  <rect x="44" y="21" width="5.5" height="10" rx="1" fill="${fill ?? MAGENTA}"/>
  <path d="M8 35 32 17l24 18M14 31v26h36V31" fill="none" stroke="${fill ?? NAVY}" stroke-width="4.2" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 52c-9.5-6.4-10.6-15.6-4.4-16.4 2.1-.3 3.6 1.1 4.4 2.6.8-1.5 2.3-2.9 4.4-2.6 6.2.8 5.1 10-4.4 16.4Z" fill="${fill ?? MAGENTA}"/>`

// Mark centred in a square canvas, scaled to `scale` of the canvas (the mark spans y 3..57 of 64).
const square = (size, { bg = null, scale = 0.7, fill = null } = {}) => {
  const s = (size * scale) / 64
  const offset = (size - 64 * s) / 2
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    ${bg ? `<rect width="${size}" height="${size}" fill="${bg}"/>` : ''}
    <g transform="translate(${offset} ${offset - 1.5 * s}) scale(${s})">${mark(fill)}</g>
  </svg>`)
}

const out = 'mobile/assets/images'
const store = 'mobile/store'
mkdirSync(store, { recursive: true })

const jobs = [
  // Full icon (iOS + fallback): cream background, stores apply their own corner mask.
  [square(1024, { bg: CREAM, scale: 0.72 }), `${out}/icon.png`],
  // Android adaptive icon: foreground kept inside the ~66% safe zone.
  [square(1024, { scale: 0.56 }), `${out}/android-icon-foreground.png`],
  [Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="1024" height="1024" fill="${CREAM}"/></svg>`), `${out}/android-icon-background.png`],
  // Themed (monochrome) icon: single-colour silhouette; Android tints it.
  [square(1024, { scale: 0.56, fill: '#000000' }), `${out}/android-icon-monochrome.png`],
  // Android status-bar notification icon: white silhouette on transparent (tinted by the system).
  [square(96, { scale: 0.92, fill: '#FFFFFF' }), `${out}/notification-icon.png`],
  [square(512, { scale: 0.9 }), `${out}/splash-icon.png`],
  [square(48, { bg: CREAM, scale: 0.8 }), `${out}/favicon.png`],
  // Play Console: 512×512 high-res icon.
  [square(512, { bg: CREAM, scale: 0.72 }), `${store}/play-icon-512.png`],
]
for (const [svg, file] of jobs) {
  await sharp(svg).png().toFile(file)
  console.log('wrote', file)
}

// Play Console feature graphic: 1024×500.
const feature = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${MAGENTA}"/><stop offset="1" stop-color="${NAVY}"/></linearGradient></defs>
  <rect width="1024" height="500" fill="url(#g)"/>
  <circle cx="900" cy="60" r="190" fill="#FFFFFF" opacity="0.07"/>
  <rect x="80" y="130" width="240" height="240" rx="56" fill="${CREAM}"/>
  <g transform="translate(92 136) scale(3.4)">${mark()}</g>
  <text x="370" y="225" font-family="Georgia, 'Times New Roman', serif" font-style="italic" font-weight="700" font-size="92" fill="#FFFFFF">Alicia</text>
  <text x="374" y="275" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="26" letter-spacing="8" fill="#FBF1D9">STAFFING AGENCY</text>
  <text x="374" y="340" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#FFFFFF">Vetted home &amp; business staff.</text>
  <text x="374" y="380" font-family="Arial, Helvetica, sans-serif" font-size="30" fill="#FFFFFF">Book, sign and pay from your phone.</text>
</svg>`)
await sharp(feature).png().toFile(`${store}/feature-graphic-1024x500.png`)
console.log('wrote', `${store}/feature-graphic-1024x500.png`)
