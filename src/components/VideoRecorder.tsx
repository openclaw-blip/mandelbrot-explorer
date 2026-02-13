import { useEffect, useRef, useState, useCallback } from 'react';
import { VideoExportConfig } from './VideoExportModal';
import { FractalSet } from '../hooks/useWebGLMandelbrot';
import { ColorTheme } from '../colorThemes';

interface VideoRecorderProps {
  config: VideoExportConfig;
  theme: ColorTheme;
  fractalSet: FractalSet;
  colorScale: 'log' | 'linear';
  onComplete: () => void;
  onCancel: () => void;
}

export function VideoRecorder({ config, theme, fractalSet, colorScale, onComplete, onCancel }: VideoRecorderProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState<'preparing' | 'recording' | 'encoding' | 'complete' | 'error'>('preparing');
  const [error, setError] = useState<string | null>(null);
  const cancelledRef = useRef(false);

  const render = useCallback((
    gl: WebGL2RenderingContext,
    program: WebGLProgram,
    uniforms: Record<string, WebGLUniformLocation | null>,
    width: number,
    height: number,
    centerX: number,
    centerY: number,
    zoom: number
  ) => {
    const aspectRatio = width / height;
    const viewWidth = 4 / zoom;
    const viewHeight = viewWidth / aspectRatio;

    gl.viewport(0, 0, width, height);
    gl.useProgram(program);

    gl.uniform2f(uniforms.resolution!, width, height);
    gl.uniform2f(uniforms.center!, centerX, centerY);
    gl.uniform2f(uniforms.refOffset!, 0, 0);
    gl.uniform2f(uniforms.viewScale!, viewWidth, viewHeight);
    gl.uniform1i(uniforms.maxIterations!, 1000);
    gl.uniform1i(uniforms.refOrbitLen!, 1000);

    const colorData = new Float32Array(theme.colors.flat());
    gl.uniform3fv(uniforms.colors!, colorData);
    gl.uniform1i(uniforms.colorScale!, colorScale === 'linear' ? 1 : 0);

    const setTypeMap: Record<string, number> = { 'mandelbrot': 0, 'julia': 1, 'burning-ship': 2, 'tricorn': 3, 'multibrot': 4 };
    gl.uniform1i(uniforms.setType!, setTypeMap[fractalSet.type] ?? 0);
    gl.uniform2f(uniforms.juliaC!,
      fractalSet.type === 'julia' ? fractalSet.cr : 0,
      fractalSet.type === 'julia' ? fractalSet.ci : 0
    );
    gl.uniform1f(uniforms.power!, fractalSet.type === 'multibrot' ? fractalSet.power : 2);

    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }, [theme, fractalSet, colorScale]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = config.width;
    canvas.height = config.height;

    const gl = canvas.getContext('webgl2', { preserveDrawingBuffer: true });
    if (!gl) {
      setError('WebGL 2.0 not supported');
      setStatus('error');
      return;
    }

    // Compile shaders (simplified version for video export)
    const vertexShaderSource = `#version 300 es
      in vec2 a_position;
      out vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;

    const fragmentShaderSource = `#version 300 es
      precision highp float;
      in vec2 v_uv;
      out vec4 fragColor;
      
      uniform vec2 u_resolution;
      uniform vec2 u_center;
      uniform vec2 u_refOffset;
      uniform vec2 u_viewScale;
      uniform int u_maxIterations;
      uniform int u_refOrbitLen;
      uniform vec3 u_colors[8];
      uniform int u_colorScale;
      uniform int u_setType;
      uniform vec2 u_juliaC;
      uniform float u_power;
      
      vec2 cpow(vec2 z, float n) {
        float r = length(z);
        if (r == 0.0) return vec2(0.0);
        float theta = atan(z.y, z.x);
        float rn = pow(r, n);
        return vec2(rn * cos(n * theta), rn * sin(n * theta));
      }
      
      vec3 getColor(float t) {
        float scaledT = t * 8.0;
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
        float px = v_uv.x - 0.5;
        float py = v_uv.y - 0.5;
        vec2 pixelOffset = vec2(px * u_viewScale.x, py * u_viewScale.y);
        vec2 pixelCoord = u_center + pixelOffset;
        
        vec2 z;
        vec2 c;
        
        if (u_setType == 1) {
          z = pixelCoord;
          c = u_juliaC;
        } else {
          z = vec2(0.0);
          c = pixelCoord;
        }
        
        int iteration = 0;
        bool escaped = false;
        
        for (int i = 0; i < 2000; i++) {
          if (i >= u_maxIterations) break;
          
          float mag2 = z.x * z.x + z.y * z.y;
          if (mag2 > 4.0) {
            escaped = true;
            break;
          }
          
          if (u_setType == 0 || u_setType == 1) {
            z = vec2(z.x * z.x - z.y * z.y + c.x, 2.0 * z.x * z.y + c.y);
          } else if (u_setType == 2) {
            float ax = abs(z.x);
            float ay = abs(z.y);
            z = vec2(ax * ax - ay * ay + c.x, 2.0 * ax * ay + c.y);
          } else if (u_setType == 3) {
            float zr = z.x;
            float zi = -z.y;
            z = vec2(zr * zr - zi * zi + c.x, 2.0 * zr * zi + c.y);
          } else if (u_setType == 4) {
            z = cpow(z, u_power) + c;
          }
          
          iteration = i + 1;
        }
        
        if (!escaped) {
          fragColor = vec4(0.0, 0.0, 0.0, 1.0);
        } else {
          float t;
          if (u_colorScale == 1) {
            t = float(iteration) / float(u_maxIterations) * 4.0;
          } else {
            float mag2 = z.x * z.x + z.y * z.y;
            float smoothed = float(iteration) + 1.0 - log2(max(1.0, log2(mag2)));
            t = smoothed * 0.05;
          }
          fragColor = vec4(getColor(t), 1.0);
        }
      }
    `;

    const createShader = (type: number, source: string) => {
      const shader = gl.createShader(type)!;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader error:', gl.getShaderInfoLog(shader));
        return null;
      }
      return shader;
    };

    const vertexShader = createShader(gl.VERTEX_SHADER, vertexShaderSource);
    const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentShaderSource);
    if (!vertexShader || !fragmentShader) {
      setError('Failed to compile shaders');
      setStatus('error');
      return;
    }

    const program = gl.createProgram()!;
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      setError('Failed to link program');
      setStatus('error');
      return;
    }

    // Set up geometry
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([
      -1, -1, 1, -1, -1, 1,
      -1, 1, 1, -1, 1, 1,
    ]), gl.STATIC_DRAW);

    const positionLocation = gl.getAttribLocation(program, 'a_position');
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

    const uniforms = {
      resolution: gl.getUniformLocation(program, 'u_resolution'),
      center: gl.getUniformLocation(program, 'u_center'),
      refOffset: gl.getUniformLocation(program, 'u_refOffset'),
      viewScale: gl.getUniformLocation(program, 'u_viewScale'),
      maxIterations: gl.getUniformLocation(program, 'u_maxIterations'),
      refOrbitLen: gl.getUniformLocation(program, 'u_refOrbitLen'),
      colors: gl.getUniformLocation(program, 'u_colors'),
      colorScale: gl.getUniformLocation(program, 'u_colorScale'),
      setType: gl.getUniformLocation(program, 'u_setType'),
      juliaC: gl.getUniformLocation(program, 'u_juliaC'),
      power: gl.getUniformLocation(program, 'u_power'),
    };

    // Set up MediaRecorder
    const stream = canvas.captureStream(config.fps);
    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'video/webm;codecs=vp9',
      videoBitsPerSecond: 10000000, // 10 Mbps
    });

    const chunks: Blob[] = [];
    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      if (cancelledRef.current) return;
      
      setStatus('encoding');
      const blob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fractal-zoom-${Date.now()}.webm`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus('complete');
      setTimeout(onComplete, 1000);
    };

    // Start recording
    setStatus('recording');
    mediaRecorder.start();

    const totalFrames = config.duration * config.fps;
    let frame = 0;

    const renderFrame = () => {
      if (cancelledRef.current) {
        mediaRecorder.stop();
        return;
      }

      const t = frame / totalFrames;
      
      // Interpolate position (linear for x/y, exponential for zoom)
      const currentX = config.startX + (config.endX - config.startX) * t;
      const currentY = config.startY + (config.endY - config.startY) * t;
      const currentZoom = config.startZoom * Math.pow(config.endZoom / config.startZoom, t);

      render(gl, program, uniforms, config.width, config.height, currentX, currentY, currentZoom);

      setProgress((frame / totalFrames) * 100);
      frame++;

      if (frame <= totalFrames) {
        // Use setTimeout to allow UI updates
        setTimeout(renderFrame, 1000 / config.fps);
      } else {
        mediaRecorder.stop();
      }
    };

    renderFrame();

    return () => {
      cancelledRef.current = true;
      gl.deleteProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
    };
  }, [config, render, onComplete]);

  const handleCancel = useCallback(() => {
    cancelledRef.current = true;
    onCancel();
  }, [onCancel]);

  return (
    <div className="video-recorder-backdrop">
      <div className="video-recorder">
        <canvas ref={canvasRef} className="video-recorder-canvas" />
        
        <div className="video-recorder-overlay">
          <div className="video-recorder-status">
            {status === 'preparing' && 'PREPARING...'}
            {status === 'recording' && `RECORDING ${progress.toFixed(0)}%`}
            {status === 'encoding' && 'ENCODING...'}
            {status === 'complete' && 'COMPLETE'}
            {status === 'error' && `ERROR: ${error}`}
          </div>
          
          <div className="video-recorder-progress">
            <div 
              className="video-recorder-progress-bar" 
              style={{ width: `${progress}%` }}
            />
          </div>
          
          {(status === 'recording' || status === 'preparing') && (
            <button className="video-recorder-cancel" onClick={handleCancel}>
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
