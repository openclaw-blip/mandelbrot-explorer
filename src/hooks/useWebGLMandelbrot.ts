import { useCallback, useEffect, useRef, useState } from 'react';

interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
}

interface UseWebGLMandelbrotOptions {
  maxIterations?: number;
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
  uniform vec2 u_deltaC;     // Offset from reference for this pixel's position in view
  uniform vec2 u_viewScale;  // (viewWidth, viewHeight)
  uniform int u_maxIterations;
  uniform int u_refOrbitLen; // Actual length of reference orbit
  uniform sampler2D u_refOrbit; // Reference orbit texture (Z_n values)
  
  // Fetch reference orbit value Z_n from texture
  vec2 getRefZ(int n) {
    float texCoord = (float(n) + 0.5) / float(u_maxIterations);
    return texture(u_refOrbit, vec2(texCoord, 0.5)).xy;
  }
  
  // Cyberpunk color palette
  vec3 getColor(float t) {
    vec3 colors[8];
    colors[0] = vec3(1.0, 0.0, 1.0);
    colors[1] = vec3(0.0, 1.0, 1.0);
    colors[2] = vec3(0.616, 0.0, 1.0);
    colors[3] = vec3(0.0, 0.4, 1.0);
    colors[4] = vec3(1.0, 0.0, 0.5);
    colors[5] = vec3(0.0, 0.784, 1.0);
    colors[6] = vec3(0.784, 0.0, 1.0);
    colors[7] = vec3(0.0, 0.588, 1.0);
    
    float scaledT = t * 4.0;
    int idx = int(mod(scaledT, 8.0));
    int nextIdx = int(mod(scaledT + 1.0, 8.0));
    float fract_t = fract(scaledT);
    float factor = (1.0 - cos(fract_t * 3.14159)) / 2.0;
    
    vec3 c1, c2;
    if (idx == 0) c1 = colors[0];
    else if (idx == 1) c1 = colors[1];
    else if (idx == 2) c1 = colors[2];
    else if (idx == 3) c1 = colors[3];
    else if (idx == 4) c1 = colors[4];
    else if (idx == 5) c1 = colors[5];
    else if (idx == 6) c1 = colors[6];
    else c1 = colors[7];
    
    if (nextIdx == 0) c2 = colors[0];
    else if (nextIdx == 1) c2 = colors[1];
    else if (nextIdx == 2) c2 = colors[2];
    else if (nextIdx == 3) c2 = colors[3];
    else if (nextIdx == 4) c2 = colors[4];
    else if (nextIdx == 5) c2 = colors[5];
    else if (nextIdx == 6) c2 = colors[6];
    else c2 = colors[7];
    
    return mix(c1, c2, factor);
  }
  
