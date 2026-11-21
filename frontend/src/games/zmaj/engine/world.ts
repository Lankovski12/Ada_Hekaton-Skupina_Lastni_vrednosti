// Ljubljana: teren z barvami (mesto, travniki, gozd) in reki. Znamenitosti dodamo kasneje.
import * as THREE from 'three'
import { Terrain } from './terrain'

// --- teren ---------------------------------------------------------------

const C = {
  travnik: new THREE.Color('#9cc46a'),
  barje: new THREE.Color('#a9c271'),
  // mesto toplo opečnato (strehe), da se ne zameša s sivim smogom
  mesto: new THREE.Color('#c4a38c'),
  mestoTemno: new THREE.Color('#a98670'),
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

export function buildWorld(t: Terrain): THREE.Group {
  const world = new THREE.Group()
  world.add(buildTerrain(t))
  world.add(river(t, LJUBLJANICA, 70), river(t, SAVA, 130))
  return world
}

/** Kje je grad – zmaj začne let proti njemu. */
export const GRAD = { lat: 46.0489, lon: 14.5087 }
