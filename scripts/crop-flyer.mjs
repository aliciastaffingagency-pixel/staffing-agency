// Crops brand photos out of the client's original flyer (public/brand/flyer.jpg).
// node scripts/crop-flyer.mjs
import sharp from 'sharp'

const src = 'public/brand/flyer.jpg'
const crops = {
  'photo-cleaning.jpg': { left: 812, top: 452, width: 204, height: 204 },
  'photo-kitchen.jpg': { left: 834, top: 668, width: 190, height: 206 },
  'photo-cooking.jpg': { left: 812, top: 868, width: 204, height: 204 },
}

for (const [name, region] of Object.entries(crops)) {
  await sharp(src).extract(region).jpeg({ quality: 90 }).toFile(`public/brand/${name}`)
  console.log('wrote', name)
}

// Hero portrait: the flyer's headline lettering bleeds into the top-right
// corner, so feather it out with the warm background tone.
const W = 470
const H = 900
const wash = Buffer.from(`
<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="a" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="rgb(250,228,196)" stop-opacity="1"/>
      <stop offset="0.82" stop-color="rgb(250,228,196)" stop-opacity="1"/>
      <stop offset="1" stop-color="rgb(250,228,196)" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <ellipse cx="462" cy="105" rx="160" ry="215" fill="url(#a)"/>
  <ellipse cx="318" cy="0" rx="70" ry="30" fill="url(#a)"/>
</svg>`)

await sharp(src)
  .extract({ left: 0, top: 240, width: W, height: H })
  .composite([{ input: wash }])
  .jpeg({ quality: 90 })
  .toFile('public/brand/photo-hero.jpg')
console.log('wrote photo-hero.jpg')
