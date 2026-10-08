// Bloom chain, filmic tone mapping and the light-theme "ink on paper" grade.
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
  // Light theme: the same image printed as coloured ink on the page.
  let lightMix: f32 = post.look.z;
  if (lightMix > 0.001) {
    let l: f32 = max(col.r, max(col.g, col.b));
    let hue: vec3f = col / max(l, 0.0001);
    // Two inks: a cool one for arms, dust and stars, a warm sepia that takes
    // over in the bright core so it prints as a glow rather than a blot.
    let cool: vec3f = mix(post.ink.rgb, hue * 0.22 + post.ink.rgb * 0.5, 0.65);
    let warm: vec3f = vec3f(0.66, 0.36, 0.16);
    let ink: vec3f = mix(cool, warm, smoothstep(0.5, 0.97, l) * 0.9);
    let density: f32 = pow(smoothstep(0.0, 0.9, l), 0.75) * (1.0 - smoothstep(0.75, 1.0, l) * 0.3);
    let printed: vec3f = mix(post.paper.rgb, ink, density);
    col = mix(col, printed, lightMix);
  }
  let centered: vec2f = uv - vec2f(0.5);
  let vignette: f32 = 1.0 - dot(centered, centered) * post.paper.w * (1.0 - lightMix);
  col = col * vignette;
  // Dark theme: the deepest black is the page colour itself, so the hero has
  // no seam against the page around it (paper is sRGB, col is linear).
  let lifted: vec3f = pow(post.paper.rgb, vec3f(2.2)) * post.ink.w * (1.0 - lightMix);
  col = lifted + col * (vec3f(1.0) - lifted);
  var display: vec3f = pow(max(col, vec3f(0.0)), vec3f(1.0 / 2.2));
  // Triangular dither hides banding in the dark gradients.
  let n: f32 = hash21(pixel + vec2f(fract(post.viewport.z) * 61.0)) + hash21(pixel.yx + vec2f(17.3)) - 1.0;
  display = display + vec3f(n / 255.0);
  return vec4f(display, 1.0);
}
