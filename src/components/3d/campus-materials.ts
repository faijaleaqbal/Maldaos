import * as THREE from 'three';

/**
 * MaldaOS Institutional Campus Materials & Procedural Textures
 * Faithful to Malda College's historic red-brick & heritage stone architecture.
 * Generates lightweight canvas textures in memory with zero external image asset lag.
 */

export interface CampusMaterials {
  brick: THREE.MeshStandardMaterial;
  brickDark: THREE.MeshStandardMaterial;
  roofTile: THREE.MeshStandardMaterial;
  stoneTrim: THREE.MeshStandardMaterial;
  concreteBase: THREE.MeshStandardMaterial;
  brassGold: THREE.MeshStandardMaterial;
  windowGlass: THREE.MeshStandardMaterial;
  windowGlow: THREE.MeshBasicMaterial;
  verandahWood: THREE.MeshStandardMaterial;
  asphaltPath: THREE.MeshStandardMaterial;
  stonePaving: THREE.MeshStandardMaterial;
  campusLawn: THREE.MeshStandardMaterial;
  treeTrunk: THREE.MeshStandardMaterial;
  treeFoliage: THREE.MeshStandardMaterial;
  treeFoliageAlt: THREE.MeshStandardMaterial;
  wroughtIron: THREE.MeshStandardMaterial;
  glowSpriteTexture: THREE.CanvasTexture;
  beaconMaterials: {
    URGENT: THREE.MeshBasicMaterial;
    HIGH: THREE.MeshBasicMaterial;
    MEDIUM: THREE.MeshBasicMaterial;
    LOW: THREE.MeshBasicMaterial;
  };
  highlightMaterial: THREE.MeshBasicMaterial;
  dispose: () => void;
}

function createBrickCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  // Base mortar
  ctx.fillStyle = '#C8BEAF';
  ctx.fillRect(0, 0, 256, 256);

  const rows = 16;
  const rowH = 16;
  const brickW = 32;

  for (let r = 0; r < rows; r++) {
    const y = r * rowH;
    const offset = (r % 2) * (brickW / 2);
    for (let x = -brickW; x < 256 + brickW; x += brickW) {
      const bx = x + offset;
      // Procedural color variation in historic Malda red brick
      const shade = 105 + Math.floor((Math.sin(r * 12 + x * 7) + 1) * 12);
      const red = Math.min(255, shade + 18);
      const green = Math.max(20, Math.floor(shade * 0.28));
      const blue = Math.max(30, Math.floor(shade * 0.36));
      ctx.fillStyle = `rgb(${red},${green},${blue})`;
      ctx.fillRect(bx + 1, y + 1, brickW - 2, rowH - 2);

      // Subtle surface grain
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(bx + 2, y + rowH - 3, brickW - 4, 1);
    }
  }

  return c;
}

function createRoofTileCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.fillStyle = '#6E2A1E'; // Terracotta red-brown
  ctx.fillRect(0, 0, 128, 128);

  // Horizontal ridge courses
  for (let y = 0; y < 128; y += 8) {
    ctx.fillStyle = 'rgba(40,12,8,0.45)';
    ctx.fillRect(0, y, 128, 2);
    ctx.fillStyle = 'rgba(230,140,110,0.3)';
    ctx.fillRect(0, y + 2, 128, 2);
  }

  return c;
}

function createPavingCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.fillStyle = '#A89E90';
  ctx.fillRect(0, 0, 256, 256);

  const size = 32;
  for (let y = 0; y < 256; y += size) {
    for (let x = 0; x < 256; x += size) {
      const v = Math.floor(180 + Math.sin(x * 0.1 + y * 0.2) * 16);
      ctx.fillStyle = `rgb(${v},${v - 8},${v - 18})`;
      ctx.fillRect(x + 1, y + 1, size - 2, size - 2);
    }
  }

  return c;
}

function createLawnCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  ctx.fillStyle = '#3F5B36'; // Lush academic lawn
  ctx.fillRect(0, 0, 128, 128);

  for (let i = 0; i < 400; i++) {
    const x = Math.random() * 128;
    const y = Math.random() * 128;
    const g = 80 + Math.floor(Math.random() * 40);
    ctx.fillStyle = `rgba(50,${g},40,0.35)`;
    ctx.fillRect(x, y, 2, 2);
  }

  return c;
}

function createGlowSpriteCanvas(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const ctx = c.getContext('2d');
  if (!ctx) return c;

  const grad = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.25, 'rgba(240,190,70,0.85)');
  grad.addColorStop(0.65, 'rgba(200,90,30,0.25)');
  grad.addColorStop(1, 'rgba(0,0,0,0)');

  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 64, 64);
  return c;
}

