import { useCallback, useEffect, useRef, useState } from 'react';

interface ViewState {
  centerX: number;
  centerY: number;
  zoom: number;
}

interface UseWebGLMandelbrotOptions {
  maxIterations?: number;
}

// Vertex shader - just draws a fullscreen quad
const vertexShaderSource = `
  attribute vec2 a_position;
  varying vec2 v_uv;
  
  void main() {
    v_uv = a_position * 0.5 + 0.5;
    gl_Position = vec4(a_position, 0.0, 1.0);
  }
`;

// Fragment shader - simple single precision first to establish baseline
const fragmentShaderSource = `
  precision highp float;
  
  varying vec2 v_uv;
  
  uniform vec2 u_resolution;
  uniform vec2 u_center;
  uniform float u_zoom;
  uniform int u_maxIterations;
  
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
    // Pure single precision - calculate complex coordinate directly
    float aspectRatio = u_resolution.x / u_resolution.y;
    float viewWidth = 4.0 / u_zoom;
    float viewHeight = viewWidth / aspectRatio;
    
    float cRe = u_center.x + (v_uv.x - 0.5) * viewWidth;
    float cIm = u_center.y + (v_uv.y - 0.5) * viewHeight;
    
    // Standard Mandelbrot iteration
    float zr = 0.0;
    float zi = 0.0;
    
    int iteration = 0;
    
    for (int i = 0; i < 10000; i++) {
      if (i >= u_maxIterations) break;
      
      float zr2 = zr * zr;
      float zi2 = zi * zi;
      
      if (zr2 + zi2 > 4.0) break;
      
      zi = 2.0 * zr * zi + cIm;
      zr = zr2 - zi2 + cRe;
      
      iteration = i + 1;
    }
    
    if (iteration >= u_maxIterations) {
      gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);
    } else {
      float zr2 = zr * zr;
      float zi2 = zi * zi;
      float smoothed = float(iteration) + 1.0 - log2(max(1.0, log2(zr2 + zi2)));
      float t = smoothed / float(u_maxIterations);
      vec3 color = getColor(t);
      gl_FragColor = vec4(color, 1.0);
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
    center: WebGLUniformLocation | null;
    zoom: WebGLUniformLocation | null;
    maxIterations: WebGLUniformLocation | null;
  } | null>(null);
  
  const animationFrameRef = useRef<number>();
  const currentViewRef = useRef<ViewState>(viewState);

  // Initialize WebGL
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl', { 
      antialias: false,
      preserveDrawingBuffer: true 
    });
    if (!gl) {
      console.error('WebGL not supported');
      return;
    }

    const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
    
    if (!vertexShader || !fragmentShader) return;

    const program = createProgram(gl, vertexShader, fragmentShader);
    if (!program) return;

    // Set up geometry (fullscreen quad)
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1,
       1, -1,
      -1,  1,
      -1,  1,
       1, -1,
       1,  1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    uniformsRef.current = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      center: gl.getUniformLocation(program, 'u_center'),
      zoom: gl.getUniformLocation(program, 'u_zoom'),
      maxIterations: gl.getUniformLocation(program, 'u_maxIterations'),
    };

    glRef.current = gl;
    programRef.current = program;

    return () => {
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [canvasRef]);

  // Render function
  const render = useCallback((view: ViewState) => {
    const gl = glRef.current;
    const program = programRef.current;
    const uniforms = uniformsRef.current;
    const canvas = canvasRef.current;
    
    if (!gl || !program || !uniforms || !canvas) return;

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(program);

    // Set uniforms - pure single precision
    gl.uniform2f(uniforms.resolution, canvas.width, canvas.height);
    gl.uniform2f(uniforms.center, view.centerX, view.centerY);
    gl.uniform1f(uniforms.zoom, view.zoom);
    gl.uniform1i(uniforms.maxIterations, maxIterations);

    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [canvasRef, maxIterations]);

  // Animated transition
  const animateTo = useCallback((target: ViewState, duration: number = 300) => {
    const startView = { ...currentViewRef.current };
    const startTime = performance.now();
    
    const animate = (time: number) => {
      const elapsed = time - startTime;
      const progress = Math.min(elapsed / duration, 1);
      
      // Ease out cubic
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

  // Zoom at point
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
    
    // Convert screen coordinates to complex plane (flip Y for WebGL)
    const dpr = window.devicePixelRatio || 1;
    const realPart = current.centerX + (x * dpr / width - 0.5) * viewWidth;
    const imagPart = current.centerY + (0.5 - y * dpr / height) * viewHeight;
    
    const zoomFactor = zoomIn ? 2 : 0.5;
    const newZoom = current.zoom * zoomFactor;
    
    // Pan towards/away from click point
    const panFactor = zoomIn ? 0.5 : -0.5;
    const newCenterX = current.centerX + (realPart - current.centerX) * panFactor;
    const newCenterY = current.centerY + (imagPart - current.centerY) * panFactor;
    
    animateTo({
      centerX: newCenterX,
      centerY: newCenterY,
      zoom: newZoom,
    });
  }, [canvasRef, animateTo]);

  // Pan
  const pan = useCallback((deltaX: number, deltaY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const width = canvas.width;
    const height = canvas.height;
    const aspectRatio = width / height;
    
    const current = currentViewRef.current;
    const viewWidth = 4 / current.zoom;
    const viewHeight = viewWidth / aspectRatio;
    
    const dpr = window.devicePixelRatio || 1;
    const newView: ViewState = {
      centerX: current.centerX - (deltaX * dpr / width) * viewWidth,
      centerY: current.centerY + (deltaY * dpr / height) * viewHeight, // Flip Y
      zoom: current.zoom,
    };
    
    currentViewRef.current = newView;
    setViewState(newView);
    render(newView);
  }, [canvasRef, render]);

  // Reset view
  const reset = useCallback(() => {
    animateTo({
      centerX: -0.5,
      centerY: 0,
      zoom: 1,
    }, 500);
  }, [animateTo]);

  // Handle resize
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
