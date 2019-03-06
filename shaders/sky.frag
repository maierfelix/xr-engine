#version 300 es

precision highp float;

in vec4 vTexCoord;

layout (location = 0) out vec4 fragColor;

uniform vec3 uColorTop;
uniform vec3 uColorBottom;
uniform float uIntensity;

// source: internetz
vec3 hash32(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975,397.2973, 491.1871));
  p3 += dot(p3, p3.yxz + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec3 ditherRGB(vec3 c, vec2 seed){
  return c + hash32(seed) / 255.0;
}

void main(void) {
  vec3 color = mix(uColorTop / 255.0, uColorBottom / 255.0, (1.0 - vTexCoord.y) * uIntensity) * (1.0 - uIntensity);
  color = ditherRGB(color, gl_FragCoord.xy);
  fragColor = vec4(color, 1.0);
}
