// Ljubljana: teren z barvami (mesto, travniki, gozd), reki in nekaj znamenitosti z napisi.
import * as THREE from 'three'
import { Terrain } from './terrain'

// --- teren ---------------------------------------------------------------

const C = {
  travnik: new THREE.Color('#a9c77c'),
  barje: new THREE.Color('#b9c48a'),
  mesto: new THREE.Color('#c4bcae'),
  mestoTemno: new THREE.Color('#a59c8e'),
  gozd: new THREE.Color('#4f7d3c'),
  gozdVisoko: new THREE.Color('#3d6630'),
  skala: new THREE.Color('#7d8a6a'),
}

export function buildTerrain(t: Terrain): THREE.Mesh {
  const { nx, nz } = t.meta.teren
  const geo = new THREE.PlaneGeometry(t.W, t.H, nx - 1, nz - 1)
  geo.rotateX(-Math.PI / 2) // vrstica 0 = sever = -z
  const pos = geo.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) pos.setY(i, Terrain.Y(t.heights[i]!))
  geo.computeVertexNormals()

  const nrm = geo.attributes.normal as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const h = t.heights[i]!
    const slope = 1 - nrm.getY(i) // 0 ravno, ~1 strmo
    const urban = Math.min(1, t.gridAt(t.mesto, x, z) * 1.4)

    if (h < 300 && slope < 0.03) c.copy(z > 2500 ? C.barje : C.travnik)
    else if (h < 330 && slope < 0.06) c.copy(C.travnik).lerp(C.gozd, (h - 300) / 60)
    else c.copy(C.gozd).lerp(C.gozdVisoko, Math.min(1, (h - 330) / 300))
    if (h > 650) c.lerp(C.skala, Math.min(1, (h - 650) / 150))
    if (urban > 0.05 && h < 360) c.lerp(urban > 0.6 ? C.mestoTemno : C.mesto, Math.min(1, urban))

    const n = 0.94 + Math.random() * 0.1 // malo šuma, da ni plastično
    colors[i * 3] = c.r * n
    colors[i * 3 + 1] = c.g * n
    colors[i * 3 + 2] = c.b * n
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  mesh.receiveShadow = false
  return mesh
}

// --- reki (približni strugi) -------------------------------------------

const LJUBLJANICA: [number, number][] = [
  [45.992, 14.38], [46.005, 14.42], [46.018, 14.46], [46.028, 14.488], [46.036, 14.501], [46.042, 14.508],
  [46.0475, 14.5066], [46.0512, 14.5063], [46.0525, 14.5103], [46.0538, 14.517], [46.0555, 14.529],
  [46.0548, 14.545], [46.0556, 14.563], [46.0615, 14.592], [46.0695, 14.62], [46.073, 14.632],
]
const SAVA: [number, number][] = [
  [46.135, 14.418], [46.127, 14.44], [46.118, 14.458], [46.108, 14.478], [46.1005, 14.5], [46.0985, 14.52],
  [46.097, 14.54], [46.089, 14.568], [46.081, 14.598], [46.0745, 14.625], [46.0705, 14.66],
]

function river(t: Terrain, pts: [number, number][], width: number): THREE.Mesh {
  const curve = new THREE.CatmullRomCurve3(pts.map(([la, lo]) => {
    const [x, z] = t.toXZ(la, lo)
    return new THREE.Vector3(x, 0, z)
  }))
  const n = Math.ceil(curve.getLength() / 40)
  const verts: number[] = []
  const idx: number[] = []
  const p = new THREE.Vector3()
  const tan = new THREE.Vector3()
  for (let i = 0; i <= n; i++) {
    curve.getPointAt(i / n, p)
    curve.getTangentAt(i / n, tan)
    const sx = -tan.z * width * 0.5
    const sz = tan.x * width * 0.5
    for (const s of [-1, 1]) {
      const x = p.x + sx * s
      const z = p.z + sz * s
      verts.push(x, t.groundY(x, z) + 5, z)
    }
    if (i < n) {
      const a = i * 2
      idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3))
  geo.setIndex(idx)
  geo.computeVertexNormals()
  const mat = new THREE.MeshLambertMaterial({ color: '#4c9bd6', side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 })
  return new THREE.Mesh(geo, mat)
}

// --- znamenitosti ------------------------------------------------------

const mat = (color: string) => new THREE.MeshLambertMaterial({ color })
const ZID = mat('#ece5d3')
const STREHA = mat('#b8553d')
const ZELENA = mat('#3f8a64')

function box(w: number, h: number, d: number, m: THREE.Material, x = 0, y = 0, z = 0) {
  const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m)
  b.position.set(x, y + h / 2, z)
  return b
}
function cyl(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 10) {
  const c = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), m)
  c.position.set(x, y + h / 2, z)
  return c
}
function cone(r: number, h: number, m: THREE.Material, x = 0, y = 0, z = 0, seg = 8) {
  const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m)
  c.position.set(x, y + h / 2, z)
  return c
}

