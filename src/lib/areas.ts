// Approximate centres of common Nairobi-metro neighbourhoods and nearby towns.
// Used to place free-text locations ("Kilimani", "near Yaya, Kilimani") on a map
// without a paid geocoder. Add areas here as the agency expands.
export const KNOWN_AREAS: Record<string, [number, number]> = {
  'Nairobi CBD': [-1.2864, 36.8172],
  Westlands: [-1.2676, 36.8108],
  Parklands: [-1.2622, 36.8185],
  Kilimani: [-1.2921, 36.7856],
  Kileleshwa: [-1.2785, 36.7811],
  Lavington: [-1.2786, 36.7678],
  Hurlingham: [-1.2975, 36.7963],
  Upperhill: [-1.2988, 36.8155],
  Karen: [-1.3197, 36.7073],
  Langata: [-1.3378, 36.7607],
  'South B': [-1.3106, 36.8367],
  'South C': [-1.3196, 36.8261],
  Runda: [-1.2185, 36.8107],
  Muthaiga: [-1.2489, 36.8339],
  Gigiri: [-1.2331, 36.8045],
  'Spring Valley': [-1.2459, 36.7885],
  Loresho: [-1.2552, 36.7577],
  Kitisuru: [-1.2303, 36.7766],
  Rosslyn: [-1.2209, 36.8016],
  Ridgeways: [-1.2233, 36.8373],
  Kasarani: [-1.2215, 36.8977],
  Roysambu: [-1.2182, 36.8852],
  Kahawa: [-1.1823, 36.9219],
  Ruaka: [-1.2093, 36.7777],
  Kikuyu: [-1.2461, 36.6629],
  Ngong: [-1.3527, 36.6699],
  Rongai: [-1.3963, 36.7442],
  Kitengela: [-1.4731, 36.9594],
  'Syokimau': [-1.3637, 36.9304],
  'Mlolongo': [-1.3903, 36.9376],
  'Athi River': [-1.4561, 36.9786],
  Embakasi: [-1.3207, 36.9021],
  Donholm: [-1.2977, 36.8886],
  Buruburu: [-1.2862, 36.8793],
  Eastleigh: [-1.2749, 36.8484],
  Ngara: [-1.2749, 36.8213],
  Kangemi: [-1.2663, 36.7486],
  Kawangware: [-1.2839, 36.7501],
  Dagoretti: [-1.2932, 36.7334],
  Madaraka: [-1.3065, 36.8215],
  Nyayo: [-1.3227, 36.8818],
  Utawala: [-1.2903, 36.9651],
  Ruiru: [-1.1466, 36.9609],
  Juja: [-1.1024, 37.0144],
  Thika: [-1.0333, 37.0693],
  Kiambu: [-1.1714, 36.8356],
  Limuru: [-1.1136, 36.6423],
  Machakos: [-1.5177, 37.2634],
  Nakuru: [-0.3031, 36.08],
  Naivasha: [-0.7172, 36.4310],
  Mombasa: [-4.0435, 39.6682],
  Kisumu: [-0.0917, 34.768],
  Eldoret: [0.5143, 35.2698],
  Nyeri: [-0.4201, 36.9476],
}

const normalise = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

const ENTRIES = Object.entries(KNOWN_AREAS)
  .map(([name, coords]) => ({ name, key: normalise(name), coords }))
  // Longest names first so "South B" wins over a shorter accidental match.
  .sort((a, b) => b.key.length - a.key.length)

export const AREA_NAMES = Object.keys(KNOWN_AREAS).sort()

// Finds the first known area mentioned in free text.
export function matchArea(text: string | null | undefined): { name: string; coords: [number, number] } | null {
  if (!text) return null
  const t = ` ${normalise(text)} `
  const hit = ENTRIES.find((e) => t.includes(` ${e.key} `))
  return hit ? { name: hit.name, coords: hit.coords } : null
}

// Great-circle distance in km.
export function distanceKm(a: [number, number], b: [number, number]) {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b[0] - a[0])
  const dLng = toRad(b[1] - a[1])
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}
