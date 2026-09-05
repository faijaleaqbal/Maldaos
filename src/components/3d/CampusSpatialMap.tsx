'use client';

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { Issue, CampusLocation } from '@/types';
import { LocationOption } from '@/services/issues.service';
import { detectWebGL } from './webgl-check';
import { createCampusMaterials, CampusMaterials } from './campus-materials';
import { buildCampusSceneGraph, CampusSceneGraph, BuildingNode } from './campus-geometry';
import { PriorityBadge } from '@/components/issues/PriorityBadge';
import { IssueStatusBadge } from '@/components/issues/IssueStatusBadge';
import {
  Compass,
  Layers,
  MapPin,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  Building2,
  ArrowRight,
  Filter,
  Eye,
  Crosshair,
  Search,
  Maximize2,
  Minimize2,
} from 'lucide-react';

export interface CampusSpatialMapProps {
  issues?: Issue[];
  locations?: LocationOption[];
  selectedLocation?: CampusLocation | null;
  onLocationSelect?: (loc: Partial<CampusLocation>) => void;
  onIssueSelect?: (issue: Issue) => void;
  height?: string;
  filterBuilding?: string;
  highlightCritical?: boolean;
}

// Preset camera viewpoints for instant focal jumps
const CAMERA_PRESETS: Record<
  string,
  { p: [number, number, number]; t: [number, number, number] }
> = {
  OVERVIEW: { p: [0, 48, 72], t: [0, 4, 8] },
  CENTENARY: { p: [0, 16, 24], t: [0, 6, -18] },
  SCIENCE: { p: [-20, 15, 18], t: [-32, 6, -4] },
  LIBRARY: { p: [20, 15, 18], t: [32, 6, -4] },
  ARTS: { p: [18, 18, -10], t: [28, 8, -32] },
  IT: { p: [-18, 14, 40], t: [-30, 5, 22] },
  HOSTEL: { p: [-22, 16, 62], t: [-34, 6, 44] },
  SPORTS: { p: [-18, 16, -12], t: [-32, 5, -34] },
};

