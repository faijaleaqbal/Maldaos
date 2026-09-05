import * as THREE from 'three';
import { CampusMaterials } from './campus-materials';

/**
 * MaldaOS Procedural 3D Campus Architectural Engine
 * Creates an authentic, deep spatial digital twin of Malda College (Estd. 1944).
 * Combines heritage British-Indian red brick architecture with lush campus foliage.
 */

export interface BuildingNode {
  code: string;
  name: string;
  position: THREE.Vector3;
  size: THREE.Vector3;
  group: THREE.Group;
  meshForRaycast: THREE.Mesh;
  labelSprite?: THREE.Sprite;
}

export interface CampusSceneGraph {
  root: THREE.Group;
  buildings: Map<string, BuildingNode>;
  buildingNodes: BuildingNode[];
  buildingLabels: THREE.Sprite[];
  lampGlows: THREE.Sprite[];
  flagMesh?: THREE.Mesh;
  pathMesh: THREE.Mesh;
  groundMesh: THREE.Mesh;
  quadCenter: THREE.Vector3;
  dispose: () => void;
}

// Helper: create a boxed structure with trim
function createBox(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const geom = new THREE.BoxGeometry(w, h, d);
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Helper: create pitched/hipped roof
function createHippedRoof(
  w: number,
  h: number,
  d: number,
  mat: THREE.Material,
  x = 0,
  y = 0,
  z = 0
): THREE.Mesh {
  const geom = new THREE.ConeGeometry(Math.max(w, d) * 0.72, h, 4);
  geom.rotateY(Math.PI / 4);
  geom.scale(w / (Math.max(w, d) * 0.72 * Math.SQRT2), 1, d / (Math.max(w, d) * 0.72 * Math.SQRT2));
  const mesh = new THREE.Mesh(geom, mat);
  mesh.position.set(x, y + h / 2, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// Helper: create window grid on facade
function addWindowGrid(
  parent: THREE.Group,
  rows: number,
  cols: number,
  w: number,
  h: number,
  spanW: number,
  spanH: number,
  glassMat: THREE.Material,
  frameMat: THREE.Material,
  center: THREE.Vector3,
  faceNormal: 'front' | 'back' | 'left' | 'right'
) {
  const geomFrame = new THREE.BoxGeometry(w + 0.15, h + 0.15, 0.08);
  const geomGlass = new THREE.PlaneGeometry(w, h);

  const startX = -((cols - 1) * spanW) / 2;
  const startY = -((rows - 1) * spanH) / 2;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const offX = startX + c * spanW;
      const offY = startY + r * spanH;

      const fMesh = new THREE.Mesh(geomFrame, frameMat);
      const gMesh = new THREE.Mesh(geomGlass, glassMat);

      if (faceNormal === 'front') {
        fMesh.position.set(center.x + offX, center.y + offY, center.z + 0.05);
        gMesh.position.set(center.x + offX, center.y + offY, center.z + 0.1);
      } else if (faceNormal === 'back') {
        fMesh.position.set(center.x + offX, center.y + offY, center.z - 0.05);
        gMesh.position.set(center.x + offX, center.y + offY, center.z - 0.1);
        gMesh.rotateY(Math.PI);
      } else if (faceNormal === 'left') {
        fMesh.position.set(center.x - 0.05, center.y + offY, center.z + offX);
        fMesh.rotateY(Math.PI / 2);
        gMesh.position.set(center.x - 0.1, center.y + offY, center.z + offX);
        gMesh.rotateY(-Math.PI / 2);
      } else {
        fMesh.position.set(center.x + 0.05, center.y + offY, center.z + offX);
        fMesh.rotateY(-Math.PI / 2);
        gMesh.position.set(center.x + 0.1, center.y + offY, center.z + offX);
        gMesh.rotateY(Math.PI / 2);
      }

      parent.add(fMesh);
      parent.add(gMesh);
    }
  }
}

// Helper: build classical colonial column
function createColumn(
  radius: number,
  height: number,
  stoneMat: THREE.Material,
  x: number,
  y: number,
  z: number
): THREE.Group {
  const grp = new THREE.Group();
  const baseGeom = new THREE.BoxGeometry(radius * 2.6, 0.35, radius * 2.6);
  const base = new THREE.Mesh(baseGeom, stoneMat);
  base.position.set(x, y + 0.175, z);
  grp.add(base);

  const shaftGeom = new THREE.CylinderGeometry(radius * 0.88, radius, height - 0.7, 12);
  const shaft = new THREE.Mesh(shaftGeom, stoneMat);
  shaft.position.set(x, y + height / 2, z);
  shaft.castShadow = true;
  grp.add(shaft);

  const capGeom = new THREE.BoxGeometry(radius * 2.8, 0.35, radius * 2.8);
  const cap = new THREE.Mesh(capGeom, stoneMat);
  cap.position.set(x, y + height - 0.175, z);
  grp.add(cap);

  return grp;
}

/** 1. CENTENARY BUILDING (Central Administration & IQAC) */
function buildCentenaryBuilding(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  // Stepped Plinth
  const plinth = createBox(34, 0.6, 18, m.concreteBase, 0, 0, 0);
  grp.add(plinth);

  // Main Central Hall
  const centralHall = createBox(16, 9.5, 15, m.brick, 0, 0.6, 0);
  grp.add(centralHall);

  // Left & Right Wings
  const leftWing = createBox(10, 7.5, 13, m.brickDark, -12, 0.6, 0);
  const rightWing = createBox(10, 7.5, 13, m.brickDark, 12, 0.6, 0);
  grp.add(leftWing);
  grp.add(rightWing);

  // Stone Cornices and Belt Courses
  const corniceMid = createBox(34.4, 0.35, 18.4, m.stoneTrim, 0, 4.4, 0);
  const corniceTop = createBox(16.5, 0.45, 15.5, m.stoneTrim, 0, 10.1, 0);
  const wingCorniceL = createBox(10.4, 0.35, 13.4, m.stoneTrim, -12, 8.1, 0);
  const wingCorniceR = createBox(10.4, 0.35, 13.4, m.stoneTrim, 12, 8.1, 0);
  grp.add(corniceMid, corniceTop, wingCorniceL, wingCorniceR);

  // Roofs
  const centerRoof = createHippedRoof(16.8, 3.8, 15.8, m.roofTile, 0, 10.5, 0);
  const leftRoof = createHippedRoof(10.6, 2.8, 13.6, m.roofTile, -12, 8.4, 0);
  const rightRoof = createHippedRoof(10.6, 2.8, 13.6, m.roofTile, 12, 8.4, 0);
  grp.add(centerRoof, leftRoof, rightRoof);

  // Grand Portico Colonnade (Front Porch)
  const porticoBase = createBox(9.5, 0.6, 4.5, m.stoneTrim, 0, 0, 8.8);
  const porticoRoof = createBox(9.8, 0.5, 4.8, m.stoneTrim, 0, 5.2, 8.8);
  const porticoPediment = createHippedRoof(9.8, 1.8, 4.8, m.roofTile, 0, 5.7, 8.8);
  grp.add(porticoBase, porticoRoof, porticoPediment);

  // 4 Portico Columns
  for (let c = -3.6; c <= 3.6; c += 2.4) {
    grp.add(createColumn(0.24, 4.6, m.stoneTrim, c, 0.6, 10.5));
  }

  // Entrance Door
  const door = createBox(2.2, 3.4, 0.2, m.verandahWood, 0, 0.6, 7.55);
  const doorArch = createBox(2.4, 0.4, 0.25, m.stoneTrim, 0, 4.0, 7.55);
  grp.add(door, doorArch);

  // Historic Clock Tower & Bell Cupola
  const towerBase = createBox(4.2, 4.5, 4.2, m.brick, 0, 10.5, 0);
  const towerTrim = createBox(4.5, 0.3, 4.5, m.stoneTrim, 0, 15.0, 0);
  const cupolaPillars = new THREE.Group();
  for (let px = -1.5; px <= 1.5; px += 3) {
    for (let pz = -1.5; pz <= 1.5; pz += 3) {
      cupolaPillars.add(createColumn(0.14, 2.2, m.stoneTrim, px, 15.3, pz));
    }
  }
  const cupolaDome = new THREE.Mesh(
    new THREE.SphereGeometry(1.9, 12, 12, 0, Math.PI * 2, 0, Math.PI / 2),
    m.brassGold
  );
  cupolaDome.position.set(0, 17.5, 0);
  cupolaDome.castShadow = true;

  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 2.2, 8), m.brassGold);
  spire.position.set(0, 19.8, 0);

  // Clock Face (Gold rim, white dial)
  const clockGeom = new THREE.CylinderGeometry(0.9, 0.9, 0.1, 16);
  clockGeom.rotateX(Math.PI / 2);
  const clock = new THREE.Mesh(clockGeom, m.stoneTrim);
  clock.position.set(0, 13.0, 2.15);
  const clockRim = new THREE.Mesh(
    new THREE.TorusGeometry(0.92, 0.08, 8, 24),
    m.brassGold
  );
  clockRim.position.set(0, 13.0, 2.2);

  grp.add(towerBase, towerTrim, cupolaPillars, cupolaDome, spire, clock, clockRim);

  // Facade Windows
  addWindowGrid(grp, 2, 4, 1.1, 1.8, 2.4, 2.8, m.windowGlass, m.stoneTrim, new THREE.Vector3(-12, 4.4, 6.55), 'front');
  addWindowGrid(grp, 2, 4, 1.1, 1.8, 2.4, 2.8, m.windowGlass, m.stoneTrim, new THREE.Vector3(12, 4.4, 6.55), 'front');
  addWindowGrid(grp, 2, 2, 1.1, 1.8, 2.4, 2.8, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 7.5, 7.55), 'front');

  // Invisible Hitbox for Raycasting
  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(36, 18, 22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 9, 2);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 2. VIDYASAGAR BHAVAN (Science & Tech Block) */