export function createCampusMaterials(maxAnisotropy: number = 4): CampusMaterials {
  const brickCanvas = createBrickCanvas();
  const brickTex = new THREE.CanvasTexture(brickCanvas);
  brickTex.wrapS = brickTex.wrapT = THREE.RepeatWrapping;
  brickTex.repeat.set(4, 4);
  brickTex.anisotropy = maxAnisotropy;

  const roofCanvas = createRoofTileCanvas();
  const roofTex = new THREE.CanvasTexture(roofCanvas);
  roofTex.wrapS = roofTex.wrapT = THREE.RepeatWrapping;
  roofTex.repeat.set(6, 6);
  roofTex.anisotropy = maxAnisotropy;

  const pavingCanvas = createPavingCanvas();
  const pavingTex = new THREE.CanvasTexture(pavingCanvas);
  pavingTex.wrapS = pavingTex.wrapT = THREE.RepeatWrapping;
  pavingTex.repeat.set(8, 8);
  pavingTex.anisotropy = maxAnisotropy;

  const lawnCanvas = createLawnCanvas();
  const lawnTex = new THREE.CanvasTexture(lawnCanvas);
  lawnTex.wrapS = lawnTex.wrapT = THREE.RepeatWrapping;
  lawnTex.repeat.set(12, 12);
  lawnTex.anisotropy = maxAnisotropy;

  const glowCanvas = createGlowSpriteCanvas();
  const glowSpriteTexture = new THREE.CanvasTexture(glowCanvas);

  // Materials
  const brick = new THREE.MeshStandardMaterial({
    map: brickTex,
    color: 0x82242f, // Malda heritage brick maroon
    roughness: 0.88,
    metalness: 0.05,
  });

  const brickDark = new THREE.MeshStandardMaterial({
    map: brickTex,
    color: 0x5a1820,
    roughness: 0.9,
    metalness: 0.05,
  });

  const roofTile = new THREE.MeshStandardMaterial({
    map: roofTex,
    color: 0x782d22,
    roughness: 0.72,
    metalness: 0.1,
  });

  const stoneTrim = new THREE.MeshStandardMaterial({
    color: 0xe8e2d4, // Sandstone / cream lime plaster
    roughness: 0.78,
    metalness: 0.08,
  });

  const concreteBase = new THREE.MeshStandardMaterial({
    color: 0xb5afa4,
    roughness: 0.95,
    metalness: 0.02,
  });

  const brassGold = new THREE.MeshStandardMaterial({
    color: 0xd4a72c, // MaldaOS signature gold
    roughness: 0.28,
    metalness: 0.82,
  });

  const windowGlass = new THREE.MeshStandardMaterial({
    color: 0x1b2834,
    roughness: 0.12,
    metalness: 0.85,
  });

  const windowGlow = new THREE.MeshBasicMaterial({
    color: 0xffe8b0,
  });

  const verandahWood = new THREE.MeshStandardMaterial({
    color: 0x3d2719,
    roughness: 0.82,
    metalness: 0.02,
  });

  const asphaltPath = new THREE.MeshStandardMaterial({
    color: 0x484440,
    roughness: 0.94,
    metalness: 0.04,
  });

  const stonePaving = new THREE.MeshStandardMaterial({
    map: pavingTex,
    color: 0xc4bdaf,
    roughness: 0.86,
    metalness: 0.05,
  });

  const campusLawn = new THREE.MeshStandardMaterial({
    map: lawnTex,
    color: 0x46663b,
    roughness: 0.96,
    metalness: 0.02,
  });

  const treeTrunk = new THREE.MeshStandardMaterial({
    color: 0x3f2f22,
    roughness: 0.92,
    metalness: 0.02,
  });

  const treeFoliage = new THREE.MeshStandardMaterial({
    color: 0x2e522f,
    roughness: 0.82,
    metalness: 0.04,
    flatShading: true,
  });

  const treeFoliageAlt = new THREE.MeshStandardMaterial({
    color: 0x3a6136,
    roughness: 0.85,
    metalness: 0.04,
    flatShading: true,
  });

  const wroughtIron = new THREE.MeshStandardMaterial({
    color: 0x1d1e20,
    roughness: 0.45,
    metalness: 0.7,
  });

  const beaconMaterials = {
    URGENT: new THREE.MeshBasicMaterial({ color: 0xe11d48 }),
    HIGH: new THREE.MeshBasicMaterial({ color: 0xf59e0b }),
    MEDIUM: new THREE.MeshBasicMaterial({ color: 0xd4a72c }),
    LOW: new THREE.MeshBasicMaterial({ color: 0x10b981 }),
  };

  const highlightMaterial = new THREE.MeshBasicMaterial({
    color: 0xd4a72c,
    wireframe: true,
    transparent: true,
    opacity: 0.6,
  });

  const dispose = () => {
    brickTex.dispose();
    roofTex.dispose();
    pavingTex.dispose();
    lawnTex.dispose();
    glowSpriteTexture.dispose();

    brick.dispose();
    brickDark.dispose();
    roofTile.dispose();
    stoneTrim.dispose();
    concreteBase.dispose();
    brassGold.dispose();
    windowGlass.dispose();
    windowGlow.dispose();
    verandahWood.dispose();
    asphaltPath.dispose();
    stonePaving.dispose();
    campusLawn.dispose();
    treeTrunk.dispose();
    treeFoliage.dispose();
    treeFoliageAlt.dispose();
    wroughtIron.dispose();
    Object.values(beaconMaterials).forEach((m) => m.dispose());
    highlightMaterial.dispose();
  };

  return {
    brick,
    brickDark,
    roofTile,
    stoneTrim,
    concreteBase,
    brassGold,
    windowGlass,
    windowGlow,
    verandahWood,
    asphaltPath,
    stonePaving,
    campusLawn,
    treeTrunk,
    treeFoliage,
    treeFoliageAlt,
    wroughtIron,
    glowSpriteTexture,
    beaconMaterials,
    highlightMaterial,
    dispose,
  };
}