export const CampusSpatialMap: React.FC<CampusSpatialMapProps> = ({
  issues = [],
  locations = [],
  selectedLocation,
  onLocationSelect,
  onIssueSelect,
  height = '600px',
  filterBuilding = 'ALL',
  highlightCritical = true,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeBuildingCode, setActiveBuildingCode] = useState<string>(filterBuilding);
  const [selectedIssueState, setSelectedIssueState] = useState<Issue | null>(null);
  const [severityFilter, setSeverityFilter] = useState<'ALL' | 'URGENT' | 'HIGH' | 'OPEN'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  // Sync external building filter
  useEffect(() => {
    if (filterBuilding) {
      setActiveBuildingCode(filterBuilding);
    }
  }, [filterBuilding]);

  // Sync external selectedLocation
  useEffect(() => {
    if (selectedLocation?.buildingCode) {
      setActiveBuildingCode(selectedLocation.buildingCode);
    }
  }, [selectedLocation]);

  // WebGL Check
  useEffect(() => {
    const caps = detectWebGL();
    setWebGLSupported(caps.supported);
  }, []);

  // Filter issues based on activeBuildingCode, severityFilter, and searchQuery
  const filteredIssues = useMemo(() => {
    return issues.filter((iss) => {
      if (activeBuildingCode !== 'ALL' && iss.location.buildingCode !== activeBuildingCode) {
        return false;
      }
      if (severityFilter === 'URGENT' && iss.priority !== 'URGENT') return false;
      if (severityFilter === 'HIGH' && iss.priority !== 'HIGH' && iss.priority !== 'URGENT') return false;
      if (severityFilter === 'OPEN' && (iss.status === 'RESOLVED' || iss.status === 'CLOSED')) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchTitle = iss.title.toLowerCase().includes(q);
        const matchTicket = iss.ticketNumber.toLowerCase().includes(q);
        const matchBuilding = iss.location.building.toLowerCase().includes(q);
        if (!matchTitle && !matchTicket && !matchBuilding) return false;
      }
      return true;
    });
  }, [issues, activeBuildingCode, severityFilter, searchQuery]);

  // Refs for animation loop and camera lerp
  const animStateRef = useRef({
    camPos: new THREE.Vector3(0, 48, 72),
    camTarget: new THREE.Vector3(0, 4, 8),
    targetPos: new THREE.Vector3(0, 48, 72),
    targetLookAt: new THREE.Vector3(0, 4, 8),
    isUserControlling: false,
    isPanning: false,
    lastX: 0,
    lastY: 0,
    orbitRadius: 82,
    orbitTheta: Math.PI / 2, // azimuth
    orbitPhi: Math.PI / 3.4, // elevation
    clock: new THREE.Clock(),
    raycaster: new THREE.Raycaster(),
    mouse: new THREE.Vector2(),
    buildingNodes: [] as BuildingNode[],
    highlightBox: null as THREE.Mesh | null,
    issueBeacons: [] as { group: THREE.Group; issue: Issue; basePos: THREE.Vector3 }[],
  });

  // Keep a stable ref to callback functions and state
  const callbacksRef = useRef({
    onLocationSelect,
    onIssueSelect,
    issues,
    locations,
  });
  useEffect(() => {
    callbacksRef.current = { onLocationSelect, onIssueSelect, issues, locations };
  });

  // WebGL Scene Initialization
  useEffect(() => {
    if (!webGLSupported) return;
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const caps = detectWebGL();
    const isMobile = caps.isMobile;

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        canvas,
        antialias: !isMobile,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch (e) {
      console.error('Failed to init WebGL in CampusSpatialMap:', e);
      setWebGLSupported(false);
      return;
    }

    renderer.setPixelRatio(caps.dpr);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf2eee5);
    scene.fog = new THREE.FogExp2(0xf2eee5, 0.009);

    const camera = new THREE.PerspectiveCamera(
      42,
      container.clientWidth / container.clientHeight,
      0.5,
      350
    );
    scene.add(camera);

    const materials = createCampusMaterials(caps.maxAnisotropy);
    const sceneGraph = buildCampusSceneGraph(materials);
    scene.add(sceneGraph.root);
    animStateRef.current.buildingNodes = sceneGraph.buildingNodes;

    // Lighting
    const hemiLight = new THREE.HemisphereLight(0xfff6ea, 0x6e5d4d, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xffedd2, 1.5);
    sunLight.position.set(50, 65, 40);
    sunLight.castShadow = !isMobile;
    if (!isMobile) {
      sunLight.shadow.mapSize.width = 2048;
      sunLight.shadow.mapSize.height = 2048;
      sunLight.shadow.camera.near = 10;
      sunLight.shadow.camera.far = 200;
      sunLight.shadow.camera.left = -70;
      sunLight.shadow.camera.right = 70;
      sunLight.shadow.camera.top = 70;
      sunLight.shadow.camera.bottom = -70;
      sunLight.shadow.bias = -0.0004;
    }
    scene.add(sunLight);

    // Selected Building Highlight Cage
    const highlightBoxGeom = new THREE.BoxGeometry(1, 1, 1);
    const highlightMesh = new THREE.Mesh(highlightBoxGeom, materials.highlightMaterial);
    highlightMesh.visible = false;
    scene.add(highlightMesh);
    animStateRef.current.highlightBox = highlightMesh;

    // Build 3D Issue Beacons
    const beaconsRoot = new THREE.Group();
    scene.add(beaconsRoot);

    const rebuildBeacons = (issueList: Issue[]) => {
      // Clear old beacons
      while (beaconsRoot.children.length > 0) {
        beaconsRoot.remove(beaconsRoot.children[0]);
      }
      animStateRef.current.issueBeacons = [];

      issueList.forEach((iss) => {
        const bNode = sceneGraph.buildings.get(iss.location.buildingCode);
        if (!bNode) return;

        const bGrp = new THREE.Group();
        const basePos = bNode.position.clone();
        basePos.y += bNode.size.y + 1.2;

        // Spread multiple issues around the building roof perimeter
        const hash = iss.id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const offsetX = ((hash % 7) - 3) * 1.8;
        const offsetZ = (((hash * 13) % 7) - 3) * 1.8;
        basePos.x += offsetX;
        basePos.z += offsetZ;

        bGrp.position.copy(basePos);

        const mat =
          materials.beaconMaterials[iss.priority] || materials.beaconMaterials.MEDIUM;

        // Diamond pin beacon
        const pinGeom = new THREE.OctahedronGeometry(0.85, 0);
        const pinMesh = new THREE.Mesh(pinGeom, mat);
        pinMesh.castShadow = true;
        bGrp.add(pinMesh);

        // Ground/Roof Radar Ring
        const ringGeom = new THREE.RingGeometry(1.2, 1.55, 24);
        ringGeom.rotateX(-Math.PI / 2);
        const ringMesh = new THREE.Mesh(ringGeom, mat);
        bGrp.add(ringMesh);

        // Light point
        const pLight = new THREE.PointLight(
          iss.priority === 'URGENT' ? 0xe11d48 : 0xd4a72c,
          1.2,
          16
        );
        bGrp.add(pLight);

        // Hitbox for raycast
        const hitGeom = new THREE.SphereGeometry(1.8, 8, 8);
        const hitMesh = new THREE.Mesh(hitGeom, new THREE.MeshBasicMaterial({ visible: false }));
        hitMesh.userData = { issue: iss, buildingCode: iss.location.buildingCode };
        bGrp.add(hitMesh);

        beaconsRoot.add(bGrp);
        animStateRef.current.issueBeacons.push({ group: bGrp, issue: iss, basePos });
      });
    };

    rebuildBeacons(issues);

    // Mouse & Touch Orbit Controls (No external library dependency)
    const onMouseDown = (e: MouseEvent) => {
      animStateRef.current.isUserControlling = true;
      animStateRef.current.isPanning = e.button === 2 || e.shiftKey;
      animStateRef.current.lastX = e.clientX;
      animStateRef.current.lastY = e.clientY;
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      animStateRef.current.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      animStateRef.current.mouse.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      if (!animStateRef.current.isUserControlling) return;

      const dx = e.clientX - animStateRef.current.lastX;
      const dy = e.clientY - animStateRef.current.lastY;
      animStateRef.current.lastX = e.clientX;
      animStateRef.current.lastY = e.clientY;

      if (animStateRef.current.isPanning) {
        // Pan Target
        const forward = new THREE.Vector3()
          .subVectors(camera.position, animStateRef.current.camTarget)
          .normalize();
        const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
        animStateRef.current.targetLookAt.addScaledVector(right, -dx * 0.08);
        animStateRef.current.targetLookAt.z += dy * 0.08;
      } else {
        // Orbit
        animStateRef.current.orbitTheta -= dx * 0.008;
        animStateRef.current.orbitPhi = Math.max(
          0.18,
          Math.min(Math.PI / 2.15, animStateRef.current.orbitPhi - dy * 0.008)
        );
      }
    };

    const onMouseUp = () => {
      animStateRef.current.isUserControlling = false;
      animStateRef.current.isPanning = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      animStateRef.current.orbitRadius = Math.max(
        18,
        Math.min(140, animStateRef.current.orbitRadius + e.deltaY * 0.06)
      );
    };

    // Click / Tap Raycast Selection
    const onClick = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect();
      const clickX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const clickY = -(((e.clientY - rect.top) / rect.height) * 2 - 1);

      animStateRef.current.raycaster.setFromCamera(
        new THREE.Vector2(clickX, clickY),
        camera
      );

      // Check beacons first
      const beaconHits = animStateRef.current.raycaster.intersectObjects(
        beaconsRoot.children,
        true
      );
      if (beaconHits.length > 0) {
        for (const hit of beaconHits) {
          if (hit.object.userData?.issue) {
            const iss: Issue = hit.object.userData.issue;
            setSelectedIssueState(iss);
            callbacksRef.current.onIssueSelect?.(iss);
            setActiveBuildingCode(iss.location.buildingCode);
            callbacksRef.current.onLocationSelect?.(iss.location);
            return;
          }
        }
      }

      // Check buildings
      const buildingHitboxes = animStateRef.current.buildingNodes.map((n) => n.meshForRaycast);
      const bHits = animStateRef.current.raycaster.intersectObjects(buildingHitboxes, false);
      if (bHits.length > 0) {
        const clickedMesh = bHits[0].object as THREE.Mesh;
        const bCode = clickedMesh.userData?.buildingCode;
        const bName = clickedMesh.userData?.buildingName;
        if (bCode) {
          setActiveBuildingCode(bCode);
          setSelectedIssueState(null);
          callbacksRef.current.onLocationSelect?.({
            building: bName,
            buildingCode: bCode,
          });
        }
      }
    };

    // Context menu prevention for right-click pan
    const onContextMenu = (e: MouseEvent) => e.preventDefault();

    container.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    container.addEventListener('wheel', onWheel, { passive: false });
    container.addEventListener('click', onClick);
    container.addEventListener('contextmenu', onContextMenu);

    // Touch controls for mobile
    let touchStartDist = 0;
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        animStateRef.current.isUserControlling = true;
        animStateRef.current.lastX = e.touches[0].clientX;
        animStateRef.current.lastY = e.touches[0].clientY;
      } else if (e.touches.length === 2) {
        touchStartDist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (e.touches.length === 1 && animStateRef.current.isUserControlling) {
        const dx = e.touches[0].clientX - animStateRef.current.lastX;
        const dy = e.touches[0].clientY - animStateRef.current.lastY;
        animStateRef.current.lastX = e.touches[0].clientX;
        animStateRef.current.lastY = e.touches[0].clientY;

        animStateRef.current.orbitTheta -= dx * 0.008;
        animStateRef.current.orbitPhi = Math.max(
          0.18,
          Math.min(Math.PI / 2.15, animStateRef.current.orbitPhi - dy * 0.008)
        );
      } else if (e.touches.length === 2) {
        const dist = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        );
        const diff = touchStartDist - dist;
        animStateRef.current.orbitRadius = Math.max(
          18,
          Math.min(140, animStateRef.current.orbitRadius + diff * 0.15)
        );
        touchStartDist = dist;
      }
    };

    const onTouchEnd = () => {
      animStateRef.current.isUserControlling = false;
    };

    container.addEventListener('touchstart', onTouchStart, { passive: true });
    container.addEventListener('touchmove', onTouchMove, { passive: true });
    container.addEventListener('touchend', onTouchEnd, { passive: true });

    // Resize Handler
    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    window.addEventListener('resize', onResize);

    // Render Loop
    let animId = 0;
    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);

      const elapsed = animStateRef.current.clock.getElapsedTime();

      // Animate Issue Beacons (Rotation & Radar pulse)
      animStateRef.current.issueBeacons.forEach(({ group, basePos }, idx) => {
        const bob = Math.sin(elapsed * 3 + idx) * 0.45;
        group.position.y = basePos.y + bob;

        const pin = group.children[0];
        if (pin) pin.rotation.y = elapsed * 1.5;

        const ring = group.children[1];
        if (ring) {
          const pulse = (Math.sin(elapsed * 4 + idx * 0.8) + 1) / 2;
          ring.scale.set(1 + pulse * 0.8, 1 + pulse * 0.8, 1);
        }
      });

      // Compute Orbit Position around CamTarget
      const phi = animStateRef.current.orbitPhi;
      const theta = animStateRef.current.orbitTheta;
      const rad = animStateRef.current.orbitRadius;

      animStateRef.current.targetPos.x =
        animStateRef.current.targetLookAt.x + rad * Math.sin(phi) * Math.sin(theta);
      animStateRef.current.targetPos.y =
        animStateRef.current.targetLookAt.y + rad * Math.cos(phi);
      animStateRef.current.targetPos.z =
        animStateRef.current.targetLookAt.z + rad * Math.sin(phi) * Math.cos(theta);

      // Smooth Lerp Camera
      animStateRef.current.camPos.lerp(animStateRef.current.targetPos, 0.08);
      animStateRef.current.camTarget.lerp(animStateRef.current.targetLookAt, 0.08);

      camera.position.copy(animStateRef.current.camPos);
      camera.lookAt(animStateRef.current.camTarget);

      // Billboard Lamp Glows
      sceneGraph.lampGlows.forEach((g) => {
        g.quaternion.copy(camera.quaternion);
      });

      renderer.render(scene, camera);
    };

    renderLoop();
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animId);
      container.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      container.removeEventListener('wheel', onWheel);
      container.removeEventListener('click', onClick);
      container.removeEventListener('contextmenu', onContextMenu);
      container.removeEventListener('touchstart', onTouchStart);
      container.removeEventListener('touchmove', onTouchMove);
      container.removeEventListener('touchend', onTouchEnd);
      window.removeEventListener('resize', onResize);

      sceneGraph.dispose();
      materials.dispose();
      renderer.dispose();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webGLSupported]);

  // Focus Camera to Selected Building
  useEffect(() => {
    if (activeBuildingCode === 'ALL') {
      animStateRef.current.targetLookAt.set(0, 4, 8);
      animStateRef.current.orbitRadius = 82;
      animStateRef.current.orbitPhi = Math.PI / 3.4;
      animStateRef.current.orbitTheta = Math.PI / 2;
      if (animStateRef.current.highlightBox) {
        animStateRef.current.highlightBox.visible = false;
      }
      return;
    }

    const bNode = animStateRef.current.buildingNodes.find(
      (n) => n.code === activeBuildingCode
    );
    if (bNode) {
      animStateRef.current.targetLookAt.copy(bNode.position);
      animStateRef.current.targetLookAt.y += bNode.size.y * 0.4;
      animStateRef.current.orbitRadius = Math.max(bNode.size.x, bNode.size.z) * 1.55;
      animStateRef.current.orbitPhi = Math.PI / 3.8;

      // Update Highlight Box
      if (animStateRef.current.highlightBox) {
        animStateRef.current.highlightBox.position.copy(bNode.position);
        animStateRef.current.highlightBox.position.y += bNode.size.y / 2;
        animStateRef.current.highlightBox.scale.set(
          bNode.size.x + 1.2,
          bNode.size.y + 1.2,
          bNode.size.z + 1.2
        );
        animStateRef.current.highlightBox.visible = true;
      }
    }
  }, [activeBuildingCode]);

  // Jump to Camera Preset
  const applyPreset = (presetKey: keyof typeof CAMERA_PRESETS) => {
    const preset = CAMERA_PRESETS[presetKey];
    if (!preset) return;
    animStateRef.current.targetLookAt.set(...preset.t);
    const pVec = new THREE.Vector3(...preset.p);
    const tVec = new THREE.Vector3(...preset.t);
    const dist = pVec.distanceTo(tVec);
    animStateRef.current.orbitRadius = dist;

    // Calculate spherical angles
    const dir = new THREE.Vector3().subVectors(pVec, tVec).normalize();
    animStateRef.current.orbitPhi = Math.acos(dir.y);
    animStateRef.current.orbitTheta = Math.atan2(dir.x, dir.z);
  };

  const selectedBuildingData = animStateRef.current.buildingNodes.find(
    (n) => n.code === activeBuildingCode
  );

  const buildingIssueCount = issues.filter(
    (iss) => activeBuildingCode === 'ALL' || iss.location.buildingCode === activeBuildingCode
  ).length;

  const buildingCriticalCount = issues.filter(
    (iss) =>
      (activeBuildingCode === 'ALL' || iss.location.buildingCode === activeBuildingCode) &&
      iss.priority === 'URGENT' &&
      iss.status !== 'RESOLVED' &&
      iss.status !== 'CLOSED'
  ).length;

  return (
    <div
      className={`relative w-full bg-paper-100 border border-warm-300 rounded-lg overflow-hidden shadow-sm select-none ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : ''
      }`}
      style={{ height: isFullscreen ? '100vh' : height }}
    >
      {/* 3D WebGL Canvas */}
      <div
        ref={containerRef}
        className={`absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing transition-opacity duration-700 ${
          sceneReady ? 'opacity-100' : 'opacity-0'
        }`}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
      </div>

      {/* Atmospheric Vignette */}
      <div
        className="absolute inset-0 pointer-events-none z-10"
        style={{
          background:
            'radial-gradient(120% 90% at 50% 40%, transparent 55%, rgba(35,16,22,0.12) 100%)',
        }}
      />

      {/* Top Map Control & Filter Bar */}
      <div className="absolute top-3 left-3 right-3 z-20 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: Building & Zone Selector */}
        <div className="flex items-center gap-1.5 bg-white/95 backdrop-blur-md px-3 py-1.5 rounded-md border border-warm-300 shadow-sm pointer-events-auto">
          <Building2 className="w-4 h-4 text-maroon-800 shrink-0" />
          <select
            value={activeBuildingCode}
            onChange={(e) => {
              setActiveBuildingCode(e.target.value);
              setSelectedIssueState(null);
            }}
            className="text-xs font-semibold text-ink bg-transparent border-none focus:outline-none cursor-pointer pr-2"
          >
            <option value="ALL">Entire Campus (All 8 Bhavans)</option>
            <option value="CENT-ADM">Centenary Building (Admin / IQAC)</option>
            <option value="VID-BHAVAN">Vidyasagar Bhavan (Science / Tech)</option>
            <option value="LIB-CENTRAL">Central Library & Archives</option>
            <option value="RAB-BHAVAN">Rabindra Bhavan (Arts / Audit)</option>
            <option value="BCA-COMPLEX">BCA & IT Innovation Complex</option>
            <option value="CANTEEN-SCR">Student Common Room / Canteen</option>
            <option value="HOSTEL-BOYS">Kazi Nazrul Hostel (Boys)</option>
            <option value="SPORTS-PAV">College Sports Pavilion</option>
          </select>
        </div>

        {/* Center: Severity Filter Chips */}
        <div className="hidden md:flex items-center gap-1 bg-white/95 backdrop-blur-md p-1 rounded-md border border-warm-300 shadow-sm pointer-events-auto text-xs font-mono">
          {(['ALL', 'URGENT', 'HIGH', 'OPEN'] as const).map((sev) => (
            <button
              key={sev}
              type="button"
              onClick={() => setSeverityFilter(sev)}
              className={`px-2.5 py-1 rounded transition-colors cursor-pointer ${
                severityFilter === sev
                  ? 'bg-maroon-800 text-white font-bold shadow-xs'
                  : 'text-ink-muted hover:text-ink hover:bg-warm-100'
              }`}
            >
              {sev === 'ALL' ? 'All Tickets' : sev === 'URGENT' ? 'Urgent Hazards' : sev === 'HIGH' ? 'High Priority' : 'Active Only'}
            </button>
          ))}
        </div>

        {/* Right: Presets & Tools */}
        <div className="flex items-center gap-1.5 pointer-events-auto">
          <button
            type="button"
            onClick={() => {
              setActiveBuildingCode('ALL');
              applyPreset('OVERVIEW');
              setSelectedIssueState(null);
            }}
            className="p-1.5 bg-white/95 hover:bg-white text-ink rounded-md border border-warm-300 shadow-sm transition-colors cursor-pointer"
            title="Reset to Campus Overview"
          >
            <RotateCcw className="w-3.5 h-3.5 text-maroon-800" />
          </button>

          <button
            type="button"
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 bg-white/95 hover:bg-white text-ink rounded-md border border-warm-300 shadow-sm transition-colors cursor-pointer"
            title={isFullscreen ? 'Exit Fullscreen' : 'Expand Fullscreen'}
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5 text-ink" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5 text-ink" />
            )}
          </button>
        </div>
      </div>

      {/* Contextual Ledger Overlay: Selected Issue Inspector */}
      {selectedIssueState && (
        <div className="absolute top-14 right-3 z-20 w-80 max-w-[calc(100vw-24px)] bg-white/95 backdrop-blur-md rounded-lg border border-warm-300 shadow-lg p-4 space-y-3 pointer-events-auto">
          <div className="flex items-start justify-between gap-2 border-b border-warm-200 pb-2">
            <div>
              <span className="font-mono text-[10px] font-bold text-maroon-800 uppercase block">
                {selectedIssueState.ticketNumber}
              </span>
              <h3 className="font-serif font-bold text-sm text-ink leading-tight">
                {selectedIssueState.title}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIssueState(null)}
              className="text-ink-muted hover:text-ink text-xs p-1 cursor-pointer"
            >
              ✕
            </button>
          </div>

          <div className="flex items-center gap-2">
            <PriorityBadge priority={selectedIssueState.priority} />
            <IssueStatusBadge status={selectedIssueState.status} />
          </div>

          <div className="text-xs space-y-1 text-ink-muted">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-3.5 h-3.5 text-maroon-700" />
              <span className="font-medium text-ink">
                {selectedIssueState.location.building}
              </span>
            </div>
            {selectedIssueState.location.roomOrLandmark && (
              <p className="text-[11px] pl-5">
                Room / Area: {selectedIssueState.location.roomOrLandmark}
              </p>
            )}
            <div className="flex items-center gap-1.5 pt-1">
              <Building2 className="w-3.5 h-3.5 text-ink-muted" />
              <span>Dept: {selectedIssueState.department || 'General Maintenance'}</span>
            </div>
          </div>

          <p className="text-[11px] text-ink-muted line-clamp-2 bg-warm-50 p-2 rounded border border-warm-200">
            {selectedIssueState.description}
          </p>

          <div className="pt-1 flex items-center justify-between gap-2">
            <Link
              href={`/issues/${selectedIssueState.id}`}
              className="w-full flex items-center justify-center gap-1 bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold py-1.5 px-3 rounded shadow-sm transition-colors"
            >
              <span>Inspect Full Work Order</span>
              <ArrowRight className="w-3 h-3 text-gold-300" />
            </Link>
          </div>
        </div>
      )}

      {/* Contextual Ledger Overlay: Selected Building Diagnostic Summary */}
      {!selectedIssueState && selectedBuildingData && (
        <div className="absolute bottom-12 left-3 z-20 w-80 max-w-[calc(100vw-24px)] bg-white/95 backdrop-blur-md rounded-lg border border-warm-300 shadow-lg p-3.5 space-y-2 pointer-events-auto">
          <div className="flex items-center justify-between border-b border-warm-200 pb-2">
            <div>
              <span className="font-mono text-[10px] font-bold text-maroon-800 uppercase block">
                {selectedBuildingData.code}
              </span>
              <h4 className="font-serif font-bold text-sm text-ink leading-tight">
                {selectedBuildingData.name}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setActiveBuildingCode('ALL')}
              className="text-ink-muted hover:text-ink text-xs p-1 cursor-pointer"
              title="Clear Selection"
            >
              ✕
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2 text-center py-1">
            <div className="p-2 rounded bg-warm-50 border border-warm-200">
              <span className="block font-mono text-base font-bold text-ink">
                {buildingIssueCount}
              </span>
              <span className="text-[10px] text-ink-muted uppercase">Active Issues</span>
            </div>
            <div className="p-2 rounded bg-warm-50 border border-warm-200">
              <span
                className={`block font-mono text-base font-bold ${
                  buildingCriticalCount > 0 ? 'text-rose-600' : 'text-emerald-700'
                }`}
              >
                {buildingCriticalCount > 0 ? `${buildingCriticalCount} Urgent` : 'Nominal'}
              </span>
              <span className="text-[10px] text-ink-muted uppercase">Hazard State</span>
            </div>
          </div>

          <div className="pt-1 flex items-center gap-2">
            <Link
              href={`/report?building=${encodeURIComponent(selectedBuildingData.name)}`}
              className="flex-1 flex items-center justify-center gap-1 bg-maroon-800 hover:bg-maroon-900 text-white text-xs font-semibold py-1.5 rounded transition-colors"
            >
              <span>Lodge Report Here</span>
            </Link>
          </div>
        </div>
      )}

      {/* Bottom Telemetry Status Bar */}
      <div className="absolute bottom-2 left-3 right-3 z-20 flex items-center justify-between pointer-events-none text-[11px] font-mono">
        <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-warm-300 shadow-sm pointer-events-auto flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
          <span className="text-maroon-950 font-bold">
            {filteredIssues.length} Incidents Pinpointed
          </span>
          <span className="text-ink-muted hidden sm:inline">
            | Left-drag to Rotate • Right-drag to Pan • Scroll to Zoom
          </span>
        </div>

        <div className="hidden sm:flex items-center gap-2 bg-white/90 backdrop-blur-md px-3 py-1 rounded-full border border-warm-300 shadow-sm pointer-events-auto">
          <span className="text-ink-muted">Malda College 3D Spatial Engine</span>
        </div>
      </div>
    </div>
  );
};
