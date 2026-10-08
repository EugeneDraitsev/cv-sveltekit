// Bloom chain and filmic tone mapping.
// Requires common.wgsl and the `post` uniforms.

fn bloomTap(uv: vec2f) -> vec3f {
  return textureSampleLevel(srcTex, linearSampler, uv, 0.0).rgb;
}

// One downsample-and-blur step; the first level also applies a soft threshold.
fn bloomDown(uv: vec2f) -> vec4f {
  let texel: vec2f = vec2f(1.0) / vec2f(textureDimensions(srcTex));
  var col: vec3f = bloomTap(uv) * 0.20;
  col = col + bloomTap(uv + texel * vec2f(1.4, 1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(-1.4, 1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(1.4, -1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(-1.4, -1.4)) * 0.12;
  col = col + bloomTap(uv + texel * vec2f(3.0, 0.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(-3.0, 0.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(0.0, 3.0)) * 0.08;
  col = col + bloomTap(uv + texel * vec2f(0.0, -3.0)) * 0.08;
  if (f32(textureDimensions(srcTex).x) == post.viewport.x) {
    let bright: f32 = max(col.r, max(col.g, col.b));
    col = col * smoothstep(0.2, 1.0, bright);
  }
  return vec4f(min(col, vec3f(64.0)), 1.0);
}

fn acesFilm(x: vec3f) -> vec3f {
  return clamp((x * (2.51 * x + vec3f(0.03))) / (x * (2.43 * x + vec3f(0.59)) + vec3f(0.14)), vec3f(0.0), vec3f(1.0));
}

fn composite(uv: vec2f, pixel: vec2f) -> vec4f {
  let hdr: vec3f = textureSampleLevel(srcTex, linearSampler, uv, 0.0).rgb;
  let glow: vec3f = textureSampleLevel(bloom0, linearSampler, uv, 0.0).rgb * 0.18
    + textureSampleLevel(bloom1, linearSampler, uv, 0.0).rgb * 0.24
    + textureSampleLevel(bloom2, linearSampler, uv, 0.0).rgb * 0.28
    + textureSampleLevel(bloom3, linearSampler, uv, 0.0).rgb * 0.30;
  var col: vec3f = acesFilm((hdr + glow * post.look.y) * post.look.x);
  let centered: vec2f = uv - vec2f(0.5);
  let vignette: f32 = 1.0 - dot(centered, centered) * post.paper.w;
  col = col * vignette;
  // The deepest black is the dark page colour itself, so the hero has no seam
  // against the page (paper is sRGB, col is linear). Space is dark in both
  // themes; in the light one the page CSS fades the hero into white below.
  let lifted: vec3f = pow(post.paper.rgb, vec3f(2.2));
  col = lifted + col * (vec3f(1.0) - lifted);
  // Light theme: the page stays white, and space is a cloud of ink around the
  // galaxy: its projected disk, a little larger, with a ragged edge that
  // drifts slowly. Flying in, the disk fills the view and so does space.
  let lightMix: f32 = post.look.z;
  if (lightMix > 0.001) {
    let aspect: f32 = post.viewport.x / post.viewport.y;
    let s: vec2f = vec2f((uv.x * 2.0 - 1.0) * aspect, 1.0 - uv.y * 2.0) - post.cloud.xy;
    let c: f32 = cos(post.look.w);
    let sn: f32 = sin(post.look.w);
    let local: vec2f = vec2f(s.x * c + s.y * sn, s.y * c - s.x * sn) / post.cloud.zw;
    let wisp: f32 = fbm3(vec3f(s * 2.2, post.viewport.z * 0.015));
    let d: f32 = length(local) + (wisp - 0.5) * 0.9;
    let cloud: f32 = 1.0 - smoothstep(0.85, 1.6, d);
    // Where the cloud thins out it is pigment, not smoke: deep indigo shading
    // to violet and rose, like watercolour bleeding into the paper.
    let hue: f32 = fbm3(vec3f(s * 1.3 + vec2f(7.1, 3.3), post.viewport.z * 0.01));
    let pigment: vec3f = mix(vec3f(0.035, 0.03, 0.16), vec3f(0.3, 0.06, 0.24), smoothstep(0.35, 0.7, hue));
    let rim: f32 = smoothstep(0.0, 0.8, cloud) * (1.0 - smoothstep(0.6, 1.0, cloud));
    let space: vec3f = mix(col, max(col, pigment), rim * lightMix);
    col = mix(vec3f(1.0), space, mix(1.0, cloud, lightMix));
  }
  var display: vec3f = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  // Triangular dither hides banding in the dark gradients.
  let n: f32 = hash21(pixel + vec2f(fract(post.viewport.z) * 61.0)) + hash21(pixel.yx + vec2f(17.3)) - 1.0;
  display = display + vec3f(n / 255.0);
  return vec4f(display, 1.0);
}