function buildVidyasagarBhavan(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(28, 0.5, 15, m.concreteBase, 0, 0, 0);
  const main = createBox(26, 9.2, 14, m.brick, 0, 0.5, 0);
  const band1 = createBox(26.4, 0.35, 14.4, m.stoneTrim, 0, 3.5, 0);
  const band2 = createBox(26.4, 0.35, 14.4, m.stoneTrim, 0, 6.8, 0);
  const roof = createHippedRoof(26.6, 2.8, 14.6, m.roofTile, 0, 9.7, 0);

  // Laboratory Ventilation Units on Roof
  const vent1 = createBox(2.2, 1.4, 2.2, m.concreteBase, -6, 10.5, 1);
  const vent2 = createBox(2.2, 1.4, 2.2, m.concreteBase, 6, 10.5, 1);
  grp.add(base, main, band1, band2, roof, vent1, vent2);

  // Modernist Science Ribbon Windows
  addWindowGrid(grp, 3, 6, 1.4, 1.5, 3.6, 2.6, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 5.0, 7.05), 'front');
  addWindowGrid(grp, 3, 6, 1.4, 1.5, 3.6, 2.6, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 5.0, -7.05), 'back');

  // Entrance Porch
  const porch = createBox(6, 4.2, 2.5, m.concreteBase, 0, 0.5, 7.5);
  const door = createBox(2.8, 2.8, 0.1, m.windowGlass, 0, 0.5, 8.8);
  grp.add(porch, door);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(28, 12, 17),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 6, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 3. CENTRAL LIBRARY & DIGITAL KNOWLEDGE CENTER */
