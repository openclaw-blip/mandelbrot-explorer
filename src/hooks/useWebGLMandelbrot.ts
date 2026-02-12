import { useCallback, useEffect, useRef, useState } from 'react';
import { ColorTheme, defaultTheme } from '../colorThemes';

interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
}

export type FractalSet = {
  type: 'mandelbrot';
} | {
  type: 'julia';
  cr: number;
  ci: number;
};

interface UseWebGLMandelbrotOptions {
  maxIterations?: number;
  theme?: ColorTheme;
  colorScale?: 'log' | 'linear';
  fractalSet?: FractalSet;
}

const vertexShaderSource = `#version 300 es
  in vec2 a_position;
  out vec2 v_uv;
  
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Perturbation theory shader
// Reference orbit is precomputed on CPU, shader only computes deltas
const fragmentShaderSource = `#version 300 es
  precision highp float;
  
  in vec2 v_uv;
  out vec4 fragColor;
  
  uniform vec2 u_resolution;
  uniform vec2 u_center;      // For fallback direct computation
  uniform vec2 u_refOffset;   // refPoint - center (computed in float64 on CPU)
  uniform vec2 u_viewScale;   // (viewWidth, viewHeight)
  uniform int u_maxIterations;
  uniform int u_refOrbitLen;  // Actual length of reference orbit
  uniform sampler2D u_refOrbit;
  
  // Color palette uniforms
  uniform vec3 u_colors[8];
  uniform int u_colorScale;  // 0 = log, 1 = linear
  uniform int u_setType;     // 0 = Mandelbrot, 1 = Julia
  uniform vec2 u_juliaC;     // c parameter for Julia set
  
  // Fetch reference orbit value Z_n from texture
  vec2 getRefZ(int n) {
    float texCoord = (float(n) + 0.5) / float(u_maxIterations);
    return texture(u_refOrbit, vec2(texCoord, 0.5)).xy;
  }
  
  // Dynamic color palette
  vec3 getColor(float t) {
    float scaledT = t * 8.0;  // Cycle through palette
    int idx = int(mod(scaledT, 8.0));
    int nextIdx = int(mod(scaledT + 1.0, 8.0));
    float fract_t = fract(scaledT);
    float factor = (1.0 - cos(fract_t * 3.14159)) / 2.0;
    
    vec3 c1, c2;
    if (idx == 0) c1 = u_colors[0];
    else if (idx == 1) c1 = u_colors[1];
    else if (idx == 2) c1 = u_colors[2];
    else if (idx == 3) c1 = u_colors[3];
    else if (idx == 4) c1 = u_colors[4];
    else if (idx == 5) c1 = u_colors[5];
    else if (idx == 6) c1 = u_colors[6];
    else c1 = u_colors[7];
    
    if (nextIdx == 0) c2 = u_colors[0];
    else if (nextIdx == 1) c2 = u_colors[1];
    else if (nextIdx == 2) c2 = u_colors[2];
    else if (nextIdx == 3) c2 = u_colors[3];
    else if (nextIdx == 4) c2 = u_colors[4];
    else if (nextIdx == 5) c2 = u_colors[5];
    else if (nextIdx == 6) c2 = u_colors[6];
    else c2 = u_colors[7];
    
    return mix(c1, c2, factor);
  }
  
  void main() {
    // Pixel offset from view center
    float px = v_uv.x - 0.5;
    float py = v_uv.y - 0.5;
    vec2 pixelOffset = vec2(px * u_viewScale.x, py * u_viewScale.y);
    vec2 pixelCoord = u_center + pixelOffset;
    
    vec2 z;
    int iteration = 0;
    bool escaped = false;
    
    if (u_setType == 1) {
      // Julia set: z starts at pixel, c is fixed
      z = pixelCoord;
      vec2 c = u_juliaC;
      
      for (int i = 0; i < 10000; i++) {
        if (i >= u_maxIterations) break;
        
        float mag2 = z.x * z.x + z.y * z.y;
        if (mag2 > 4.0) {
          escaped = true;
          break;
        }
        
        float zr2 = z.x * z.x;
        float zi2 = z.y * z.y;
        z = vec2(zr2 - zi2 + c.x, 2.0 * z.x * z.y + c.y);
        iteration = i + 1;
      }
    } else {
      // Mandelbrot set: use perturbation theory
      // Delta c = (pixel's c) - refPoint
      vec2 dc = pixelOffset - u_refOffset;
      
      vec2 dz = vec2(0.0, 0.0);
      z = vec2(0.0, 0.0);
      bool useDirectCompute = false;
      
      // Phase 1: Perturbation while we have reference orbit
      for (int i = 0; i < 10000; i++) {
        if (i >= u_refOrbitLen || i >= u_maxIterations) {
          useDirectCompute = (i < u_maxIterations);
          break;
        }
        
        vec2 Zn = getRefZ(i);
        z = Zn + dz;
        float mag2 = z.x * z.x + z.y * z.y;
        
        if (mag2 > 4.0) {
          escaped = true;
          break;
        }
        
        // Check if delta is getting too large (glitch detection)
        float dzMag2 = dz.x * dz.x + dz.y * dz.y;
        if (dzMag2 > 1e6) {
          useDirectCompute = true;
          break;
        }
        
        // δz_new = 2·Z·δz + δz² + δc
        vec2 twoZdz = 2.0 * vec2(Zn.x * dz.x - Zn.y * dz.y, Zn.x * dz.y + Zn.y * dz.x);
        vec2 dz2 = vec2(dz.x * dz.x - dz.y * dz.y, 2.0 * dz.x * dz.y);
        dz = twoZdz + dz2 + dc;
        
        iteration = i + 1;
      }
      
      // Phase 2: Direct computation if needed
      if (useDirectCompute && !escaped) {
        vec2 c = pixelCoord;
        
        for (int i = iteration; i < 10000; i++) {
          if (i >= u_maxIterations) break;
          
          float mag2 = z.x * z.x + z.y * z.y;
          if (mag2 > 4.0) {
            escaped = true;
            break;
          }
          
          float zr2 = z.x * z.x;
          float zi2 = z.y * z.y;
          z = vec2(zr2 - zi2 + c.x, 2.0 * z.x * z.y + c.y);
          
          iteration = i + 1;
        }
      }
    }
    
    if (!escaped && iteration >= u_maxIterations) {
      fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else if (!escaped) {
      // Didn't escape but also didn't reach max - treat as in set
      fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      float t;
      if (u_colorScale == 1) {
        // Linear scale: iteration / maxIterations
        t = float(iteration) / float(u_maxIterations) * 4.0;
      } else {
        // Log scale: smooth coloring with log adjustments
        float mag2 = z.x * z.x + z.y * z.y;
        float smoothed = float(iteration) + 1.0 - log2(max(1.0, log2(mag2)));
        t = smoothed * 0.05;
      }
      fragColor = vec4(getColor(t), 1.0);
    }
  }
`;

function createShader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error('Shader compile error:', gl.getShaderInfoLog(shader));
    gl.deleteShader(shader);
    return null;
  }
  
  return shader;
}

function createProgram(gl: WebGL2RenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
  const program = gl.createProgram();
  if (!program) return null;
  
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);
  
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('Program link error:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  
  return program;
}

interface ReferenceOrbit {
  data: Float32Array;
  escapeIter: number;
  refX: number;
  refY: number;
}

// Find a good reference point - one that escapes late or not at all
function findBestReference(centerX: number, centerY: number, viewWidth: number, viewHeight: number, maxIterations: number): { x: number; y: number; escapeIter: number } {
  // Test center first
  let bestX = centerX;
  let bestY = centerY;
  let bestEscape = testEscape(centerX, centerY, maxIterations);
  
  // If center is good enough (escapes late), use it
  if (bestEscape >= maxIterations * 0.8) {
    return { x: bestX, y: bestY, escapeIter: bestEscape };
  }
  
  // Search in a grid pattern for a better reference
  const searchPoints = [
    [0, 0], [-0.25, 0], [0.25, 0], [0, -0.25], [0, 0.25],
    [-0.25, -0.25], [0.25, -0.25], [-0.25, 0.25], [0.25, 0.25],
    [-0.1, 0], [0.1, 0], [0, -0.1], [0, 0.1]
  ];
  
  for (const [dx, dy] of searchPoints) {
    const testX = centerX + dx * viewWidth;
    const testY = centerY + dy * viewHeight;
    const escape = testEscape(testX, testY, maxIterations);
    if (escape > bestEscape) {
      bestX = testX;
      bestY = testY;
      bestEscape = escape;
      if (bestEscape >= maxIterations) break; // Found one in the set
    }
  }
  
  return { x: bestX, y: bestY, escapeIter: bestEscape };
}

function testEscape(x: number, y: number, maxIterations: number): number {
  let zr = 0, zi = 0;
  for (let i = 0; i < maxIterations; i++) {
    const zr2 = zr * zr;
    const zi2 = zi * zi;
    if (zr2 + zi2 > 4.0) return i;
    const newZr = zr2 - zi2 + x;
    zi = 2 * zr * zi + y;
    zr = newZr;
  }
  return maxIterations;
}

function computeReferenceOrbit(refX: number, refY: number, maxIterations: number): ReferenceOrbit {
  const orbit = new Float32Array(maxIterations * 2);
  
  let zr = 0, zi = 0;
  let escapeIter = maxIterations;
  
  for (let i = 0; i < maxIterations; i++) {
    orbit[i * 2] = zr;
    orbit[i * 2 + 1] = zi;
    
    const zr2 = zr * zr;
    const zi2 = zi * zi;
    
    if (zr2 + zi2 > 4.0) {
      escapeIter = i;
      for (let j = i + 1; j < maxIterations; j++) {
        orbit[j * 2] = zr;
        orbit[j * 2 + 1] = zi;
      }
      break;
    }
    
    const newZr = zr2 - zi2 + refX;
    zi = 2 * zr * zi + refY;
    zr = newZr;
  }
  
  return { data: orbit, escapeIter, refX, refY };
}

// Parse view state from URL hash
function parseUrlState(): ViewState | null {
  const hash = window.location.hash.slice(1); // Remove #
  if (!hash) return null;
  
  const params = new URLSearchParams(hash);
  const x = parseFloat(params.get('x') || '');
  const y = parseFloat(params.get('y') || '');
  const z = parseFloat(params.get('z') || '');
  
  if (isNaN(x) || isNaN(y) || isNaN(z)) return null;
  
  return { centerX: x, centerY: y, zoom: z };
}

// Write view state to URL hash (preserving theme/scale params)
function updateUrl(view: ViewState) {
  const existingHash = window.location.hash.slice(1);
  const params = new URLSearchParams(existingHash);
  params.set('x', String(view.centerX));
  params.set('y', String(view.centerY));
  params.set('z', String(view.zoom));
  const newHash = params.toString();
  window.history.replaceState(null, '', `#${newHash}`);
}

