/**
 * MaldaOS WebGL Safety & Device Capabilities Utility
 * Protects against white-screens, crashes on low-end hardware, and honors user accessibility.
 */

export interface WebGLCapabilities {
  supported: boolean;
  webgl2: boolean;
  maxAnisotropy: number;
  maxTextureSize: number;
  isMobile: boolean;
  prefersReducedMotion: boolean;
  dpr: number;
  tier: 'high' | 'medium' | 'low';
}

let cachedCapabilities: WebGLCapabilities | null = null;

export function detectWebGL(): WebGLCapabilities {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      webgl2: false,
      maxAnisotropy: 1,
      maxTextureSize: 2048,
      isMobile: false,
      prefersReducedMotion: false,
      dpr: 1,
      tier: 'low',
    };
  }

  if (cachedCapabilities) return cachedCapabilities;

  const prefersReducedMotion =
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const isMobile =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    ) || window.innerWidth < 768;

  let supported = false;
  let webgl2 = false;
  let maxAnisotropy = 1;
  let maxTextureSize = 2048;

  try {
    const canvas = document.createElement('canvas');
    const gl2 = canvas.getContext('webgl2');
    if (gl2) {
      supported = true;
      webgl2 = true;
      maxTextureSize = gl2.getParameter(gl2.MAX_TEXTURE_SIZE) || 2048;
      const ext =
        gl2.getExtension('EXT_texture_filter_anisotropic') ||
        gl2.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
      if (ext) {
        maxAnisotropy = gl2.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
      }
    } else {
      const gl =
        canvas.getContext('webgl') ||
        (canvas.getContext('experimental-webgl') as WebGLRenderingContext | null);
      if (gl) {
        supported = true;
        webgl2 = false;
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE) || 2048;
        const ext =
          gl.getExtension('EXT_texture_filter_anisotropic') ||
          gl.getExtension('WEBKIT_EXT_texture_filter_anisotropic');
        if (ext) {
          maxAnisotropy = gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT) || 1;
        }
      }
    }
    // Clean up temporary canvas
    canvas.width = 1;
    canvas.height = 1;
  } catch {
    supported = false;
  }

  // Tier assignment
  let tier: 'high' | 'medium' | 'low' = 'high';
  if (!supported) {
    tier = 'low';
  } else if (isMobile || maxTextureSize < 4096 || !webgl2) {
    tier = 'medium';
  }

  // Cap DPR for optimal GPU performance
  const rawDpr = window.devicePixelRatio || 1;
  const dpr = isMobile ? Math.min(rawDpr, 1.25) : Math.min(rawDpr, 1.75);

  cachedCapabilities = {
    supported,
    webgl2,
    maxAnisotropy: Math.min(maxAnisotropy, 8),
    maxTextureSize,
    isMobile,
    prefersReducedMotion,
    dpr,
    tier,
  };

  return cachedCapabilities;
}