function buildCentralLibrary(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(24, 0.7, 18, m.concreteBase, 0, 0, 0);
  const main = createBox(22, 7.8, 16, m.stoneTrim, 0, 0.7, 0);
  const roof = createHippedRoof(22.6, 3.2, 16.6, m.roofTile, 0, 8.5, 0);
  grp.add(base, main, roof);

  // Colonnaded Reading Veranda
  for (let c = -8; c <= 8; c += 3.2) {
    grp.add(createColumn(0.22, 5.2, m.stoneTrim, c, 0.7, 8.8));
  }
  const verandaRoof = createBox(19, 0.4, 3, m.stoneTrim, 0, 5.9, 8.8);
  grp.add(verandaRoof);

  // Arched Windows
  addWindowGrid(grp, 2, 4, 1.6, 2.2, 4.2, 3.2, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 4.4, 8.05), 'front');
  addWindowGrid(grp, 2, 4, 1.6, 2.2, 4.2, 3.2, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 4.4, -8.05), 'back');

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(24, 12, 20),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 6, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 4. RABINDRA BHAVAN (Auditorium & Humanities Block) */
function buildRabindraBhavan(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(28, 0.6, 22, m.concreteBase, 0, 0, 0);
  // High Auditorium volume
  const hall = createBox(26, 11.2, 20, m.brick, 0, 0.6, 0);
  const stageTower = createBox(14, 14.5, 8, m.brickDark, 0, 0.6, -6);
  const hallRoof = createHippedRoof(26.6, 3.5, 20.6, m.roofTile, 0, 11.8, 0);
  grp.add(base, hall, stageTower, hallRoof);

  // Cultural facade portico
  const portico = createBox(16, 5.5, 3.5, m.stoneTrim, 0, 0.6, 11.2);
  const tripleArch1 = createBox(2.8, 4.0, 0.2, m.verandahWood, -4.5, 0.6, 13.0);
  const tripleArch2 = createBox(2.8, 4.0, 0.2, m.verandahWood, 0, 0.6, 13.0);
  const tripleArch3 = createBox(2.8, 4.0, 0.2, m.verandahWood, 4.5, 0.6, 13.0);
  grp.add(portico, tripleArch1, tripleArch2, tripleArch3);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(29, 15, 24),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 7.5, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 5. BCA & IT INNOVATION COMPLEX */
function buildBCAComplex(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(22, 0.5, 14, m.concreteBase, 0, 0, 0);
  const main = createBox(20, 8.0, 13, m.brick, 0, 0.5, 0);
  const roof = createBox(20.4, 0.4, 13.4, m.concreteBase, 0, 8.5, 0);
  grp.add(base, main, roof);

  // IT Glazed Curtain Wall
  const curtainGeom = new THREE.PlaneGeometry(12, 6);
  const curtain = new THREE.Mesh(curtainGeom, m.windowGlass);
  curtain.position.set(0, 4.5, 6.55);
  grp.add(curtain);

  // Server Room Rooftop Satellite Dish & Antenna Mast
  const mastGeom = new THREE.CylinderGeometry(0.06, 0.08, 4.5, 8);
  const mast = new THREE.Mesh(mastGeom, m.wroughtIron);
  mast.position.set(-6, 10.8, 2);

  const dishGeom = new THREE.SphereGeometry(1.2, 12, 12, 0, Math.PI * 2, 0, Math.PI / 3);
  dishGeom.rotateX(-Math.PI / 3);
  const dish = new THREE.Mesh(dishGeom, m.stoneTrim);
  dish.position.set(5, 9.8, 1);
  grp.add(mast, dish);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(22, 11, 15),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 5.5, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 6. STUDENT COMMON ROOM & CANTEEN */
function buildCanteen(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(18, 0.4, 12, m.concreteBase, 0, 0, 0);
  const main = createBox(16, 4.8, 10, m.stoneTrim, 0, 0.4, 0);
  const roof = createHippedRoof(17, 2.6, 11, m.roofTile, 0, 5.2, 0);
  grp.add(base, main, roof);

  // Open Dining Veranda
  for (let c = -6.5; c <= 6.5; c += 2.6) {
    grp.add(createColumn(0.16, 3.6, m.stoneTrim, c, 0.4, 6.2));
  }
  const vRoof = createBox(16, 0.3, 2.4, m.roofTile, 0, 4.0, 6.2);
  grp.add(vRoof);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(18, 7, 13),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 3.5, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 7. BOYS HOSTEL (Kazi Nazrul Islam Bhavan) */
function buildHostel(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(26, 0.5, 16, m.concreteBase, 0, 0, 0);
  // U-shaped residential wings
  const centerWing = createBox(24, 9.0, 6, m.brick, 0, 0.5, -4);
  const leftWing = createBox(6, 9.0, 10, m.brick, -9, 0.5, 2);
  const rightWing = createBox(6, 9.0, 10, m.brick, 9, 0.5, 2);
  const roofCenter = createHippedRoof(24.4, 2.6, 6.4, m.roofTile, 0, 9.5, -4);
  const roofL = createHippedRoof(6.4, 2.6, 10.4, m.roofTile, -9, 9.5, 2);
  const roofR = createHippedRoof(6.4, 2.6, 10.4, m.roofTile, 9, 9.5, 2);

  grp.add(base, centerWing, leftWing, rightWing, roofCenter, roofL, roofR);

  // Balconies and Residential Windows
  addWindowGrid(grp, 3, 5, 1.0, 1.4, 3.2, 2.6, m.windowGlass, m.stoneTrim, new THREE.Vector3(0, 4.8, -1.05), 'front');

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(26, 12, 17),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 6, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 8. SPORTS PAVILION & GYMNASIUM */
function buildSportsPavilion(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(22, 0.5, 14, m.concreteBase, 0, 0, 0);
  const gym = createBox(20, 6.5, 12, m.stoneTrim, 0, 0.5, 0);

  // Barrel-vault curved roof
  const barrelGeom = new THREE.CylinderGeometry(6.2, 6.2, 20.4, 16, 1, false, 0, Math.PI);
  barrelGeom.rotateZ(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeom, m.roofTile);
  barrel.position.set(0, 7.0, 0);
  grp.add(base, gym, barrel);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(22, 10, 14),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 5, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 9. DURGAKINGKAR SADAN (Premier Auditorium & Cultural Conference Hall) */
function buildDurgakingkarSadan(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  const base = createBox(30, 0.7, 20, m.concreteBase, 0, 0, 0);
  const mainHall = createBox(28, 10.5, 18, m.brick, 0, 0.7, 0);
  const stageTower = createBox(16, 13.0, 7, m.brickDark, 0, 0.7, -6.5);
  const roof = createHippedRoof(28.6, 3.2, 18.6, m.roofTile, 0, 11.2, 0);
  grp.add(base, mainHall, stageTower, roof);

  // Grand Pillared Entrance Portico
  const portico = createBox(18, 5.2, 4.0, m.stoneTrim, 0, 0.7, 10.5);
  for (let c = -7.0; c <= 7.0; c += 3.5) {
    grp.add(createColumn(0.24, 4.5, m.stoneTrim, c, 0.7, 12.2));
  }
  const porticoPediment = createHippedRoof(18.4, 2.0, 4.4, m.roofTile, 0, 5.9, 10.5);
  grp.add(portico, porticoPediment);

  // Auditorium Arched Doors
  const door1 = createBox(2.2, 3.2, 0.2, m.verandahWood, -4.5, 0.7, 9.1);
  const door2 = createBox(2.2, 3.2, 0.2, m.verandahWood, 0, 0.7, 9.1);
  const door3 = createBox(2.2, 3.2, 0.2, m.verandahWood, 4.5, 0.7, 9.1);
  grp.add(door1, door2, door3);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(32, 14, 22),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 7, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 10. COLLEGE POND (Historic Waterbody & Ecological Wetland) */
function buildCollegePond(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  // Embankment stone boundary
  const bankGeom = new THREE.BoxGeometry(26, 0.4, 18);
  const bank = new THREE.Mesh(bankGeom, m.stoneTrim);
  bank.position.set(0, 0.1, 0);
  bank.receiveShadow = true;
  grp.add(bank);

  // Water surface
  const waterGeom = new THREE.PlaneGeometry(24, 16);
  waterGeom.rotateX(-Math.PI / 2);
  const water = new THREE.Mesh(waterGeom, m.pondWater);
  water.position.set(0, 0.22, 0);
  grp.add(water);

  // Stone stepped ghats
  const step1 = createBox(8, 0.2, 1.2, m.stonePaving, 0, 0.1, 8.2);
  const step2 = createBox(8, 0.2, 1.2, m.stonePaving, 0, 0.0, 9.2);
  grp.add(step1, step2);

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(26, 4, 18),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 1, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 11. MALDA COLLEGE ATHLETIC GROUND & RUNNING TURF */
function buildCollegeGround(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  // Athletic Green Turf
  const turfGeom = new THREE.PlaneGeometry(54, 38);
  turfGeom.rotateX(-Math.PI / 2);
  const turf = new THREE.Mesh(turfGeom, m.athleticTurf);
  turf.position.set(0, 0.04, 0);
  turf.receiveShadow = true;
  grp.add(turf);

  // Cricket pitch strip in the middle
  const pitchGeom = new THREE.PlaneGeometry(3.6, 20);
  pitchGeom.rotateX(-Math.PI / 2);
  const pitch = new THREE.Mesh(pitchGeom, m.cricketPitch);
  pitch.position.set(0, 0.05, 0);
  pitch.receiveShadow = true;
  grp.add(pitch);

  // Running track outer boundary oval
  const trackGeom = new THREE.RingGeometry(24, 27, 36);
  trackGeom.rotateX(-Math.PI / 2);
  const track = new THREE.Mesh(trackGeom, m.asphaltPath);
  track.position.set(0, 0.035, 0);
  track.scale.set(1.08, 0.74, 1);
  grp.add(track);

  // Sports Pavilion grandstand (North side of the field)
  const stand = createBox(22, 3.2, 5.2, m.concreteBase, 0, 0, -17);
  const standRoof = createBox(24, 0.4, 6.0, m.roofTile, 0, 3.4, -17);
  // Tiered spectator seating
  const seat1 = createBox(20, 0.6, 1.4, m.stoneTrim, 0, 0.6, -15.1);
  const seat2 = createBox(20, 0.6, 1.4, m.stoneTrim, 0, 1.2, -16.4);
  grp.add(stand, standRoof, seat1, seat2);

  // Floodlight towers on 4 corners
  [
    [-24, -17],
    [24, -17],
    [-24, 17],
    [24, 17],
  ].forEach(([fx, fz]) => {
    const pMast = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 9, 8), m.wroughtIron);
    pMast.position.set(fx, 4.5, fz);
    const pLightBox = createBox(1.4, 0.7, 0.7, m.stoneTrim, fx, 9.1, fz);
    grp.add(pMast, pLightBox);
  });

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(56, 10, 40),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(0, 5, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** 12. MALDA COLLEGE MAIN GATE & ENTRANCE PORTAL (Rabindra Avenue / Old NH 81) */
function buildMainGate(m: CampusMaterials): { group: THREE.Group; hitbox: THREE.Mesh } {
  const grp = new THREE.Group();

  // Left Gate Pillar
  const p1 = createBox(2.4, 6.0, 2.4, m.brick, -6, 0, 0);
  const cap1 = createBox(2.8, 0.6, 2.8, m.stoneTrim, -6, 6.0, 0);
  const finial1 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), m.brassGold);
  finial1.position.set(-6, 6.8, 0);

  // Right Gate Pillar
  const p2 = createBox(2.4, 6.0, 2.4, m.brick, 6, 0, 0);
  const cap2 = createBox(2.8, 0.6, 2.8, m.stoneTrim, 6, 6.0, 0);
  const finial2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 12, 12), m.brassGold);
  finial2.position.set(6, 6.8, 0);

  // Institutional Arch Over Gate
  const archBeam = createBox(14.8, 0.9, 1.4, m.stoneTrim, 0, 5.6, 0);
  const archBanner = createBox(10.0, 1.4, 0.3, m.gateArch, 0, 6.8, 0);

  // Wrought Iron Grand Gates
  const gateLeft = createBox(4.4, 4.2, 0.12, m.wroughtIron, -2.5, 0, 0);
  const gateRight = createBox(4.4, 4.2, 0.12, m.wroughtIron, 2.5, 0, 0);

  // Guard Security Kiosk on the side
  const kiosk = createBox(3.6, 3.2, 3.6, m.brick, 10.5, 0, 0);
  const kioskRoof = createBox(4.2, 0.4, 4.2, m.roofTile, 10.5, 3.2, 0);
  const kioskWindow = createBox(1.6, 1.2, 0.1, m.windowGlass, 10.5, 1.6, 1.85);

  grp.add(
    p1,
    cap1,
    finial1,
    p2,
    cap2,
    finial2,
    archBeam,
    archBanner,
    gateLeft,
    gateRight,
    kiosk,
    kioskRoof,
    kioskWindow
  );

  const hitbox = new THREE.Mesh(
    new THREE.BoxGeometry(26, 8, 8),
    new THREE.MeshBasicMaterial({ visible: false })
  );
  hitbox.position.set(2, 4, 0);
  grp.add(hitbox);

  return { group: grp, hitbox };
}

/** Procedural Bengali / Indian Campus Trees (Banyan / Neem style) */
function createTree(
  m: CampusMaterials,
  height = 5.5,
  radius = 2.8,
  alt = false
): THREE.Group {
  const grp = new THREE.Group();

  // Trunk
  const trunkGeom = new THREE.CylinderGeometry(radius * 0.12, radius * 0.22, height * 0.55, 7);
  const trunk = new THREE.Mesh(trunkGeom, m.treeTrunk);
  trunk.position.y = (height * 0.55) / 2;
  trunk.castShadow = true;
  grp.add(trunk);

  // Clustered Canopy Spheres
  const foliageMat = alt ? m.treeFoliageAlt : m.treeFoliage;
  const crownGeom = new THREE.DodecahedronGeometry(radius, 1);

  const c1 = new THREE.Mesh(crownGeom, foliageMat);
  c1.position.set(0, height * 0.72, 0);
  c1.scale.set(1, 0.85, 1);
  c1.castShadow = true;

  const c2 = new THREE.Mesh(crownGeom, foliageMat);
  c2.position.set(radius * 0.35, height * 0.82, radius * 0.2);
  c2.scale.set(0.72, 0.7, 0.72);

  const c3 = new THREE.Mesh(crownGeom, foliageMat);
  c3.position.set(-radius * 0.3, height * 0.65, -radius * 0.25);
  c3.scale.set(0.65, 0.6, 0.65);

  grp.add(c1, c2, c3);
  return grp;
}

/** Victorian Lamp Post with Warm Point Light Glow */
function createLampPost(
  m: CampusMaterials,
  x: number,
  z: number
): { group: THREE.Group; glow: THREE.Sprite } {
  const grp = new THREE.Group();

  const postGeom = new THREE.CylinderGeometry(0.08, 0.14, 3.8, 8);
  const post = new THREE.Mesh(postGeom, m.wroughtIron);
  post.position.set(x, 1.9, z);
  post.castShadow = true;

  const lanternGeom = new THREE.BoxGeometry(0.5, 0.65, 0.5);
  const lantern = new THREE.Mesh(lanternGeom, m.brassGold);
  lantern.position.set(x, 3.8, z);

  // Soft Radial Glow Sprite
  const spriteMat = new THREE.SpriteMaterial({
    map: m.glowSpriteTexture,
    blending: THREE.AdditiveBlending,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const glow = new THREE.Sprite(spriteMat);
  glow.position.set(x, 3.85, z);
  glow.scale.set(3.2, 3.2, 1.0);

  grp.add(post, lantern, glow);
  return { group: grp, glow };
}

/** Institutional Flag Mast with Ceremonial Pennant */
function createFlagpole(m: CampusMaterials, x: number, z: number): { group: THREE.Group; flag: THREE.Mesh } {
  const grp = new THREE.Group();

  const baseGeom = new THREE.CylinderGeometry(0.6, 0.8, 0.6, 12);
  const base = new THREE.Mesh(baseGeom, m.stoneTrim);
  base.position.set(x, 0.3, z);

  const poleGeom = new THREE.CylinderGeometry(0.08, 0.12, 11, 10);
  const pole = new THREE.Mesh(poleGeom, m.brassGold);
  pole.position.set(x, 5.8, z);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.25, 12, 12), m.brassGold);
  finial.position.set(x, 11.4, z);

  // Malda College Ceremonial Maroon & Gold Flag
  let flagMat: THREE.Material = m.stoneTrim;
  if (typeof document !== 'undefined') {
    const flagCanvas = document.createElement('canvas');
    flagCanvas.width = 128;
    flagCanvas.height = 64;
    const fCtx = flagCanvas.getContext('2d');
    if (fCtx) {
      fCtx.fillStyle = '#7A1F2B'; // Maroon
      fCtx.fillRect(0, 0, 128, 64);
      fCtx.fillStyle = '#D4A72C'; // Gold stripe
      fCtx.fillRect(0, 26, 128, 12);
      fCtx.fillStyle = '#FFFFFF';
      fCtx.font = 'bold 10px serif';
      fCtx.fillText('MC 1944', 36, 35);
    }
    const flagTex = new THREE.CanvasTexture(flagCanvas);
    flagMat = new THREE.MeshStandardMaterial({
      map: flagTex,
      side: THREE.DoubleSide,
      roughness: 0.6,
    });
  }

  const flagGeom = new THREE.PlaneGeometry(3.0, 1.8, 8, 4);
  const flag = new THREE.Mesh(flagGeom, flagMat);
  flag.position.set(x + 1.5, 10.3, z);
  flag.castShadow = true;

  grp.add(base, pole, finial, flag);
  return { group: grp, flag };
}

/** 3D Floating Building Label Sprite Generator */
function createBuildingLabelSprite(title: string, tag: string): THREE.Sprite {
  if (typeof document === 'undefined') {
    return new THREE.Sprite();
  }
  const canvas = document.createElement('canvas');
  canvas.width = 384;
  canvas.height = 96;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    // Dark pill container with gold border
    ctx.fillStyle = 'rgba(25, 20, 24, 0.92)';
    ctx.strokeStyle = '#D4A72C';
    ctx.lineWidth = 3;
    const x = 4, y = 4, w = 376, h = 88, r = 14;
    ctx.beginPath();
    if (typeof ctx.roundRect === 'function') {
      ctx.roundRect(x, y, w, h, r);
    } else {
      ctx.rect(x, y, w, h);
    }
    ctx.fill();
    ctx.stroke();

    // Gold subtag / code
    ctx.fillStyle = '#D4A72C';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(tag.toUpperCase(), 192, 34);

    // White bold title
    ctx.fillStyle = '#FFFFFF';
    ctx.font = 'bold 22px serif';
    ctx.fillText(title, 192, 68);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.minFilter = THREE.LinearFilter;
  const spriteMat = new THREE.SpriteMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(spriteMat);
  sprite.scale.set(15, 3.75, 1);
  return sprite;
}

/** Master Campus Scene Graph Builder (Authentic Malda College Layout) */
export function buildCampusSceneGraph(materials: CampusMaterials): CampusSceneGraph {
  const root = new THREE.Group();
  const buildings = new Map<string, BuildingNode>();
  const buildingNodes: BuildingNode[] = [];
  const buildingLabels: THREE.Sprite[] = [];
  const lampGlows: THREE.Sprite[] = [];

  // 1. Campus Ground Lawn Plane (Expanded to 280 x 300 to encompass all facilities)
  const groundGeom = new THREE.PlaneGeometry(280, 300, 32, 32);
  groundGeom.rotateX(-Math.PI / 2);
  const groundMesh = new THREE.Mesh(groundGeom, materials.campusLawn);
  groundMesh.position.set(10, -0.01, 20);
  groundMesh.receiveShadow = true;
  root.add(groundMesh);

  // 2. Interconnected Paved Walkways & Road Network
  const pathGroup = new THREE.Group();

  // Rabindra Avenue (Old NH 81 Highway along East boundary)
  const nhRoadGeom = new THREE.PlaneGeometry(14, 280);
  nhRoadGeom.rotateX(-Math.PI / 2);
  const nhRoad = new THREE.Mesh(nhRoadGeom, materials.asphaltPath);
  nhRoad.position.set(36, 0.02, 20);
  nhRoad.receiveShadow = true;
  pathGroup.add(nhRoad);

  // Main Entrance Driveway (From Main Gate at X=36, Z=-8 to the Central Quad)
  const mainDrivewayGeom = new THREE.PlaneGeometry(40, 8);
  mainDrivewayGeom.rotateX(-Math.PI / 2);
  const mainDriveway = new THREE.Mesh(mainDrivewayGeom, materials.stonePaving);
  mainDriveway.position.set(16, 0.025, -8);
  mainDriveway.receiveShadow = true;
  pathGroup.add(mainDriveway);

  // Central Spine Road (Admin -> Central Quad -> South Walkway)
  const spineGeom = new THREE.PlaneGeometry(7.0, 130);
  spineGeom.rotateX(-Math.PI / 2);
  const spine = new THREE.Mesh(spineGeom, materials.stonePaving);
  spine.position.set(0, 0.02, 25);
  spine.receiveShadow = true;
  pathGroup.add(spine);

  // Central Quad Paved Ring around Flagpole
  const quadRingGeom = new THREE.RingGeometry(12, 18, 32);
  quadRingGeom.rotateX(-Math.PI / 2);
  const quadRing = new THREE.Mesh(quadRingGeom, materials.stonePaving);
  quadRing.position.set(0, 0.03, 16);
  quadRing.receiveShadow = true;
  pathGroup.add(quadRing);

  // East-West Cross Promenade (Science Wing <-> Quad <-> College Ground)
  const crossGeom = new THREE.PlaneGeometry(100, 6.0);
  crossGeom.rotateX(-Math.PI / 2);
  const cross = new THREE.Mesh(crossGeom, materials.asphaltPath);
  cross.position.set(0, 0.025, 16);
  cross.receiveShadow = true;
  pathGroup.add(cross);

  // Southern Walkway (Connecting Canteen, Central Library, Computer Lab & Pond)
  const southWalkGeom = new THREE.PlaneGeometry(60, 5.0);
  southWalkGeom.rotateX(-Math.PI / 2);
  const southWalk = new THREE.Mesh(southWalkGeom, materials.stonePaving);
  southWalk.position.set(0, 0.025, 65);
  southWalk.receiveShadow = true;
  pathGroup.add(southWalk);

  // East Connector to Malda College Ground
  const groundConnGeom = new THREE.PlaneGeometry(28, 5.0);
  groundConnGeom.rotateX(-Math.PI / 2);
  const groundConn = new THREE.Mesh(groundConnGeom, materials.asphaltPath);
  groundConn.position.set(46, 0.025, 42);
  groundConn.receiveShadow = true;
  pathGroup.add(groundConn);

  root.add(pathGroup);

  // 3. Register Canonical Malda College Buildings with Authentic Spatial Coordinates
  const registerBuilding = (
    code: string,
    name: string,
    pos: THREE.Vector3,
    size: THREE.Vector3,
    builder: (m: CampusMaterials) => { group: THREE.Group; hitbox: THREE.Mesh },
    shortTitle?: string
  ) => {
    const { group, hitbox } = builder(materials);
    group.position.copy(pos);
    hitbox.userData = { buildingCode: code, buildingName: name };
    root.add(group);

    // Floating 3D Label
    const labelTitle = shortTitle || name.split('(')[0].trim();
    const labelSprite = createBuildingLabelSprite(labelTitle, code);
    labelSprite.position.set(pos.x, pos.y + size.y + 3.2, pos.z);
    root.add(labelSprite);
    buildingLabels.push(labelSprite);

    const node: BuildingNode = {
      code,
      name,
      position: pos,
      size,
      group,
      meshForRaycast: hitbox,
      labelSprite,
    };
    buildings.set(code, node);
    buildingNodes.push(node);
  };

  // 1. Centenary Building (Central Hub - Front Quad)
  registerBuilding(
    'CENT-ADM',
    'Main Administrative Block (Centenary Hall & Principal Desk)',
    new THREE.Vector3(0, 0, -18),
    new THREE.Vector3(34, 16, 18),
    buildCentenaryBuilding,
    'Administrative Block'
  );

  // 2. Durgakingkar Sadan (Premier Auditorium & Cultural Conference Hall - North-West)
  registerBuilding(
    'DURGA-SADAN',
    'Durgakingkar Sadan (Auditorium & Conference Centre)',
    new THREE.Vector3(-34, 0, -24),
    new THREE.Vector3(30, 14, 20),
    buildDurgakingkarSadan,
    'Durgakingkar Sadan'
  );

  // 3. Rabindra Bhavan (Arts & Humanities - North-East near Rabindra Ave)
  registerBuilding(
    'RAB-BHAVAN',
    'Rabindra Arts & Humanities Bhavan',
    new THREE.Vector3(20, 0, -32),
    new THREE.Vector3(28, 14, 22),
    buildRabindraBhavan,
    'Rabindra Arts Bhavan'
  );

  // 4. Malda College Main Gate (East boundary on Rabindra Avenue / Old NH 81)
  registerBuilding(
    'MAIN-GATE',
    'Malda College Main Gate (Rabindra Avenue)',
    new THREE.Vector3(36, 0, -8),
    new THREE.Vector3(26, 8, 8),
    buildMainGate,
    'College Main Gate'
  );

  // 5. Vidyasagar Science Complex (West Wing - Labs & Research)
  registerBuilding(
    'VID-BHAVAN',
    'Vidyasagar Science Complex (Physics, Chem, Math, Botany, Zoology)',
    new THREE.Vector3(-38, 0, 14),
    new THREE.Vector3(28, 11, 15),
    buildVidyasagarBhavan,
    'Vidyasagar Science Wing'
  );

  // 6. Student Common Room & Canteen (South of Quad)
  registerBuilding(
    'CANTEEN-SCR',
    'Student Common Room & Cafeteria (Canteen)',
    new THREE.Vector3(-14, 0, 42),
    new THREE.Vector3(18, 7, 12),
    buildCanteen,
    'Campus Canteen & SCR'
  );

  // 7. Central Library (East of central promenade)
  registerBuilding(
    'LIB-CENTRAL',
    'Central Library & Digital Knowledge Center',
    new THREE.Vector3(18, 0, 54),
    new THREE.Vector3(24, 10, 18),
    buildCentralLibrary,
    'Central Library'
  );

  // 8. Central Computer Lab & BCA Innovation Complex (South-West)
  registerBuilding(
    'BCA-COMPLEX',
    'Central Computer Lab & BCA Innovation Complex',
    new THREE.Vector3(-24, 0, 78),
    new THREE.Vector3(22, 9, 14),
    buildBCAComplex,
    'Central Computer Lab'
  );

  // 9. College Pond (Historic Ecological Waterbody south of Library)
  registerBuilding(
    'COLLEGE-POND',
    'College Pond (Historic Campus Waterbody)',
    new THREE.Vector3(18, 0, 98),
    new THREE.Vector3(26, 4, 18),
    buildCollegePond,
    'College Pond'
  );

  // 10. Malda College Athletic Ground & Sports Pavilion (Expansive East Grounds)
  registerBuilding(
    'SPORTS-PAV',
    'Malda College Ground & Sports Pavilion',
    new THREE.Vector3(66, 0, 42),
    new THREE.Vector3(56, 10, 40),
    buildCollegeGround,
    'Malda College Ground'
  );

  // 4. Central Flagpole in Central Quad
  const { group: flagGroup, flag: flagMesh } = createFlagpole(materials, 0, 16);
  root.add(flagGroup);

  // 5. Victorian Campus Streetlamps along Walkways
  const lampPositions = [
    [-5, 4], [5, 4],
    [-5, 28], [5, 28],
    [-18, 16], [18, 16],
    [-18, -14], [18, -14],
    [-5, -10], [5, -10],
    [20, -8], [28, -8],
    [10, 54], [10, 78],
    [36, 20], [36, 60],
  ];
  lampPositions.forEach(([lx, lz]) => {
    const { group: lGrp, glow } = createLampPost(materials, lx, lz);
    root.add(lGrp);
    lampGlows.push(glow);
  });

  // 6. Campus Mature Trees (Lush Greenery Layering)
  const treePositions: [number, number, number, number, boolean][] = [
    // Perimeter and quad trees
    [-14, 2, 5.8, 3.2, false],
    [14, 2, 5.5, 3.0, true],
    [-15, 30, 6.2, 3.4, true],
    [15, 30, 6.0, 3.1, false],
    [-8, 42, 5.2, 2.8, false],
    [6, 42, 5.4, 2.9, true],
    // Near Science block
    [-52, 0, 6.5, 3.6, false],
    [-52, -14, 5.8, 3.0, true],
    [-24, -4, 5.0, 2.6, true],
    // Near Library & Pond
    [32, 54, 6.2, 3.5, false],
    [4, 98, 5.9, 3.1, true],
    [32, 98, 5.6, 2.9, false],
    // North Boundary tree-line
    [-48, -42, 7.2, 3.8, false],
    [-24, -44, 7.0, 3.6, true],
    [0, -46, 7.5, 4.0, false],
    [24, -44, 7.1, 3.7, true],
    [48, -42, 6.9, 3.6, false],
    // South boundary
    [-48, 90, 6.6, 3.4, false],
    [-20, 100, 6.8, 3.5, true],
    [0, 105, 7.0, 3.8, false],
    [36, 110, 6.7, 3.5, true],
  ];

  treePositions.forEach(([tx, tz, th, tr, tAlt]) => {
    const tree = createTree(materials, th, tr, tAlt);
    tree.position.set(tx, 0, tz);
    root.add(tree);
  });

  const dispose = () => {
    // Traverse and dispose all non-shared geometries and textures
    root.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      }
      if ((obj as THREE.Sprite).isSprite) {
        const s = obj as THREE.Sprite;
        if (s.material && s.material.map) s.material.map.dispose();
        if (s.material) s.material.dispose();
      }
    });
  };

  return {
    root,
    buildings,
    buildingNodes,
    buildingLabels,
    lampGlows,
    flagMesh,
    pathMesh: spine,
    groundMesh,
    quadCenter: new THREE.Vector3(0, 0, 16),
    dispose,
  };
}
