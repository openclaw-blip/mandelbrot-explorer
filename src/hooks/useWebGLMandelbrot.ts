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

// Double-single precision Mandelbrot shader (WebGL 2.0)
// Uses 'precise' qualifier to prevent compiler optimizations that break error-free arithmetic
const fragmentShaderSource = `#version 300 es
  precision highp float;
  
  in vec2 v_uv;
  out vec4 fragColor;
  
  uniform vec2 u_resolution;
  uniform vec2 u_centerHi;
  uniform vec2 u_centerLo;
  uniform vec2 u_scaleHi;  // (viewWidth, viewHeight) high bits
  uniform vec2 u_scaleLo;  // (viewWidth, viewHeight) low bits
  uniform int u_maxIterations;
  uniform float u_zero;    // Always 0.0, prevents compiler optimization
  
  // ============================================
  // Double-Single Arithmetic (Emulated Float64)
  // ============================================
  
  // Prevent optimization: compiler can't know u_zero is always 0
  float noOpt(float x) { return x + u_zero; }
  
  vec2 ds(float a) {
    return vec2(a, 0.0);
  }
  
  // Quick Two-Sum: assumes |a| >= |b|
  vec2 quickTwoSum(float a, float b) {
    float s = noOpt(a + b);
    float e = noOpt(b - noOpt(s - a));
    return vec2(s, e);
  }
  
  // Two-Sum: works for any a, b  
  vec2 twoSum(float a, float b) {
    float s = noOpt(a + b);
    float v = noOpt(s - a);
    float e = noOpt(noOpt(a - noOpt(s - v)) + noOpt(b - v));
    return vec2(s, e);
  }
  
  // Split a float for Veltkamp/Dekker multiplication
  vec2 split(float a) {
    float c = noOpt(4097.0 * a);
    float aHi = noOpt(c - noOpt(c - a));
    float aLo = noOpt(a - aHi);
    return vec2(aHi, aLo);
  }
  
  // Two-Product: exact product using Dekker's algorithm
  vec2 twoProduct(float a, float b) {
    float p = noOpt(a * b);
    vec2 aS = split(a);
    vec2 bS = split(b);
    float err = noOpt(noOpt(noOpt(aS.x * bS.x - p) + aS.x * bS.y + aS.y * bS.x) + aS.y * bS.y);
    return vec2(p, err);
  }
  
  // DS + DS
  vec2 dsAdd(vec2 a, vec2 b) {
    vec2 s = twoSum(a.x, b.x);
    vec2 t = twoSum(a.y, b.y);
    float sy = noOpt(s.y + t.x);
    s = quickTwoSum(s.x, sy);
    sy = noOpt(s.y + t.y);
    s = quickTwoSum(s.x, sy);
    return s;
  }
  
  // DS + float
  vec2 dsAddF(vec2 a, float b) {
    vec2 s = twoSum(a.x, b);
    float sy = noOpt(s.y + a.y);
    s = quickTwoSum(s.x, sy);
    return s;
  }
  
  // DS * DS
  vec2 dsMul(vec2 a, vec2 b) {
    vec2 p = twoProduct(a.x, b.x);
    float py = noOpt(p.y + a.x * b.y + a.y * b.x);
    p = quickTwoSum(p.x, py);
    return p;
  }
  
  // DS * float
  vec2 dsMulF(vec2 a, float b) {
    vec2 p = twoProduct(a.x, b);
    float py = noOpt(p.y + a.y * b);
    p = quickTwoSum(p.x, py);
    return p;
  }
  
  // Compare DS > float
  bool dsGt(vec2 a, float b) {
    return (a.x > b) || (a.x == b && a.y > 0.0);
  }
  
  // ============================================
  // Color Palette
  // ============================================
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
  
  // ============================================
  // Main
  // ============================================
  void main() {
    // Pixel offset from center (-0.5 to 0.5)
    float px = v_uv.x - 0.5;
    float py = v_uv.y - 0.5;
    
    // Compute c = center + pixelOffset * scale using DS arithmetic
    vec2 scaleX = vec2(u_scaleHi.x, u_scaleLo.x);
    vec2 scaleY = vec2(u_scaleHi.y, u_scaleLo.y);
    vec2 centerX = vec2(u_centerHi.x, u_centerLo.x);
    vec2 centerY = vec2(u_centerHi.y, u_centerLo.y);
    
    vec2 cRe = dsAdd(centerX, dsMulF(scaleX, px));
    vec2 cIm = dsAdd(centerY, dsMulF(scaleY, py));
    
    // Mandelbrot iteration: z = z^2 + c
    vec2 zRe = ds(0.0);
    vec2 zIm = ds(0.0);
    
    int iteration = 0;
    
    for (int i = 0; i < 10000; i++) {
      if (i >= u_maxIterations) break;
      
      // z^2 = (zRe + zIm*i)^2 = zRe^2 - zIm^2 + 2*zRe*zIm*i
      vec2 zRe2 = dsMul(zRe, zRe);
      vec2 zIm2 = dsMul(zIm, zIm);
      vec2 zReIm = dsMul(zRe, zIm);
      
      // Check escape: |z|^2 > 4
      vec2 mag2 = dsAdd(zRe2, zIm2);
      if (dsGt(mag2, 4.0)) break;
      
      // z_new = z^2 + c
      // zRe_new = zRe^2 - zIm^2 + cRe
      // zIm_new = 2*zRe*zIm + cIm
      vec2 newZRe = dsAdd(dsAdd(zRe2, dsMulF(zIm2, -1.0)), cRe);
      vec2 newZIm = dsAdd(dsMulF(zReIm, 2.0), cIm);
      
      zRe = newZRe;
      zIm = newZIm;
      
      iteration = i + 1;
    }
    
    if (iteration >= u_maxIterations) {
      fragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      // Smooth coloring
      float zRe2 = zRe.x * zRe.x;
      float zIm2 = zIm.x * zIm.x;
      float smoothed = float(iteration) + 1.0 - log2(max(1.0, log2(zRe2 + zIm2)));
      float t = smoothed / float(u_maxIterations);
      fragColor = vec4(getColor(t), 1.0);
    }
  }
`;