function grad() {
  const g = new THREE.Group()
  g.add(box(130, 22, 14, ZID, 0, 0, -38), box(130, 22, 14, ZID, 0, 0, 38), box(14, 22, 90, ZID, -60, 0, 0), box(14, 22, 90, ZID, 60, 0, 0))
  g.add(box(40, 30, 30, ZID, -35, 0, 15), cone(26, 14, STREHA, -35, 30, 15, 4))
  g.add(cyl(11, 52, ZID, 52, 0, -30, 12), cone(13, 10, STREHA, 52, 52, -30, 12)) // razgledni stolp
  const zastava = new THREE.Mesh(new THREE.PlaneGeometry(14, 8), new THREE.MeshLambertMaterial({ color: '#3f8a64', side: THREE.DoubleSide }))
  zastava.position.set(59, 70, -30)
  g.add(cyl(0.8, 14, ZID, 52, 60, -30, 4), zastava)
  return g
}
function neboticnik() {
  const g = new THREE.Group()
  g.add(box(24, 70, 24, ZID), box(20, 8, 20, ZID, 0, 70), cyl(7, 8, mat('#d7c9a5'), 0, 78), cone(8, 6, STREHA, 0, 86))
  return g
}
function zmajskiMost() {
  const g = new THREE.Group()
  g.add(box(50, 5, 18, mat('#d8d2c4'), 0, 6))
  for (const [x, z] of [[-22, -8], [-22, 8], [22, -8], [22, 8]] as const) {
    g.add(box(5, 8, 5, mat('#d8d2c4'), x, 11, z))
    const zmaj = new THREE.Group()
    zmaj.add(box(4, 6, 10, ZELENA, 0, 0, 0), box(3, 4, 4, ZELENA, 0, 5, 4), cone(1.5, 4, ZELENA, 0, 8, 4, 4))
    zmaj.position.set(x, 19, z)
    zmaj.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2
    g.add(zmaj)
  }
  return g
}
function kristalnaPalaca() {
  const g = new THREE.Group()
  const steklo = new THREE.MeshLambertMaterial({ color: '#8cc3e6', emissive: '#1d3d55' })
  g.add(box(28, 92, 22, steklo), cone(16, 14, steklo, 0, 92, 0, 4))
  return g
}
function stozice() {
  const g = new THREE.Group()
  const ring = new THREE.Mesh(new THREE.CylinderGeometry(120, 110, 30, 32, 1, true), new THREE.MeshLambertMaterial({ color: '#f2f2ee', side: THREE.DoubleSide }))
  ring.position.y = 15
  ring.scale.z = 0.8
  const igrisce = new THREE.Mesh(new THREE.CircleGeometry(100, 24), mat('#4f9a45'))
  igrisce.rotation.x = -Math.PI / 2
  igrisce.position.y = 2
  igrisce.scale.y = 0.8
  g.add(ring, igrisce)
  return g
}
function cerkevSmarnaGora() {
  const g = new THREE.Group()
  g.add(box(18, 14, 34, ZID), cone(14, 10, STREHA, 0, 14, 0, 4), box(8, 34, 8, ZID, 0, 0, -18), cone(6, 10, STREHA, 0, 34, -18, 4))
  return g
}

function label(text: string): THREE.Sprite {
  const cv = document.createElement('canvas')
  cv.width = 512
  cv.height = 128
  const ctx = cv.getContext('2d')!
  ctx.font = '800 54px Nunito, system-ui, sans-serif'
  const w = Math.min(500, ctx.measureText(text).width + 50)
  ctx.fillStyle = 'rgba(15,30,45,0.72)'
  ctx.beginPath()
  ctx.roundRect((512 - w) / 2, 22, w, 84, 42)
  ctx.fill()
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 256, 66)
  const tex = new THREE.CanvasTexture(cv)
  tex.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }))
  s.scale.set(760, 190, 1)
  s.renderOrder = 10
  return s
}

const ZNAMENITOSTI: { ime: string; lat: number; lon: number; make: () => THREE.Group; scale: number }[] = [
  { ime: 'Ljubljanski grad', lat: 46.0489, lon: 14.5087, make: grad, scale: 2.2 },
  { ime: 'Nebotičnik', lat: 46.0517, lon: 14.5034, make: neboticnik, scale: 2.4 },
  { ime: 'Zmajski most', lat: 46.0525, lon: 14.5103, make: zmajskiMost, scale: 3 },
  { ime: 'Kristalna palača', lat: 46.0656, lon: 14.5466, make: kristalnaPalaca, scale: 2.4 },
  { ime: 'Stožice', lat: 46.0806, lon: 14.5258, make: stozice, scale: 1.6 },
  { ime: 'Šmarna gora', lat: 46.1268, lon: 14.4644, make: cerkevSmarnaGora, scale: 2.4 },
]

export function buildWorld(t: Terrain): THREE.Group {
  const world = new THREE.Group()
  world.add(buildTerrain(t))
  world.add(river(t, LJUBLJANICA, 70), river(t, SAVA, 130))
  for (const z of ZNAMENITOSTI) {
    const [x, zz] = t.toXZ(z.lat, z.lon)
    const g = z.make()
    g.scale.setScalar(z.scale)
    g.position.set(x, t.groundY(x, zz) - 2, zz)
    const box3 = new THREE.Box3().setFromObject(g)
    const l = label(z.ime)
    l.position.set(x, box3.max.y + 120, zz)
    world.add(g, l)
  }
  return world
}

/** Kje je grad – zmaj začne let proti njemu. */
export const GRAD = { lat: 46.0489, lon: 14.5087 }
