'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import Link from 'next/link';
import { detectWebGL } from './webgl-check';
import { createCampusMaterials, CampusMaterials } from './campus-materials';
import { buildCampusSceneGraph, CampusSceneGraph } from './campus-geometry';
import { Button } from '@/components/ui/Button';
import {
  Compass,
  ArrowRight,
  ChevronDown,
  RotateCcw,
  MousePointer,
} from 'lucide-react';

interface StorySection {
  id: string;
  step: string;
  title: string;
  subtitle: string;
  desc: string;
  tag: string;
  buildingFocus: string;
  metricLabel: string;
  metricValue: string;
}

const STORY_SECTIONS: StorySection[] = [
  {
    id: 'intro',
    step: 'ESTD. 1944',
    title: 'Malda College Digital Campus',
    subtitle: 'Institutional Command Ledger & Spatial Operations Desk',
    desc: 'An authentic interactive 3D twin of Malda College. Real-time campus infrastructure telemetry, fault diagnosis, and department dispatching across the academic bhavans.',
    tag: 'Campus Overview',
    buildingFocus: 'Centenary Building (Administration & IQAC)',
    metricLabel: 'Live Health Index',
    metricValue: 'Computed Live',
  },
  {
    id: 'intake',
    step: 'STAGE 01',
    title: 'Incident Intake & Geo-Location',
    subtitle: 'Lodge Fault Reports with Photographic Ground Evidence',
    desc: 'Students and faculty submit physical defect tickets pinpointing precise classroom, lab, or corridor coordinates with tamper-evident photographic records.',
    tag: 'Vidyasagar Science Wing',
    buildingFocus: 'Physics & Computer Science Laboratories',
    metricLabel: 'Report Channel',
    metricValue: 'Evidence + GPS',
  },
  {
    id: 'triage',
    step: 'STAGE 02',
    title: 'Urgency Assessment & Triage',
    subtitle: 'Automated Hazard Analysis & Safety Scoring',
    desc: 'Automated diagnostic checks evaluate structural safety, electrical shock hazard, and water ingress severity to categorize high-priority risks immediately.',
    tag: 'Structural Telemetry',
    buildingFocus: 'Vidyasagar Science Block Facade',
    metricLabel: 'Hazard Screening',
    metricValue: 'Advisory Only',
  },
  {
    id: 'dispatch',
    step: 'STAGE 03',
    title: 'Department Work Order Dispatch',
    subtitle: 'Automated Routing to Electrical, Civil, and IT Cells',
    desc: 'Certified campus duty engineers and trade technicians receive signed digital work orders with location waypoints, spare parts inventory, and SLA counters.',
    tag: 'Engineering & Estate Cell',
    buildingFocus: 'BCA & IT Innovation Complex',
    metricLabel: 'Dispatch Routing',
    metricValue: 'Department Cells',
  },
  {
    id: 'resolution',
    step: 'STAGE 04',
    title: 'Field Execution & Remediation',
    subtitle: 'Licensed Physical Repair & Verification Proof',
    desc: 'Work crews resolve physical damage on-site, upload timestamped resolution photography, and register used materials into the institutional ledger.',
    tag: 'Student Quadrangle',
    buildingFocus: 'Central Promenade & Common Facilities',
    metricLabel: 'Closure Evidence',
    metricValue: 'Photo Proof',
  },
  {
    id: 'audit',
    step: 'STAGE 05',
    title: 'Verified Closure & IQAC Audit',
    subtitle: 'Executive Oversight & Student Signoff Confirmation',
    desc: 'Tickets close only upon reporting student validation and Internal Quality Assurance Cell (IQAC) ledger endorsement, preventing repeat maintenance failures.',
    tag: 'Executive Overview',
    buildingFocus: 'College Council & Campus Bhavans',
    metricLabel: 'Audit Trail',
    metricValue: 'Fully Logged',
  },
];

interface CameraWaypoint {
  p: [number, number, number];
  t: [number, number, number];
  fov: number;
}

