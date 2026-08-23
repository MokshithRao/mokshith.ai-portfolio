/* ============================================================
   WebGL Shader Background
   Subtle neural grid with cursor interaction
   Ported from Stitch design specification
   ============================================================ */

(function () {
  'use strict';

  // Skip on mobile for performance
  const isMobile = window.matchMedia('(max-width: 768px)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (isMobile || prefersReducedMotion) {
    // Show a simple static gradient fallback
    const container = document.getElementById('shader-bg');
    if (container) {
      container.style.background = 'radial-gradient(ellipse at 30% 20%, rgba(59,130,246,0.05), transparent 60%)';
    }
    return;
  }

  const canvas = document.getElementById('shader-canvas');
  if (!canvas) return;

  // Sync the WebGL drawing-buffer size with the CSS-driven layout size
  function syncSize() {
    const w = canvas.clientWidth || 1280;
    const h = canvas.clientHeight || 720;
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
  }

  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(syncSize).observe(canvas);
  }
  syncSize();

  const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
  if (!gl) return;

  // Vertex Shader
  const vsSource = `
    attribute vec2 a_position;
    varying vec2 v_texCoord;
    void main() {
      v_texCoord = a_position * 0.5 + 0.5;
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `;

  // Fragment Shader — Neural grid with subtle cursor interaction
  const fsSource = `
    precision highp float;
    varying vec2 v_texCoord;
    uniform float u_time;
    uniform vec2 u_resolution;
    uniform vec2 u_mouse;

    float hash(vec2 p) {
      p = fract(p * vec2(123.34, 456.21));
      p += dot(p, p + 45.32);
      return fract(p.x * p.y);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      float a = hash(i);
      float b = hash(i + vec2(1.0, 0.0));
      float c = hash(i + vec2(0.0, 1.0));
      float d = hash(i + vec2(1.0, 1.0));
      vec2 u = f * f * (3.0 - 2.0 * f);
      return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
    }

    void main() {
      vec2 uv = v_texCoord;
      vec2 p = (v_texCoord - 0.5) * 2.0;
      p.x *= u_resolution.x / u_resolution.y;

      vec2 m = (u_mouse / u_resolution - 0.5) * 2.0;
      m.x *= u_resolution.x / u_resolution.y;

      // Interactive Neural Grid
      float grid_size = 40.0;
      vec2 grid_uv = uv * grid_size;
      vec2 grid_f = fract(grid_uv);

      float dist_to_mouse = length(p - m);
      float mouse_influence = smoothstep(0.8, 0.0, dist_to_mouse);

      // Grid lines with mouse distortion
      float grid = smoothstep(0.02 + mouse_influence * 0.04, 0.0, abs(grid_f.x - 0.5)) +
                   smoothstep(0.02 + mouse_influence * 0.04, 0.0, abs(grid_f.y - 0.5));

      // Flowing Neural Paths
      float paths = 0.0;
      for (float i = 1.0; i < 4.0; i++) {
        float speed = u_time * (0.05 * i);
        float n = noise(uv * (1.5 * i) + speed + mouse_influence * 0.1);
        paths += smoothstep(0.49, 0.5, n) * 0.2;
      }

      // Data Particles traveling along connections
      float particles = 0.0;
      for (float i = 0.0; i < 8.0; i++) {
        float t = u_time * 0.2 + i * 1.618;
        vec2 pos = vec2(hash(vec2(i, 1.0)), hash(vec2(i, 2.0)));
        pos.x += sin(t) * 0.3;
        pos.y += cos(t * 0.7) * 0.2;
        float d = length(uv - pos);
        particles += smoothstep(0.004, 0.0, d) * (0.5 + 0.5 * sin(u_time * 2.0 + i));
      }

      // Colors — kept subtle
      vec3 obsidian = vec3(0.03, 0.03, 0.04);
      vec3 primary = vec3(0.23, 0.51, 0.96);
      vec3 accent = vec3(0.48, 0.24, 0.92);

      vec3 color = obsidian;
      color += primary * grid * (0.05 + mouse_influence * 0.2);
      color += accent * paths * (0.15 + 0.1 * sin(u_time * 0.5));
      color += primary * particles * 0.7;

      // Ambient Glow near cursor
      color += primary * (1.0 - smoothstep(0.0, 1.0, dist_to_mouse)) * 0.05;

      // Vignette
      color *= 1.1 - length(p * 0.6);

      gl_FragColor = vec4(color, 1.0);
    }
  `;

  // Compile shader
  function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    return shader;
  }

  // Create program
  const program = gl.createProgram();
  gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(program);
  gl.useProgram(program);

  // Geometry — fullscreen quad
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

  const positionLoc = gl.getAttribLocation(program, 'a_position');
  gl.enableVertexAttribArray(positionLoc);
  gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

  // Uniforms
  const uTime = gl.getUniformLocation(program, 'u_time');
  const uResolution = gl.getUniformLocation(program, 'u_resolution');
  const uMouse = gl.getUniformLocation(program, 'u_mouse');

  // Mouse tracking
  let mouse = { x: canvas.width / 2, y: canvas.height / 2 };
  window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    if (rect.width && rect.height) {
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = 1.0 - (e.clientY - rect.top) / rect.height;
      mouse.x = nx * canvas.width;
      mouse.y = ny * canvas.height;
    }
  });

  // Render loop
  function render(time) {
    if (typeof ResizeObserver === 'undefined') syncSize();
    gl.viewport(0, 0, canvas.width, canvas.height);
    if (uTime) gl.uniform1f(uTime, time * 0.001);
    if (uResolution) gl.uniform2f(uResolution, canvas.width, canvas.height);
    if (uMouse) gl.uniform2f(uMouse, mouse.x, mouse.y);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    requestAnimationFrame(render);
  }

  requestAnimationFrame(render);
})();
