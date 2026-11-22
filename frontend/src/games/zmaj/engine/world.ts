// Ljubljana: teren (satelitska slika ali barve iz podatkov) in 3D stavbe iz katastra GURS.
import * as THREE from 'three'
import { STAVBE, SVET } from '../config'
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
  const mat = new THREE.MeshLambertMaterial({ vertexColors: true })
  const mesh = new THREE.Mesh(geo, mat)
  loadSatellite(mat)
  return mesh
}

/**
 * Satelitska slika terena (neobvezno): public/assets/terrain/satelit.jpg.
 * Pripravi jo backend/scripts/download_satelit.py. Če je ni, ostanejo barve iz podatkov.
 */
function loadSatellite(mat: THREE.MeshLambertMaterial) {
  new THREE.TextureLoader().load(
    `${import.meta.env.BASE_URL}assets/terrain/satelit.jpg`,
    (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace
      tex.anisotropy = 4
      mat.map = tex
      mat.vertexColors = false
      mat.color.setScalar(1.35) // satelitska slika je temna; posvetlimo
      mat.needsUpdate = true
    },
    undefined,
    () => {}, // slike ni: ostanejo barve iz podatkov
  )
}

// --- 3D stavbe iz katastra GURS ----------------------------------------------

/** Stavbe kot zasukani kvadri (public/assets/terrain/stavbe.bin), od centra navzven. */
async function buildBuildings(t: Terrain): Promise<THREE.InstancedMesh | null> {
  const res = await fetch(`${import.meta.env.BASE_URL}assets/terrain/stavbe.bin`).catch(() => null)
  if (!res || !res.ok || res.headers.get('content-type')?.includes('html')) return null
  const a = new Int16Array(await res.arrayBuffer())
  const telefon = window.matchMedia?.('(pointer: coarse)').matches
  const n = Math.min(a.length / 7, telefon ? STAVBE.najvecTelefon : STAVBE.najvec)
  const geo = new THREE.BoxGeometry(1, 1, 1)
  geo.translate(0, 0.5, 0)
  const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' })
  const mesh = new THREE.InstancedMesh(geo, mat, n)
  const m = new THREE.Matrix4()
  const q = new THREE.Quaternion()
  const up = new THREE.Vector3(0, 1, 0)
  const pos = new THREE.Vector3()
  const scl = new THREE.Vector3()
  const col = new THREE.Color()
  for (let i = 0; i < n; i++) {
    const o = i * 7
    const x = a[o]!
    const z = a[o + 1]!
    const h = (a[o + 4]! / 10) * SVET.vex * STAVBE.visinaKrat
    q.setFromAxisAngle(up, ((a[o + 5]! / 100) * Math.PI) / 180)
    pos.set(x, t.groundY(x, z) - 3 * SVET.vex, z)
    scl.set(a[o + 2]! / 10, h + 3 * SVET.vex, a[o + 3]! / 10)
    m.compose(pos, q, scl)
    mesh.setMatrixAt(i, m)
    // svetle fasade z rahlimi razlikami; visoke stavbe malo bolj modrikaste (steklo)
    col.setHSL(0.08 + Math.random() * 0.04, 0.14, 0.62 + Math.random() * 0.12)
    if (h > 40 * SVET.vex) col.lerp(new THREE.Color('#9fb8cc'), 0.4)
    mesh.setColorAt(i, col)
  }
  mesh.instanceMatrix.needsUpdate = true
  if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  mesh.computeBoundingSphere()
  return mesh
}

export function buildWorld(t: Terrain): THREE.Group {
  const world = new THREE.Group()
  world.add(buildTerrain(t))
  if (STAVBE.vklopljene) buildBuildings(t).then((b) => b && world.add(b))
  return world
}

/** Kje je grad – zmaj začne let proti njemu. */
export const GRAD = { lat: 46.0489, lon: 14.5087 }