export function useWebGLMandelbrot(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseWebGLMandelbrotOptions = {}
) {
  const { maxIterations = 1000, theme = defaultTheme, colorScale = 'log', fractalSet = { type: 'mandelbrot' } } = options;

  // Initialize from URL or defaults
  const [viewState, setViewState] = useState<ViewState>(() => {
    const urlState = parseUrlState();
    return urlState || { centerX: -0.5, centerY: 0, zoom: 1 };
  });

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const refOrbitTexRef = useRef<WebGLTexture | null>(null);
  const uniformsRef = useRef<{
    resolution: WebGLUniformLocation | null;
    center: WebGLUniformLocation | null;
    refOffset: WebGLUniformLocation | null;
    viewScale: WebGLUniformLocation | null;
    maxIterations: WebGLUniformLocation | null;
    refOrbitLen: WebGLUniformLocation | null;
    refOrbit: WebGLUniformLocation | null;
    colors: WebGLUniformLocation | null;
    colorScale: WebGLUniformLocation | null;
    setType: WebGLUniformLocation | null;
    juliaC: WebGLUniformLocation | null;
  } | null>(null);
  
  const animationFrameRef = useRef<number>();
  const initialView = parseUrlState() || { centerX: -0.5, centerY: 0, zoom: 1 };
  const currentViewRef = useRef<ViewState>(initialView);
  const lastRefPointRef = useRef<{ centerX: number; centerY: number; refX: number; refY: number; escapeIter: number; zoom: number } | null>(null);
  const urlUpdateTimeoutRef = useRef<number>();
  const isAnimatingRef = useRef<boolean>(false);
  const isDraggingRef = useRef<boolean>(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { 
      antialias: false,
      preserveDrawingBuffer: true 
    });
    if (!gl) {
      console.error('WebGL 2.0 not supported');
      return;
    }
    
    // Enable float textures
    const ext = gl.getExtension('EXT_color_buffer_float');
    if (!ext) {
      console.warn('EXT_color_buffer_float not available, may affect precision');
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,  1, -1,  -1, 1,
      -1, 1,   1, -1,   1, 1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Create texture for reference orbit
    const refOrbitTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    refOrbitTexRef.current = refOrbitTex;

    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      center: gl.getUniformLocation(program, 'u_center'),
      refOffset: gl.getUniformLocation(program, 'u_refOffset'),
      viewScale: gl.getUniformLocation(program, 'u_viewScale'),
      maxIterations: gl.getUniformLocation(program, 'u_maxIterations'),
      refOrbitLen: gl.getUniformLocation(program, 'u_refOrbitLen'),
      refOrbit: gl.getUniformLocation(program, 'u_refOrbit'),
      colors: gl.getUniformLocation(program, 'u_colors'),
      colorScale: gl.getUniformLocation(program, 'u_colorScale'),
      setType: gl.getUniformLocation(program, 'u_setType'),
      juliaC: gl.getUniformLocation(program, 'u_juliaC'),
    };

    glRef.current = gl;
    programRef.current = program;
    
    // Trigger initial render on next frame
    requestAnimationFrame(() => {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * dpr;
      canvas.height = rect.height * dpr;
      
      // Need to get render function - call it directly here
      const view = currentViewRef.current;
      const aspectRatio = canvas.width / canvas.height;
      const viewWidth = 4 / view.zoom;
      const viewHeight = viewWidth / aspectRatio;
      
      const bestRef = findBestReference(view.centerX, view.centerY, viewWidth, viewHeight, maxIterations);
      const orbit = computeReferenceOrbit(bestRef.x, bestRef.y, maxIterations);
      
      gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, maxIterations, 1, 0, gl.RG, gl.FLOAT, orbit.data);
      lastRefPointRef.current = { centerX: view.centerX, centerY: view.centerY, refX: bestRef.x, refY: bestRef.y, escapeIter: orbit.escapeIter, zoom: view.zoom };
      
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(program);
      
      const refOffsetX = bestRef.x - view.centerX;
      const refOffsetY = bestRef.y - view.centerY;
      
      gl.uniform2f(uniformsRef.current!.resolution, canvas.width, canvas.height);
      gl.uniform2f(uniformsRef.current!.center, view.centerX, view.centerY);
      gl.uniform2f(uniformsRef.current!.refOffset, refOffsetX, refOffsetY);
      gl.uniform2f(uniformsRef.current!.viewScale, viewWidth, viewHeight);
      gl.uniform1i(uniformsRef.current!.maxIterations, maxIterations);
      gl.uniform1i(uniformsRef.current!.refOrbitLen, orbit.escapeIter);
      
      // Set color palette
      const colorData = new Float32Array(theme.colors.flat());
      gl.uniform3fv(uniformsRef.current!.colors, colorData);
      gl.uniform1i(uniformsRef.current!.colorScale, colorScale === 'linear' ? 1 : 0);
      gl.uniform1i(uniformsRef.current!.setType, fractalSet.type === 'julia' ? 1 : 0);
      gl.uniform2f(uniformsRef.current!.juliaC, 
        fractalSet.type === 'julia' ? fractalSet.cr : 0,
        fractalSet.type === 'julia' ? fractalSet.ci : 0
      );
      
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
      gl.uniform1i(uniformsRef.current!.refOrbit, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    });

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteTexture(refOrbitTex);
    };
  }, [canvasRef, colorScale, theme, fractalSet]);

  const render = useCallback((view: ViewState) => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const canvas = canvasRef.current;
    const refOrbitTex = refOrbitTexRef.current;
    
    if (!gl || !program || !uniforms || !canvas || !refOrbitTex) return;

    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    // Compute reference orbit (skip during animation for smooth zooming)
    const lastRef = lastRefPointRef.current;
    
    // Check if old reference point is still within current view
    const refInView = lastRef && 
      Math.abs(lastRef.refX - view.centerX) < viewWidth * 0.4 &&
      Math.abs(lastRef.refY - view.centerY) < viewHeight * 0.4;
    
    // Don't recompute during animation or dragging - wait for it to settle
    const needNewRef = !isAnimatingRef.current && !isDraggingRef.current && 
      (!lastRef || !refInView || Math.abs(lastRef.zoom - view.zoom) > view.zoom * 0.5);
    
    let refOrbitLen = lastRef?.escapeIter ?? maxIterations;
    let refX = lastRef?.refX ?? view.centerX;
    let refY = lastRef?.refY ?? view.centerY;
    
    if (needNewRef) {
      // Find best reference point
      const bestRef = findBestReference(view.centerX, view.centerY, viewWidth, viewHeight, maxIterations);
      refX = bestRef.x;
      refY = bestRef.y;
      
      const orbit = computeReferenceOrbit(refX, refY, maxIterations);
      refOrbitLen = orbit.escapeIter;
      
      gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG32F, maxIterations, 1, 0, gl.RG, gl.FLOAT, orbit.data);
      
      lastRefPointRef.current = { centerX: view.centerX, centerY: view.centerY, refX, refY, escapeIter: refOrbitLen, zoom: view.zoom };
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    // Compute refOffset = refPoint - center (in float64, then pass to shader)
    const refOffsetX = refX - view.centerX;
    const refOffsetY = refY - view.centerY;
    
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.center, view.centerX, view.centerY);
    gl.uniform2f(uniforms.refOffset, refOffsetX, refOffsetY);
    gl.uniform2f(uniforms.viewScale, viewWidth, viewHeight);
    gl.uniform1i(uniforms.maxIterations, maxIterations);
    gl.uniform1i(uniforms.refOrbitLen, refOrbitLen);
    
    // Set color palette
    const colorData = new Float32Array(theme.colors.flat());
    gl.uniform3fv(uniforms.colors, colorData);
    gl.uniform1i(uniforms.colorScale, colorScale === 'linear' ? 1 : 0);
    gl.uniform1i(uniforms.setType, fractalSet.type === 'julia' ? 1 : 0);
    gl.uniform2f(uniforms.juliaC,
      fractalSet.type === 'julia' ? fractalSet.cr : 0,
      fractalSet.type === 'julia' ? fractalSet.ci : 0
    );
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
    gl.uniform1i(uniforms.refOrbit, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [canvasRef, maxIterations, theme, colorScale, fractalSet]);

  const animateTo = useCallback((target: ViewState, duration: number = 300) => {
    const startView = { ...currentViewRef.current };
    const startTime = performance.now();
    isAnimatingRef.current = true;
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      
      const currentView: ViewState = {
        centerX: startView.centerX + (target.centerX - startView.centerX) * eased,
        centerY: startView.centerY + (target.centerY - startView.centerY) * eased,
        zoom: startView.zoom * Math.pow(target.zoom / startView.zoom, eased),
      };
      
      currentViewRef.current = currentView;
      setViewState(currentView);
      render(currentView);
      
      if (progress < 1) {
        animationFrameRef.current = requestAnimationFrame(animate);
      } else {
        // Animation complete
        isAnimatingRef.current = false;
        updateUrl(currentView);
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [render]);

  // Instant zoom for wheel events (no animation, accumulates)
  const zoomAtInstant = useCallback((screenX: number, screenY: number, zoomFactor: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    
    const aspectRatio = rect.width / rect.height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const realPart = current.centerX + (x / rect.width - 0.5) * viewWidth;
    const imagPart = current.centerY + (0.5 - y / rect.height) * viewHeight;
    
    const newZoom = current.zoom * zoomFactor;
    
    // Pan towards/away from mouse point
    const panFactor = zoomFactor > 1 ? (1 - 1/zoomFactor) : (1 - zoomFactor);
    const direction = zoomFactor > 1 ? 1 : -1;
    const newCenterX = current.centerX + (realPart - current.centerX) * panFactor * direction;
    const newCenterY = current.centerY + (imagPart - current.centerY) * panFactor * direction;
    
    const newView = { centerX: newCenterX, centerY: newCenterY, zoom: newZoom };
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
    
    // Debounced URL update
    if (urlUpdateTimeoutRef.current) clearTimeout(urlUpdateTimeoutRef.current);
    urlUpdateTimeoutRef.current = window.setTimeout(() => updateUrl(newView), 300);
  }, [canvasRef, render]);

  // Animated zoom for click events
  const zoomAt = useCallback((screenX: number, screenY: number, zoomIn: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    
    // Use CSS dimensions for coordinate conversion
    const aspectRatio = rect.width / rect.height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    // x/rect.width gives ratio 0-1 since both are CSS pixels
    const realPart = current.centerX + (x / rect.width - 0.5) * viewWidth;
    const imagPart = current.centerY + (0.5 - y / rect.height) * viewHeight;
    
    const zoomFactor = zoomIn ? 2 : 0.5;
    const newZoom = current.zoom * zoomFactor;
    
    const panFactor = zoomIn ? 0.5 : -0.5;
    const newCenterX = current.centerX + (realPart - current.centerX) * panFactor;
    const newCenterY = current.centerY + (imagPart - current.centerY) * panFactor;
    
    animateTo({ centerX: newCenterX, centerY: newCenterY, zoom: newZoom });
  }, [canvasRef, animateTo]);

  const pan = useCallback((deltaX: number, deltaY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const aspectRatio = rect.width / rect.height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    // deltaX/Y are in CSS pixels, use rect dimensions
    const newView: ViewState = {
      centerX: current.centerX - (deltaX / rect.width) * viewWidth,
      centerY: current.centerY + (deltaY / rect.height) * viewHeight,
      zoom: current.zoom,
    };
    
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
    
    // Debounced URL update for panning
    if (urlUpdateTimeoutRef.current) {
      clearTimeout(urlUpdateTimeoutRef.current);
    }
    urlUpdateTimeoutRef.current = window.setTimeout(() => {
      updateUrl(newView);
    }, 300);
  }, [canvasRef, render]);

  const reset = useCallback(() => {
    animateTo({ centerX: -0.5, centerY: 0, zoom: 1 }, 500);
  }, [animateTo]);

  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    
    render(currentViewRef.current);
  }, [canvasRef, render]);

  const startDrag = useCallback(() => {
    isDraggingRef.current = true;
  }, []);

  const stopDrag = useCallback(() => {
    isDraggingRef.current = false;
    // Re-render with potentially new reference
    render(currentViewRef.current);
  }, [render]);

  const setCenter = useCallback((newCenterX: number, newCenterY: number) => {
    const newView: ViewState = {
      centerX: newCenterX,
      centerY: newCenterY,
      zoom: currentViewRef.current.zoom,
    };
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
    updateUrl(newView);
  }, [render]);

  const navigateTo = useCallback((newCenterX: number, newCenterY: number, newZoom: number) => {
    const newView: ViewState = {
      centerX: newCenterX,
      centerY: newCenterY,
      zoom: newZoom,
    };
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
    updateUrl(newView);
  }, [render]);

  return {
    viewState,
    isComputing: false,
    zoomAt,
    zoomAtInstant,
    pan,
    reset,
    setCenter,
    navigateTo,
    handleResize,
    startDrag,
    stopDrag,
    render: () => render(currentViewRef.current),
  };
}
