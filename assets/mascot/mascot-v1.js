/* Ripple's quiet touch companion. Original implementation; no remote services. */
(function () {
  'use strict';
  var clamp = function (x, low, high) { return Math.max(low, Math.min(high, x)); };
  var motion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };

  function meshRenderer(root, img) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    var gl;
    try { gl = canvas.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, powerPreference: 'low-power' }); } catch (_) {}
    if (!gl) return null;
    function shader(kind, source) {
      var result = gl.createShader(kind);
      gl.shaderSource(result, source); gl.compileShader(result);
      if (!gl.getShaderParameter(result, gl.COMPILE_STATUS)) throw new Error('Shader unavailable');
      return result;
    }
    try {
      var program = gl.createProgram();
      var vertex = shader(gl.VERTEX_SHADER, 'attribute vec2 pos;attribute vec2 uv;varying vec2 tex;void main(){tex=uv;gl_Position=vec4(pos.x*2.0-1.0,1.0-pos.y*2.0,0.,1.);}');
      var fragment = shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 tex;uniform sampler2D picture;uniform vec2 touch;uniform float pressure;void main(){vec4 c=texture2D(picture,tex);float milk=smoothstep(.60,.85,dot(c.rgb,vec3(.299,.587,.114)));float dent=exp(-dot(tex-touch,tex-touch)*42.);vec2 highlight=touch+vec2(-.06,-.07);float gleam=exp(-dot(tex-highlight,tex-highlight)*100.);c.rgb+=c.a*milk*pressure*(vec3(.075,.085,.08)*gleam-vec3(.06,.045,.025)*dent);gl_FragColor=vec4(clamp(c.rgb,0.,c.a),c.a);}');
      gl.attachShader(program, vertex); gl.attachShader(program, fragment); gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) throw new Error('Renderer unavailable');
      gl.useProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment);
      var divisions = 32, base = [], indices = [];
      for (var y = 0; y <= divisions; y++) for (var x = 0; x <= divisions; x++) base.push(x / divisions, y / divisions);
      for (var row = 0; row < divisions; row++) for (var col = 0; col < divisions; col++) {
        var a = row * (divisions + 1) + col, b = a + divisions + 1;
        indices.push(a, b, a + 1, a + 1, b, b + 1);
      }
      var coords = new Float32Array(base.length), buffer = gl.createBuffer(), uvBuffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(base), gl.STATIC_DRAW);
      var uv = gl.getAttribLocation(program, 'uv'); gl.enableVertexAttribArray(uv); gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 0, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferData(gl.ARRAY_BUFFER, coords.byteLength, gl.DYNAMIC_DRAW);
      var position = gl.getAttribLocation(program, 'pos'); gl.enableVertexAttribArray(position); gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      var elements = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, elements); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint16Array(indices), gl.STATIC_DRAW);
      var texture = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      var touchUniform = gl.getUniformLocation(program, 'touch'), pressureUniform = gl.getUniformLocation(program, 'pressure');
      gl.clearColor(0, 0, 0, 0); gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);
      root.appendChild(canvas);
      var lost = false;
      canvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); lost = true; delete root.dataset.renderer; });
      // Stay with the image fallback after context loss; no reload or user action needed.
      return function (s, anchor) {
        if (lost) return false;
        var size = Math.round(root.clientWidth * 1.4 * Math.min(window.devicePixelRatio || 1, 2));
        if (!size) return true;
        if (canvas.width !== size) { canvas.width = canvas.height = size; gl.viewport(0, 0, size, size); }
        for (var i = 0; i < base.length; i += 2) {
          var bx = base[i], by = base[i + 1];
          var dx = bx - anchor.x, dy = by - anchor.y;
          var influence = Math.exp(-(dx * dx + dy * dy) / 0.095);
          var dentX = dx * s.press * 0.23 * influence, dentY = (dy * 0.17 + 0.022) * s.press * influence;
          var eyelid = 0;
          if (s.blink) {
            [[0.382, 0.493], [0.625, 0.466]].forEach(function (eye) {
              var ex = bx - eye[0], ey = by - eye[1];
              eyelid += ey * Math.exp(-ex * ex * 780 - ey * ey * 610) * s.blink * 1.5;
            });
          }
          var px = (bx - 0.5) * s.sx + s.tugX * influence + s.bend * Math.sin(by * Math.PI) + dentX;
          var py = (by - 0.78) * s.sy + s.tugY * influence + dentY - eyelid;
          var cs = Math.cos(s.angle), sn = Math.sin(s.angle);
          coords[i] = (px * cs - py * sn + 0.5 + s.x + 0.2) / 1.4;
          coords[i + 1] = (px * sn + py * cs + 0.78 + s.y + 0.2) / 1.4;
        }
        gl.uniform2f(touchUniform, anchor.x, anchor.y); gl.uniform1f(pressureUniform, s.press);
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer); gl.bufferSubData(gl.ARRAY_BUFFER, 0, coords);
        gl.clear(gl.COLOR_BUFFER_BIT); gl.drawElements(gl.TRIANGLES, indices.length, gl.UNSIGNED_SHORT, 0);
        root.dataset.renderer = 'webgl'; return true;
      };
    } catch (_) { canvas.remove(); return null; }
  }

  function mount(root) {
    if (root.dataset.rippleReady) return;
    var img = root.querySelector('img'); if (!img) return;
    root.dataset.rippleReady = 'true';
    var points = new Map(), frame = 0, previous = 0, renderer = null, visible = true, gesture = null, blinkTimer = 0, blinkStart = 0;
    var anchor = { x: 0.5, y: 0.5 };
    var neutral = { x: 0, y: 0, sx: 1, sy: 1, angle: 0, bend: 0, tugX: 0, tugY: 0, press: 0 };
    var current = Object.assign({}, neutral), target = Object.assign({}, neutral), velocity = {};
    Object.keys(neutral).forEach(function (key) { velocity[key] = 0; });
    current.blink = 0;
    function scheduleBlink() {
      clearTimeout(blinkTimer);
      if (!visible || document.hidden || motion.matches) return;
      blinkTimer = setTimeout(function () { blinkStart = performance.now(); wake(); }, 3400 + Math.random() * 3400);
    }
    function draw() {
      if (renderer && renderer(current, anchor)) { img.style.transform = ''; return; }
      img.style.transformOrigin = '50% 78%';
      img.style.transform = 'translate(' + (current.x * 100) + '%,' + (current.y * 100) + '%) rotate(' + current.angle + 'rad) skewX(' + (current.bend * 25) + 'deg) scale(' + current.sx + ',' + current.sy + ')';
    }
    function tick(time) {
      frame = 0;
      if (!visible || document.hidden || motion.matches) { reset(); return; }
      var dt = Math.min((time - (previous || time - 16)) / 1000, 0.032); previous = time;
      var energy = 0;
      // Two short integration steps keep the spring stable on slow phones.
      for (var sub = 0; sub < 2; sub++) Object.keys(neutral).forEach(function (key) {
        velocity[key] += ((target[key] - current[key]) * 220 - velocity[key] * 17) * dt / 2;
        current[key] += velocity[key] * dt / 2;
        energy += Math.abs(target[key] - current[key]) + Math.abs(velocity[key]);
      });
      if (blinkStart) {
        var phase = (time - blinkStart) / 220;
        current.blink = phase < 1 ? Math.pow(Math.sin(Math.max(0, phase) * Math.PI), 1.3) : 0;
        if (phase >= 1) { blinkStart = 0; scheduleBlink(); }
      }
      draw();
      if (energy > 0.003 || blinkStart) frame = requestAnimationFrame(tick);
      else { Object.assign(current, target); draw(); previous = 0; }
    }
    function wake() { if (!frame && visible && !document.hidden && !motion.matches) frame = requestAnimationFrame(tick); }
    function releaseCaptures() {
      var ids = Array.from(points.keys()); points.clear();
      ids.forEach(function (id) { try { root.releasePointerCapture(id); } catch (_) {} });
    }
    function reset() {
      cancelAnimationFrame(frame); frame = 0; previous = 0;
      clearTimeout(blinkTimer); blinkStart = 0; current.blink = 0;
      releaseCaptures(); gesture = null;
      Object.assign(current, neutral); Object.assign(target, neutral);
      Object.keys(velocity).forEach(function (key) { velocity[key] = 0; }); draw(); scheduleBlink();
    }
    function startGesture() {
      var list = Array.from(points.values()), box = root.getBoundingClientRect();
      if (!list.length) return;
      var p = list[0], q = list[1];
      gesture = { x: p.x, y: p.y, time: performance.now(), size: box.width, moved: false, multi: !!q };
      anchor.x = clamp((p.x - box.left) / box.width, 0.1, 0.9); anchor.y = clamp((p.y - box.top) / box.height, 0.1, 0.9);
      if (q) {
        gesture.distance = Math.max(24, Math.hypot(q.x - p.x, q.y - p.y));
        gesture.cx = (p.x + q.x) / 2; gesture.cy = (p.y + q.y) / 2;
        gesture.angle = Math.atan2(q.y - p.y, q.x - p.x);
      }
    }
    function bounce() {
      if (motion.matches) return;
      velocity.sy -= 3.1; velocity.sx += 2.4; velocity.y -= 0.4; velocity.bend += 0.35; velocity.press += 8;
      Object.assign(target, neutral); wake();
    }
    root.addEventListener('pointerdown', function (e) {
      if (motion.matches || points.size >= 2 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try { root.setPointerCapture(e.pointerId); } catch (_) {}
      startGesture(); target.sx = 1.07; target.sy = 0.90; target.press = 0.85; wake();
    });
    root.addEventListener('pointermove', function (e) {
      if (!points.has(e.pointerId) || !gesture) return;
      points.set(e.pointerId, { x: e.clientX, y: e.clientY });
      var list = Array.from(points.values()), p = list[0], q = list[1];
      var dx = (p.x - gesture.x) / gesture.size, dy = (p.y - gesture.y) / gesture.size;
      gesture.moved = gesture.moved || Math.hypot(dx, dy) > 0.035;
      if (q && gesture.distance) {
        var ratio = clamp(Math.hypot(q.x - p.x, q.y - p.y) / gesture.distance, 0.65, 1.42);
        var horizontal = Math.abs(Math.cos(gesture.angle));
        target.sx = 1 + (ratio - 1) * (0.25 + 0.75 * horizontal);
        target.sy = 1 + (ratio - 1) * (1 - 0.75 * horizontal);
        target.x = clamp(((p.x + q.x) / 2 - gesture.cx) / gesture.size * 0.3, -0.09, 0.09);
        target.y = clamp(((p.y + q.y) / 2 - gesture.cy) / gesture.size * 0.3, -0.09, 0.09);
        var angle = Math.atan2(q.y - p.y, q.x - p.x) - gesture.angle;
        target.angle = clamp(Math.atan2(Math.sin(angle), Math.cos(angle)) * 0.3, -0.22, 0.22);
        target.tugX = target.tugY = target.bend = 0;
        target.press = 0.25;
      } else {
        target.x = clamp(dx * 0.25, -0.09, 0.09); target.y = clamp(dy * 0.22, -0.07, 0.08);
        target.tugX = clamp(dx * 0.5, -0.2, 0.2); target.tugY = clamp(dy * 0.5, -0.2, 0.2);
        target.angle = clamp(dx * 0.4, -0.18, 0.18); target.bend = clamp(dx * 0.15, -0.075, 0.075);
        target.sy = clamp(1 - dy * 0.3, 0.82, 1.18); target.sx = 1 + (1 - target.sy) * 0.4;
        target.press = 0.65;
      }
      wake();
    });
    function finish(e, cancelled) {
      if (!points.has(e.pointerId)) return;
      var tap = !cancelled && gesture && !gesture.moved && !gesture.multi && performance.now() - gesture.time < 450;
      points.delete(e.pointerId);
      try { root.releasePointerCapture(e.pointerId); } catch (_) {}
      if (cancelled) { reset(); return; }
      if (points.size) { startGesture(); gesture.multi = true; return; }
      gesture = null; Object.assign(target, neutral);
      if (tap) bounce(); else { velocity.bend -= current.bend * 8; wake(); }
    }
    root.addEventListener('pointerup', function (e) { finish(e, false); });
    root.addEventListener('pointercancel', function (e) { finish(e, true); });
    root.addEventListener('lostpointercapture', function (e) { if (points.has(e.pointerId)) reset(); });
    root.addEventListener('click', function (e) { if (e.detail === 0) bounce(); });
    root.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    root.addEventListener('dragstart', function (e) { e.preventDefault(); });
    window.addEventListener('blur', reset);
    document.addEventListener('visibilitychange', function () { if (document.hidden) reset(); else scheduleBlink(); });
    if (motion.addEventListener) motion.addEventListener('change', reset);
    if (window.IntersectionObserver) new IntersectionObserver(function (entries) {
      visible = entries[0].isIntersecting; if (!visible) reset(); else { draw(); scheduleBlink(); }
    }).observe(root);
    if (window.ResizeObserver) new ResizeObserver(function () { draw(); }).observe(root);
    function ready() { if (img.naturalWidth && !renderer) { renderer = meshRenderer(root, img); draw(); scheduleBlink(); } }
    if (img.complete) ready(); else img.addEventListener('load', ready, { once: true });
  }
  function mountAll() { document.querySelectorAll('[data-ripple-play]').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mountAll, { once: true }); else mountAll();
})();