const CAM_WAYPOINTS: CameraWaypoint[] = [
  // 0. Intro Overview: Centered looking down central quad to Centenary Hall
  { p: [0, 22, 62], t: [0, 6, 8], fov: 38 },

  // 1. Intake: Swoop toward Vidyasagar Science Wing with pulsating crimson hazard beacon
  { p: [-22, 16, 36], t: [-38, 6, 14], fov: 40 },

  // 2. Triage: Isometric perspective capturing Vidyasagar Science Block and Durgakingkar Sadan
  { p: [-16, 18, 10], t: [-36, 7, -8], fov: 38 },

  // 3. Dispatch: Looking along southern pathway toward Central Computer Lab & BCA Complex
  { p: [-10, 16, 56], t: [-24, 6, 78], fov: 40 },

  // 4. Resolution: Clean central quadrangle perspective overlooking the flagpole & walkways
  { p: [0, 15, 42], t: [0, 2, 16], fov: 42 },

  // 5. Verification: Grand commanding overview across all campus landmarks & athletic ground
  { p: [18, 56, 96], t: [6, 6, 16], fov: 44 },
];

export const CampusHeroScene: React.FC = () => {
  const scrollSectionRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [activeStep, setActiveStep] = useState(0);
  const [scrollProgress, setScrollProgress] = useState(0);
  const [webGLSupported, setWebGLSupported] = useState<boolean | null>(null);
  const [sceneReady, setSceneReady] = useState(false);

  const stateRef = useRef({
    targetStep: 0,
    smoothStep: 0,
    mx: 0,
    my: 0,
    tmx: 0,
    tmy: 0,
    clock: new THREE.Clock(),
    lastMoveTime: performance.now(),
    frameCount: 0,
  });

  useEffect(() => {
    const caps = detectWebGL();
    setWebGLSupported(caps.supported);
  }, []);

  // Pinned Scroll-Scrub Controller
  useEffect(() => {
    const handleScroll = () => {
      const section = scrollSectionRef.current;
      if (!section) return;

      const rect = section.getBoundingClientRect();
      const totalScrollable = section.offsetHeight - window.innerHeight;
      if (totalScrollable <= 0) return;

      const currentScrolled = -rect.top;
      const progress = Math.max(0, Math.min(1, currentScrolled / totalScrollable));

      setScrollProgress(progress);
      stateRef.current.targetStep = progress * (CAM_WAYPOINTS.length - 1);
      stateRef.current.lastMoveTime = performance.now();

      const newStep = Math.min(
        STORY_SECTIONS.length - 1,
        Math.floor(progress * (STORY_SECTIONS.length - 0.05))
      );
      setActiveStep(newStep);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToChapter = useCallback((index: number) => {
    const section = scrollSectionRef.current;
    if (!section) return;

    const totalScrollable = section.offsetHeight - window.innerHeight;
    const targetScrollY =
      window.scrollY +
      section.getBoundingClientRect().top +
      (index / (STORY_SECTIONS.length - 1)) * totalScrollable;

    stateRef.current.targetStep = index;
    stateRef.current.lastMoveTime = performance.now();
    setActiveStep(index);

    window.scrollTo({
      top: targetScrollY,
      behavior: 'smooth',
    });
  }, []);

  const nextChapter = () => {
    const next = Math.min(STORY_SECTIONS.length - 1, activeStep + 1);
    scrollToChapter(next);
  };

  const prevChapter = () => {
    const prev = Math.max(0, activeStep - 1);
    scrollToChapter(prev);
  };

  // WebGL Scene Initialization & Render Loop
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
      console.error('Failed to initialize WebGLRenderer:', e);
      setWebGLSupported(false);
      return;
    }

    renderer.setPixelRatio(caps.dpr);
    renderer.setSize(container.clientWidth, container.clientHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xebe6db);
    scene.fog = new THREE.FogExp2(0xebe6db, 0.0095);

    const camera = new THREE.PerspectiveCamera(
      CAM_WAYPOINTS[0].fov,
      container.clientWidth / container.clientHeight,
      0.5,
      320
    );
    scene.add(camera);

    const curveP = new THREE.CatmullRomCurve3(
      CAM_WAYPOINTS.map((w) => new THREE.Vector3(...w.p)),
      false,
      'catmullrom',
      0.35
    );
    const curveT = new THREE.CatmullRomCurve3(
      CAM_WAYPOINTS.map((w) => new THREE.Vector3(...w.t)),
      false,
      'catmullrom',
      0.35
    );

    const materials: CampusMaterials = createCampusMaterials(caps.maxAnisotropy);
    const sceneGraph: CampusSceneGraph = buildCampusSceneGraph(materials);
    scene.add(sceneGraph.root);

    const hemiLight = new THREE.HemisphereLight(0xfff6ea, 0x5c4d3d, 0.95);
    scene.add(hemiLight);

    const dirLight = new THREE.DirectionalLight(0xffedd2, 1.6);
    dirLight.position.set(45, 60, 35);
    dirLight.castShadow = !isMobile;
    if (!isMobile) {
      dirLight.shadow.mapSize.width = 1024;
      dirLight.shadow.mapSize.height = 1024;
      dirLight.shadow.camera.near = 10;
      dirLight.shadow.camera.far = 180;
      dirLight.shadow.camera.left = -60;
      dirLight.shadow.camera.right = 60;
      dirLight.shadow.camera.top = 60;
      dirLight.shadow.camera.bottom = -60;
      dirLight.shadow.bias = -0.0004;
    }
    scene.add(dirLight);

    const quadBounce = new THREE.PointLight(0xd4a72c, 0.5, 40);
    quadBounce.position.set(0, 4, 16);
    scene.add(quadBounce);

    const beaconGroup = new THREE.Group();
    beaconGroup.position.set(-38, 11.5, 14);

    const beaconCore = new THREE.Mesh(
      new THREE.SphereGeometry(0.65, 16, 16),
      materials.beaconMaterials.URGENT
    );
    const beaconRing1 = new THREE.Mesh(
      new THREE.RingGeometry(0.8, 1.05, 32),
      materials.beaconMaterials.URGENT
    );
    beaconRing1.rotateX(-Math.PI / 2);
    const beaconRing2 = new THREE.Mesh(
      new THREE.RingGeometry(1.2, 1.4, 32),
      materials.beaconMaterials.HIGH
    );
    beaconRing2.rotateX(-Math.PI / 2);

    const beaconLight = new THREE.PointLight(0xe11d48, 1.5, 20);
    beaconGroup.add(beaconCore, beaconRing1, beaconRing2, beaconLight);
    scene.add(beaconGroup);

    const fitAspect = (p: THREE.Vector3, t: THREE.Vector3, baseFov: number) => {
      const aspect = container.clientWidth / container.clientHeight;
      if (aspect < 1.4) {
        const factor = Math.max(0, (1.4 - aspect) / 0.8);
        const dir = new THREE.Vector3().subVectors(p, t).normalize();
        p.addScaledVector(dir, factor * 12);
        p.y += factor * 2.5;
        return baseFov * (1 + factor * 0.28);
      }
      return baseFov;
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = container.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
      stateRef.current.tmx = Math.max(-1, Math.min(1, x));
      stateRef.current.tmy = Math.max(-1, Math.min(1, y));
      stateRef.current.lastMoveTime = performance.now();
    };

    container.addEventListener('pointermove', onPointerMove);

    const onResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
      stateRef.current.lastMoveTime = performance.now();
    };
    window.addEventListener('resize', onResize);

    let isVisible = true;
    const observer = new IntersectionObserver(
      ([entry]) => {
        isVisible = entry.isIntersecting;
      },
      { threshold: 0.05 }
    );
    observer.observe(container);

    let animId = 0;
    const currentPos = new THREE.Vector3();
    const currentTarget = new THREE.Vector3();

    const renderLoop = () => {
      animId = requestAnimationFrame(renderLoop);
      if (!isVisible) return;

      stateRef.current.frameCount++;
      const delta = Math.min(0.1, stateRef.current.clock.getDelta());
      const elapsed = stateRef.current.clock.getElapsedTime();

      // Delta-time based smooth camera interpolation (resilient across frame rates)
      const lerpSpeed = Math.min(1, 1 - Math.exp(-9 * delta));
      stateRef.current.smoothStep +=
        (stateRef.current.targetStep - stateRef.current.smoothStep) * lerpSpeed;

      // Pointer Parallax Lerp
      stateRef.current.mx += (stateRef.current.tmx - stateRef.current.mx) * 0.08;
      stateRef.current.my += (stateRef.current.tmy - stateRef.current.my) * 0.08;

      // P3 Idle Optimization: Check if camera and interaction are at rest
      const cameraMoving =
        Math.abs(stateRef.current.smoothStep - stateRef.current.targetStep) > 0.0005;
      const pointerMoving =
        Math.abs(stateRef.current.mx - stateRef.current.tmx) > 0.002;
      const recentInteraction =
        performance.now() - stateRef.current.lastMoveTime < 1500;

      if (!cameraMoving && !pointerMoving && !recentInteraction) {
        if (stateRef.current.frameCount % 4 !== 0) {
          return;
        }
      }

      // Flag Wave Animation (P3: update buffer every 2nd frame)
      if (sceneGraph.flagMesh && stateRef.current.frameCount % 2 === 0) {
        const posAttr = sceneGraph.flagMesh.geometry.attributes.position;
        for (let i = 0; i < posAttr.count; i++) {
          const u = posAttr.getX(i);
          const wave = Math.sin(elapsed * 4 + u * 1.8) * 0.12 * (u / 3.0);
          posAttr.setZ(i, wave);
        }
        posAttr.needsUpdate = true;
      }

      // Beacon Pulse Animation
      const pulse = Math.sin(elapsed * 4.5) * 0.5 + 0.5;
      beaconRing1.scale.set(1 + pulse * 0.6, 1 + pulse * 0.6, 1);
      beaconRing2.scale.set(1 + (1 - pulse) * 0.5, 1 + (1 - pulse) * 0.5, 1);
      beaconLight.intensity = 1.2 + pulse * 1.8;

      const maxStep = CAM_WAYPOINTS.length - 1;
      const stepProg = Math.max(0, Math.min(maxStep, stateRef.current.smoothStep));
      const u = stepProg / maxStep;

      curveP.getPoint(u, currentPos);
      curveT.getPoint(u, currentTarget);

      const i0 = Math.floor(stepProg);
      const i1 = Math.min(maxStep, i0 + 1);
      const frac = stepProg - i0;
      let targetFov =
        CAM_WAYPOINTS[i0].fov * (1 - frac) + CAM_WAYPOINTS[i1].fov * frac;

      targetFov = fitAspect(currentPos, currentTarget, targetFov);

      const parAmt = 0.85;
      currentPos.x += stateRef.current.mx * 1.2 * parAmt;
      currentPos.y += stateRef.current.my * 0.6 * parAmt;
      currentTarget.x -= stateRef.current.mx * 0.4 * parAmt;
      currentTarget.y -= stateRef.current.my * 0.2 * parAmt;

      camera.position.copy(currentPos);
      camera.lookAt(currentTarget);

      if (Math.abs(camera.fov - targetFov) > 0.01) {
        camera.fov = targetFov;
        camera.updateProjectionMatrix();
      }

      sceneGraph.lampGlows.forEach((g) => {
        g.quaternion.copy(camera.quaternion);
      });

      renderer.render(scene, camera);
    };

    renderLoop();
    setSceneReady(true);

    return () => {
      cancelAnimationFrame(animId);
      observer.disconnect();
      container.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', onResize);

      sceneGraph.dispose();
      materials.dispose();
      renderer.dispose();
    };
  }, [webGLSupported]);

  const current = STORY_SECTIONS[activeStep];

  return (
    // Outer scroll container (height: 320vh provides ~500px of scroll per chapter before page resumes)
    <section
      id="campus-hero-scroll-container"
      ref={scrollSectionRef}
      className="relative w-full"
      style={{ height: '320vh' }}
    >
      {/* Sticky Fullscreen 3D Stage */}
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-paper-100 border-b border-warm-300 select-none">
        {/* Three.js Canvas */}
        <div
          ref={containerRef}
          className={`absolute inset-0 w-full h-full transition-opacity duration-700 ${
            sceneReady ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <canvas ref={canvasRef} className="w-full h-full block" />
        </div>

        {/* Atmospheric Vignette Overlay */}
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            background:
              'radial-gradient(130% 100% at 50% 20%, transparent 40%, rgba(40,16,20,0.14) 100%)',
          }}
        />
        <div
          className="absolute inset-0 pointer-events-none z-10"
          style={{
            backgroundImage:
              'linear-gradient(to bottom, rgba(248,246,241,0.25) 0%, transparent 20%, rgba(248,246,241,0.5) 85%, rgba(248,246,241,0.92) 100%)',
          }}
        />

        {/* Top Heritage Identity & Quick GIS Link */}
        <div className="absolute top-3 sm:top-4 left-3 sm:left-4 right-3 sm:right-4 z-20 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-2 bg-white/95 backdrop-blur-md px-3 py-1 rounded-full border border-warm-300 shadow-sm pointer-events-auto">
            <div className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse" />
            <span className="text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider text-maroon-950">
              Malda College 3D Spatial Grid
            </span>
            <span className="text-[10px] text-ink-muted hidden md:inline">
              | 9 Landmarks • 25.0018° N, 88.1366° E
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              type="button"
              onClick={() => scrollToChapter(0)}
              className="flex items-center gap-1.5 bg-white/95 hover:bg-white text-ink text-xs px-2.5 sm:px-3 py-1.5 rounded-full border border-warm-300 shadow-sm transition-colors cursor-pointer"
              title="Reset to Campus Overview"
            >
              <RotateCcw className="w-3.5 h-3.5 text-maroon-800" />
              <span className="hidden sm:inline font-medium">Reset View</span>
            </button>

            <Link
              href="/map"
              className="flex items-center gap-1.5 bg-maroon-800 hover:bg-maroon-900 text-white text-xs px-3 sm:px-3.5 py-1.5 rounded-full shadow-sm transition-colors font-medium cursor-pointer"
            >
              <Compass className="w-3.5 h-3.5 text-gold-300" />
              <span>3D Spatial Map</span>
            </Link>
          </div>
        </div>

        {/* Scroll Scrub Progress Indicator (Right Edge) */}
        <div className="hidden lg:flex flex-col items-center gap-2 absolute right-4 top-1/2 -translate-y-1/2 z-20 pointer-events-auto bg-white/85 backdrop-blur-md p-1.5 rounded-full border border-warm-300 shadow-sm">
          <span className="text-[9px] font-mono text-ink-muted uppercase -rotate-90 py-2">
            Scroll
          </span>
          <div className="w-1 h-28 bg-warm-200 rounded-full relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 bg-maroon-800 rounded-full transition-all duration-75"
              style={{ height: `${Math.round(scrollProgress * 100)}%` }}
            />
          </div>
          <span className="text-[9px] font-mono text-maroon-900 font-bold">
            {Math.round(scrollProgress * 100)}%
          </span>
        </div>

        {/* Main Foreground Layout */}
        <div className="relative z-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex flex-col justify-between pt-16 pb-4 sm:pb-8 pointer-events-none">
          {/* P1 & P2: Institutional Ledger Plate with High Contrast Solid Backing */}
          <div className="mt-auto sm:mt-4 max-w-xl pointer-events-auto">
            <div
              style={{
                backgroundColor: 'rgba(251, 250, 247, 0.94)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
              }}
              className="border border-warm-300 rounded-lg p-4 sm:p-5 shadow-md space-y-2.5 sm:space-y-3 transition-all duration-300"
            >
              {/* Header Row: Chapter Tag & Step Tracker */}
              <div className="flex items-center justify-between gap-2">
                <div className="inline-flex items-center gap-1.5 bg-maroon-900 text-gold-300 px-2.5 py-0.5 rounded text-[10px] sm:text-[11px] font-mono font-bold uppercase tracking-wider shadow-xs">
                  <span className="w-1.5 h-1.5 rounded-full bg-gold-400" />
                  <span>{current.step}</span>
                  <span className="text-white/50">•</span>
                  <span className="text-white font-sans">{current.tag}</span>
                </div>
                <div className="flex items-center gap-1 text-[10px] sm:text-[11px] font-mono text-ink-muted">
                  <MousePointer className="w-3 h-3 text-maroon-800 hidden sm:inline" />
                  <span className="hidden sm:inline">Scroll to Travel |</span>
                  <span className="font-bold text-maroon-900">
                    Chapter 0{activeStep + 1} / 06
                  </span>
                </div>
              </div>

              {/* Title & Subtitle: High Contrast on Ledger Plate */}
              <div className="space-y-0.5">
                <h1 className="font-serif font-bold text-xl sm:text-3xl text-maroon-950 tracking-tight leading-tight">
                  {current.title}
                </h1>
                <p className="font-serif text-xs sm:text-sm text-maroon-900/85 font-medium">
                  {current.subtitle}
                </p>
              </div>

              {/* Description: Bordered Quote Style */}
              <p className="text-xs sm:text-sm text-ink-muted leading-relaxed font-sans border-l-2 border-maroon-700/40 pl-2.5 line-clamp-2 sm:line-clamp-3">
                {current.desc}
              </p>

              {/* Spatial Focus & Metric Strip */}
              <div className="grid grid-cols-2 gap-2 pt-0.5">
                <div className="bg-warm-100/80 px-2.5 py-1.5 rounded border border-warm-200">
                  <span className="block text-[9px] sm:text-[10px] text-ink-muted uppercase font-mono font-semibold">
                    Focused Structure
                  </span>
                  <span className="text-xs font-serif font-bold text-maroon-950 truncate block">
                    {current.buildingFocus}
                  </span>
                </div>
                <div className="bg-warm-100/80 px-2.5 py-1.5 rounded border border-warm-200">
                  <span className="block text-[9px] sm:text-[10px] text-ink-muted uppercase font-mono font-semibold">
                    {current.metricLabel}
                  </span>
                  <span className="text-xs font-mono font-bold text-emerald-800">
                    {current.metricValue}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-1 flex items-center gap-2">
                <Link href="/report" className="flex-1 sm:flex-none">
                  <Button
                    variant="primary"
                    size="sm"
                    rightIcon={<ArrowRight className="w-3.5 h-3.5 text-gold-400" />}
                    className="w-full sm:w-auto font-semibold"
                  >
                    Lodge Report
                  </Button>
                </Link>

                <Link href="/dashboard" className="flex-1 sm:flex-none">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full sm:w-auto"
                  >
                    Portal Desk
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Bottom Story Navigation Pills & Arrow Controls */}
          <div className="w-full flex items-center justify-between gap-2 pt-2 border-t border-warm-300/60 pointer-events-auto">
            {/* Step Indicators (Clickable quick jumps) */}
            <div className="flex items-center gap-1 overflow-x-auto max-w-full pb-0.5">
              {STORY_SECTIONS.map((sec, idx) => (
                <button
                  key={sec.id}
                  type="button"
                  onClick={() => scrollToChapter(idx)}
                  className={`px-2.5 py-1 rounded text-[11px] font-mono transition-all duration-150 cursor-pointer flex items-center gap-1 whitespace-nowrap select-none touch-manipulation border ${
                    activeStep === idx
                      ? 'bg-maroon-800 text-white font-bold border-maroon-900 shadow-[0_2px_0_#54131D,0_3px_6px_rgba(84,19,29,0.25)] -translate-y-0.5'
                      : 'bg-white/95 hover:bg-white text-ink-muted hover:text-ink border-warm-300/80 hover:border-warm-400 hover:shadow-xs active:translate-y-0.5'
                  }`}
                >
                  <span className="text-[9px] opacity-75">0{idx + 1}</span>
                  <span className="hidden md:inline font-sans font-medium">{sec.tag}</span>
                </button>
              ))}
            </div>

            {/* Stepper Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={prevChapter}
                disabled={activeStep === 0}
                className={`p-1.5 bg-white/95 hover:bg-white text-ink rounded border border-warm-300 shadow-xs transition-all duration-150 cursor-pointer select-none touch-manipulation active:translate-y-0.5 ${
                  activeStep === 0 ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'hover:border-warm-400'
                }`}
                aria-label="Previous Chapter"
              >
                <ChevronDown className="w-3.5 h-3.5 rotate-90" />
              </button>
              <button
                type="button"
                onClick={nextChapter}
                disabled={activeStep === STORY_SECTIONS.length - 1}
                className={`p-1.5 bg-maroon-800 hover:bg-maroon-900 text-white rounded border border-maroon-900 shadow-[0_1.5px_0_#54131D,0_2px_4px_rgba(84,19,29,0.2)] transition-all duration-150 cursor-pointer select-none touch-manipulation active:translate-y-0.5 ${
                  activeStep === STORY_SECTIONS.length - 1 ? 'opacity-40 cursor-not-allowed pointer-events-none' : ''
                }`}
                aria-label="Next Chapter"
              >
                <ChevronDown className="w-3.5 h-3.5 -rotate-90 text-gold-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Fallback Banner for WebGL Unsupported Browsers */}
        {webGLSupported === false && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-paper-100 p-6 text-center">
            <div className="max-w-md bg-white p-6 rounded-lg border border-warm-300 shadow-subtle space-y-3">
              <Compass className="w-8 h-8 text-maroon-800 mx-auto" />
              <h3 className="font-serif font-bold text-lg text-ink">
                Malda College Campus Operations Desk
              </h3>
              <p className="text-xs text-ink-muted leading-relaxed">
                3D WebGL acceleration is currently unavailable in this browser environment. The standard operational ledger and ticket tracking systems are fully active.
              </p>
              <div className="pt-2 flex justify-center gap-2">
                <Link
                  href="/report"
                  className="px-3 py-1.5 bg-maroon-800 text-white rounded text-xs font-semibold"
                >
                  Lodge Report
                </Link>
                <Link
                  href="/issues"
                  className="px-3 py-1.5 bg-warm-100 text-ink rounded text-xs font-medium border border-warm-300"
                >
                  View Issues
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
