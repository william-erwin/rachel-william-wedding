// Render the original transparent sketches as palette-aware circular halftone dots.
window.initWeddingHalftone = function(root) {
  const renders = [];
  const vertexSource = `
    attribute vec2 position;
    varying vec2 uv;
    void main() { uv = position * 0.5 + 0.5; gl_Position = vec4(position, 0.0, 1.0); }
  `;
  const fragmentSource = `
    precision mediump float;
    varying vec2 uv;
    uniform sampler2D artwork;
    uniform vec2 grid;
    uniform vec2 resolution;
    uniform vec3 ink;
    void main() {
      vec2 cell = floor(uv * grid);
      vec2 center = (cell + 0.5) / grid;
      float coverage = 0.0;
      for (int y = -3; y <= 3; y++) {
        for (int x = -3; x <= 3; x++) {
          vec2 offset = vec2(float(x), float(y)) / (12.0 * grid);
          coverage += texture2D(artwork, center + offset).a;
        }
      }
      coverage /= 49.0;
      float radius = 1.22;
      float distanceToCenter = length((fract(uv * grid) - 0.5) * 4.5);
      float edge = 4.5 * grid.x / resolution.x;
      float alpha = (1.0 - smoothstep(radius - edge * 0.5, radius + edge * 0.5, distanceToCenter)) * step(0.16, coverage);
      gl_FragColor = vec4(ink, alpha);
    }
  `;
  root.querySelectorAll('img.itinerary-image').forEach(image => {
    const start = () => {
      if (!image.naturalWidth || image.dataset.halftoneReady) return;
      image.dataset.halftoneReady = 'true';
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl', { alpha:true, premultipliedAlpha:false, antialias:false, preserveDrawingBuffer:true });
      if (!gl) return;
      const compile = (type, source) => {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source); gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) { gl.deleteShader(shader); throw new Error('Halftone shader unavailable'); }
        return shader;
      };
      try {
        const vertex = compile(gl.VERTEX_SHADER, vertexSource);
        const fragment = compile(gl.FRAGMENT_SHADER, fragmentSource);
        const program = gl.createProgram();
        gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
        gl.deleteShader(vertex); gl.deleteShader(fragment);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Halftone program unavailable');
        gl.useProgram(program);
        const buffer = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'position');
        gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position,2,gl.FLOAT,false,0,0);
        const texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D,texture);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL,true);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.LINEAR);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        const uniform = name => gl.getUniformLocation(program,name);
        const grid = uniform('grid'), resolution = uniform('resolution'), ink = uniform('ink');
        const wrapper = document.createElement('span');
        wrapper.className = image.className + ' halftone-art';
        wrapper.style.aspectRatio = image.naturalWidth + ' / ' + image.naturalHeight;
        wrapper.setAttribute('aria-hidden','true');
        image.before(wrapper); image.className = 'halftone-source'; wrapper.append(image,canvas);
        const render = () => {
          const width = wrapper.clientWidth, height = wrapper.clientHeight;
          if (!width || !height || gl.isContextLost()) return;
          const density = Math.min(window.devicePixelRatio || 1, 2);
          canvas.width = Math.round(width * density); canvas.height = Math.round(height * density);
          gl.viewport(0,0,canvas.width,canvas.height);
          const hex = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
          const color = /^#[0-9a-f]{6}$/i.test(hex) ? hex : '#FF8A63';
          gl.uniform3f(ink,...[1,3,5].map(i => parseInt(color.slice(i,i+2),16)/255));
          gl.uniform2f(grid,Math.max(1,Math.round(width/4.5)),Math.max(1,Math.round(height/4.5)));
          gl.uniform2f(resolution,canvas.width,canvas.height);
          gl.drawArrays(gl.TRIANGLES,0,6);
          wrapper.classList.add('is-rendered');
        };
        const resize = new ResizeObserver(render); resize.observe(wrapper);
        canvas.addEventListener('webglcontextlost', () => wrapper.classList.remove('is-rendered'));
        renders.push(render); render();
      } catch { /* Keep the original sketch if WebGL is unavailable. */ }
    };
    if (image.complete) start(); else image.addEventListener('load',start,{once:true});
  });
  // Redraw only on palette changes and resizing, not continuously.
  const paletteObserver = new MutationObserver(() => renders.forEach(render => render()));
  paletteObserver.observe(document.documentElement,{attributes:true,attributeFilter:['style','data-palette']});
};
