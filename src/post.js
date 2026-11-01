// v15.1 post-processing chain (no addons): scene → half-float MSAA target with depth; bloom = soft-threshold bright pass,
// two-level separable Gaussian (½ and ¼ res); depth of field = blend toward a ½-res blurred copy by circle of confusion
// from linearised depth around the orbit target. Composite applies the renderer's tone mapping + output colour space.
import * as THREE from 'three';
const VS = 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const BLUR = `uniform sampler2D src; uniform vec2 dir; varying vec2 vUv; void main(){ vec4 s = texture2D(src, vUv) * 0.2270270;
  s += (texture2D(src, vUv + dir * 1.3846153) + texture2D(src, vUv - dir * 1.3846153)) * 0.3162162; s += (texture2D(src, vUv + dir * 3.2307692) + texture2D(src, vUv - dir * 3.2307692)) * 0.0702702; gl_FragColor = s; }`;
const BRIGHT = 'uniform sampler2D src; uniform float thr; varying vec2 vUv; void main(){ vec3 c = texture2D(src, vUv).rgb; float l = dot(c, vec3(0.2126, 0.7152, 0.0722)); gl_FragColor = vec4(c * smoothstep(thr, thr + 0.6, l), 1.0); }';
const COMP = `uniform sampler2D sharp, soft, b1, b2, depth; uniform float bloom, dof, focus, range, near, far; varying vec2 vUv;
  float viewZ(float d){ return (near * far) / ((far - near) * d - far); }
  void main(){ vec3 c = texture2D(sharp, vUv).rgb; if (dof > 0.0) { float z = -viewZ(texture2D(depth, vUv).x); float coc = clamp(abs(z - focus) / range, 0.0, 1.0) * dof; c = mix(c, texture2D(soft, vUv).rgb, coc * coc); }
  c += bloom * (texture2D(b1, vUv).rgb * 0.9 + texture2D(b2, vUv).rgb * 1.1); gl_FragColor = vec4(c, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
  }`;
export class Post {
  constructor(renderer, raw) {
    this.r = renderer; this.raw = raw; this.ok = !!renderer.capabilities.isWebGL2; if (!this.ok) return;
    const opt = { type: THREE.HalfFloatType, depthBuffer: false };
    this.main = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }); this.main.depthTexture = new THREE.DepthTexture(4, 4, THREE.UnsignedIntType);
    this.h1 = new THREE.WebGLRenderTarget(4, 4, opt); this.h2 = new THREE.WebGLRenderTarget(4, 4, opt); this.q1 = new THREE.WebGLRenderTarget(4, 4, opt); this.q2 = new THREE.WebGLRenderTarget(4, 4, opt); this.s1 = new THREE.WebGLRenderTarget(4, 4, opt); this.s2 = new THREE.WebGLRenderTarget(4, 4, opt);
    const m = (fs, u) => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: fs, uniforms: u, depthTest: false, depthWrite: false });
    this.mBlur = m(BLUR, { src: { value: null }, dir: { value: new THREE.Vector2() } }); this.mBright = m(BRIGHT, { src: { value: null }, thr: { value: 0.85 } });
    this.mComp = m(COMP, { sharp: { value: null }, soft: { value: null }, b1: { value: null }, b2: { value: null }, depth: { value: null }, bloom: { value: 0.8 }, dof: { value: 1 }, focus: { value: 30 }, range: { value: 18 }, near: { value: 0.1 }, far: { value: 500 } }); this.mComp.toneMapped = true;
    this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mBlur); this.qs = new THREE.Scene(); this.qs.add(this.quad); this.qc = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  }
  setSize(w, h, pr) { if (!this.ok) return; const W = Math.max(4, Math.round(w * pr)), Hh = Math.max(4, Math.round(h * pr)); this.main.setSize(W, Hh); for (const t of [this.h1, this.h2, this.s1, this.s2]) t.setSize(W >> 1, Hh >> 1); for (const t of [this.q1, this.q2]) t.setSize(W >> 2, Hh >> 2); }
  pass(mat, target) { this.quad.material = mat; this.r.setRenderTarget(target); this.raw(this.qs, this.qc); }
  blur(src, tmp, dst) { const w = src.width, h = src.height; this.mBlur.uniforms.src.value = src.texture; this.mBlur.uniforms.dir.value.set(1 / w, 0); this.pass(this.mBlur, tmp); this.mBlur.uniforms.src.value = tmp.texture; this.mBlur.uniforms.dir.value.set(0, 1 / h); this.pass(this.mBlur, dst); }
  render(scene, cam, o, sceneRender) {
    const r = this.r, prevT = r.getRenderTarget(); r.setRenderTarget(this.main); sceneRender(scene, cam);
    if (o.bloom > 0) { this.mBright.uniforms.src.value = this.main.texture; this.pass(this.mBright, this.h1); this.blur(this.h1, this.h2, this.h1); this.mBlur.uniforms.src.value = this.h1.texture; this.mBlur.uniforms.dir.value.set(0, 0); this.pass(this.mBlur, this.q1); this.blur(this.q1, this.q2, this.q1); }
    if (o.dof > 0) { this.mBlur.uniforms.src.value = this.main.texture; this.mBlur.uniforms.dir.value.set(0, 0); this.pass(this.mBlur, this.s1); this.blur(this.s1, this.s2, this.s1); this.blur(this.s1, this.s2, this.s1); }
    const u = this.mComp.uniforms; u.sharp.value = this.main.texture; u.soft.value = this.s1.texture; u.b1.value = this.h1.texture; u.b2.value = this.q1.texture; u.depth.value = this.main.depthTexture; u.bloom.value = o.bloom; u.dof.value = o.dof; u.focus.value = o.focus; u.range.value = o.range; u.near.value = cam.near; u.far.value = cam.far;
    this.pass(this.mComp, prevT); }
}
