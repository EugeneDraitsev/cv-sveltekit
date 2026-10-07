// Galaxy emission / extinction field, evaluated once into the volume atlas.
// Requires common.wgsl.

// Emission (rgb, per unit length) and dust extinction (a) at a galaxy point.
fn volumeAt(p: vec3f) -> vec4f {
  let r: f32 = length(p.xz);
  let edge: f32 = 1.0 - smoothstep(11.0, 14.4, r);
  if (edge < 0.001) {
    return vec4f(0.0);
  }
  let theta: f32 = atan2(p.z, p.x);
  let warp: f32 = sin(theta * 2.0 + r * 0.3) * smoothstep(7.0, 14.0, r) * 0.38;
  let h: f32 = p.y - warp;
  let thickness: f32 = 0.20 + 0.22 * exp(-r * 0.22) + 0.09 * smoothstep(8.0, 14.0, r);
  let vertical: f32 = exp(-h * h / (thickness * thickness));
  let thickDisk: f32 = exp(-abs(h) / 0.75) * exp(-r * 0.24) * edge;
  let coarse: f32 = fbm3(p * vec3f(0.55, 1.3, 0.55) + vec3f(4.1, 7.3, 2.6));
  let fine: f32 = noise3(p * vec3f(3.8, 7.0, 3.8) + vec3f(coarse * 2.0));
  let phase: f32 = 2.0 * (theta - 3.5 * log(1.0 + r / 1.4));
  let disturbed: f32 = phase + (coarse - 0.5) * 1.9;
  let arms: f32 = pow(0.5 + 0.5 * cos(disturbed), 5.0);
  let branches: f32 = pow(0.5 + 0.5 * cos(disturbed + 3.14159 + 0.45 * sin(r)), 9.0) * 0.32;
  let structure: f32 = (arms + branches) * smoothstep(0.7, 2.5, r);
  let clumps: f32 = pow(max(coarse * 2.2 - 0.40, 0.0), 2.3) * (0.35 + fine * 1.2);
  let radial: f32 = exp(-r * 0.16) * edge;
  let lane: f32 = pow(0.5 + 0.5 * cos(disturbed + 0.46), 17.0);
  let filaments: f32 = smoothstep(0.34, 0.70, coarse * 0.65 + fine * 0.35);
  let dustVertical: f32 = exp(-h * h / (thickness * thickness * 0.50));
  let dust: f32 = (lane * 2.4 + structure * filaments * 1.3 + 0.08) * radial * dustVertical * smoothstep(0.65, 2.0, r);
  let young: vec3f = mix(vec3f(0.22, 0.38, 0.82), vec3f(0.56, 0.71, 1.0), fine);
  let old: vec3f = mix(vec3f(0.87, 0.60, 0.34), vec3f(0.43, 0.51, 0.70), smoothstep(1.0, 8.0, r));
  let hot: f32 = smoothstep(0.65, 0.85, fine) * smoothstep(0.48, 0.66, coarse) * structure;
  var light: vec3f = (old * 0.045 + young * structure * clumps * 0.95) * radial * vertical;
  light = light + vec3f(1.0, 0.13, 0.38) * hot * radial * vertical * 0.38;
  light = light + old * thickDisk * 0.012;
  let boundary: f32 = 1.0 - smoothstep(2.25, 2.95, abs(p.y));
  return vec4f(light * boundary, dust * boundary * 2.7);
}