function createShader(gl: WebGLRenderingContext, type: number, source: string): WebGLShader | null {
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

function createProgram(gl: WebGLRenderingContext, vertexShader: WebGLShader, fragmentShader: WebGLShader): WebGLProgram | null {
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

// Split a JavaScript float64 into two float32s
function splitDouble(value: number): [number, number] {
  const hi = Math.fround(value);
  const lo = value - hi;
  return [hi, Math.fround(lo)]; // Also fround the lo part
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

  const glRef = useRef<WebGLRenderingContext | null>(null);
  const programRef = useRef<WebGLProgram | null>(null);
  const uniformsRef = useRef<{
    resolution: WebGLUniformLocation | null;
    centerHi: WebGLUniformLocation | null;
    centerLo: WebGLUniformLocation | null;
    scaleHi: WebGLUniformLocation | null;
    scaleLo: WebGLUniformLocation | null;
    maxIterations: WebGLUniformLocation | null;
    zero: WebGLUniformLocation | null;
  } | null>(null);
  
  const animationFrameRef = useRef<number>();
  const currentViewRef = useRef<ViewState>(viewState);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2', { 
      antialias: false,
      preserveDrawingBuffer: true 
    }) as WebGLRenderingContext | null;
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

    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      centerHi: gl.getUniformLocation(program, 'u_centerHi'),
      centerLo: gl.getUniformLocation(program, 'u_centerLo'),
      scaleHi: gl.getUniformLocation(program, 'u_scaleHi'),
      scaleLo: gl.getUniformLocation(program, 'u_scaleLo'),
      maxIterations: gl.getUniformLocation(program, 'u_maxIterations'),
      zero: gl.getUniformLocation(program, 'u_zero'),
    };

    glRef.current = gl;
    programRef.current = program;

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [canvasRef]);

  const render = useCallback((view: ViewState) => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const canvas = canvasRef.current;
    
    if (!gl || !program || !uniforms || !canvas) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    // Calculate view dimensions in complex plane
    const aspectRatio = canvas.width / canvas.height;
    const viewWidth = 4 / view.zoom;
    const viewHeight = viewWidth / aspectRatio;

    // Split all values into hi/lo pairs
    const [centerXHi, centerXLo] = splitDouble(view.centerX);
    const [centerYHi, centerYLo] = splitDouble(view.centerY);
    const [scaleXHi, scaleXLo] = splitDouble(viewWidth);
    const [scaleYHi, scaleYLo] = splitDouble(viewHeight);

    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.centerHi, centerXHi, centerYHi);
    gl.uniform2f(uniforms.centerLo, centerXLo, centerYLo);
    gl.uniform2f(uniforms.scaleHi, scaleXHi, scaleYHi);
    gl.uniform2f(uniforms.scaleLo, scaleXLo, scaleYLo);
    gl.uniform1i(uniforms.maxIterations, maxIterations);
    gl.uniform1f(uniforms.zero, 0.0);

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