  void main() {
    // Delta c for this pixel (offset from reference point)
    float px = v_uv.x - 0.5;
    float py = v_uv.y - 0.5;
    vec2 dc = vec2(px * u_viewScale.x, py * u_viewScale.y);
    
    // Perturbation iteration
    // δz_{n+1} = 2·Z_n·δz_n + δz_n² + δc
    vec2 dz = vec2(0.0, 0.0); // δz starts at 0
    
    int iteration = 0;
    int maxIter = min(u_maxIterations, u_refOrbitLen);
    
    for (int i = 0; i < 10000; i++) {
      if (i >= maxIter) break;
      
      vec2 Zn = getRefZ(i);
      
      // Full z = Z + δz
      vec2 z = Zn + dz;
      float mag2 = z.x * z.x + z.y * z.y;
      
      if (mag2 > 4.0) break;
      
      // δz_new = 2·Z·δz + δz² + δc
      // Complex multiplication: (a+bi)(c+di) = (ac-bd) + (ad+bc)i
      // 2·Z·δz: 2 * (Zr + Zi·i) * (dzr + dzi·i) = 2 * ((Zr·dzr - Zi·dzi) + (Zr·dzi + Zi·dzr)i)
      vec2 twoZdz = 2.0 * vec2(Zn.x * dz.x - Zn.y * dz.y, Zn.x * dz.y + Zn.y * dz.x);
      
      // δz²: (dzr + dzi·i)² = (dzr² - dzi²) + (2·dzr·dzi)i
      vec2 dz2 = vec2(dz.x * dz.x - dz.y * dz.y, 2.0 * dz.x * dz.y);
      
      dz = twoZdz + dz2 + dc;
      
      iteration = i + 1;
    }
    
    if (iteration >= maxIter) {
      fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      vec2 Zn = getRefZ(iteration - 1);
      vec2 z = Zn + dz;
      float mag2 = z.x * z.x + z.y * z.y;
      float smoothed = float(iteration) + 1.0 - log2(max(1.0, log2(mag2)));
      float t = smoothed / float(u_maxIterations);
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

// Compute reference orbit at center point using JavaScript's float64
function computeReferenceOrbit(centerX: number, centerY: number, maxIterations: number): Float32Array {
  const orbit = new Float32Array(maxIterations * 2); // [re0, im0, re1, im1, ...]
  
  let zr = 0;
  let zi = 0;
  const cr = centerX;
  const ci = centerY;
  
  for (let i = 0; i < maxIterations; i++) {
    orbit[i * 2] = zr;
    orbit[i * 2 + 1] = zi;
    
    // z = z² + c
    const zr2 = zr * zr;
    const zi2 = zi * zi;
    
    if (zr2 + zi2 > 256) { // Extended bailout for smooth reference
      // Fill rest with last value
      for (let j = i + 1; j < maxIterations; j++) {
        orbit[j * 2] = zr;
        orbit[j * 2 + 1] = zi;
      }
      break;
    }
    
    const newZr = zr2 - zi2 + cr;
    const newZi = 2 * zr * zi + ci;
    zr = newZr;
    zi = newZi;
  }
  
  return orbit;
}

export function useWebGLMandelbrot(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  options: UseWebGLMandelbrotOptions = {}
) {
  const { maxIterations = 1000 } = options;

  const [viewState, setViewState] = useState<ViewState>({
    centerX: -0.5,
    centerY: 0,
    zoom: 1,
  });

  const glRef = useRef<WebGL2RenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const refOrbitTexRef = useRef<WebGLTexture | null>(null);
  const uniformsRef = useRef<{
    resolution: WebGLUniformLocation | null;
    deltaC: WebGLUniformLocation | null;
    viewScale: WebGLUniformLocation | null;
    maxIterations: WebGLUniformLocation | null;
    refOrbitLen: WebGLUniformLocation | null;
    refOrbit: WebGLUniformLocation | null;
  } | null>(null);
  
  const animationFrameRef = useRef<number>();
  const currentViewRef = useRef<ViewState>(viewState);
  const lastRefPointRef = useRef<{ x: number; y: number } | null>(null);

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
      deltaC: gl.getUniformLocation(program, 'u_deltaC'),
      viewScale: gl.getUniformLocation(program, 'u_viewScale'),
      maxIterations: gl.getUniformLocation(program, 'u_maxIterations'),
      refOrbitLen: gl.getUniformLocation(program, 'u_refOrbitLen'),
      refOrbit: gl.getUniformLocation(program, 'u_refOrbit'),
    };

    glRef.current = gl;
    programRef.current = program;

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      gl.deleteTexture(refOrbitTex);
    };
  }, [canvasRef]);

  const render = useCallback((view: ViewState) => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const canvas = canvasRef.current;
    const refOrbitTex = refOrbitTexRef.current;
    
    if (!gl || !program || !uniforms || !canvas || !refOrbitTex) return;

    // Compute reference orbit at center (recompute if center changed significantly)
    const lastRef = lastRefPointRef.current;
    const needNewRef = !lastRef || 
      Math.abs(lastRef.x - view.centerX) > 1e-10 || 
      Math.abs(lastRef.y - view.centerY) > 1e-10;
    
    if (needNewRef) {
      const orbit = computeReferenceOrbit(view.centerX, view.centerY, maxIterations);
      
      // Upload orbit to texture (RG32F format for two floats per texel)
      gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
      gl.texImage2D(
        gl.TEXTURE_2D, 0, gl.RG32F,
        maxIterations, 1, 0,
        gl.RG, gl.FLOAT, orbit
      );
      
      lastRefPointRef.current = { x: view.centerX, y: view.centerY };
    }

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.deltaC, 0, 0); // Reference is at center, so no delta for uniform
    gl.uniform2f(uniforms.viewScale, viewWidth, viewHeight);
    gl.uniform1i(uniforms.maxIterations, maxIterations);
    gl.uniform1i(uniforms.refOrbitLen, maxIterations);
    
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, refOrbitTex);
    gl.uniform1i(uniforms.refOrbit, 0);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [canvasRef, maxIterations]);

  const animateTo = useCallback((target: ViewState, duration: number = 300) => {
    const startView = { ...currentViewRef.current };
    const startTime = performance.now();
    
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
      }
    };
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
    }
    animationFrameRef.current = requestAnimationFrame(animate);
  }, [render]);

  const zoomAt = useCallback((screenX: number, screenY: number, zoomIn: boolean) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = screenX - rect.left;
    const y = screenY - rect.top;
    
    const width = canvas.width;
    const height = canvas.height;
    const aspectRatio = width / height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const dpr = window.devicePixelRatio || 1;
    const realPart = current.centerX + (x * dpr / width - 0.5) * viewWidth;
    const imagPart = current.centerY + (0.5 - y * dpr / height) * viewHeight;
    
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
    
    const current = currentViewRef.current;
    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const dpr = window.devicePixelRatio || 1;
    const newView: ViewState = {
      centerX: current.centerX - (deltaX * dpr / canvas.width) * viewWidth,
      centerY: current.centerY + (deltaY * dpr / canvas.height) * viewHeight,
      zoom: current.zoom,
    };
    
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
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

  return {
    viewState,
    isComputing: false,
    zoomAt,
    pan,
    reset,
    handleResize,
    render: () => render(currentViewRef.current),
  };
}
