#version 300 es

precision mediump float;

in vec2 vTextureCoord;

layout (location = 0) out vec4 fragColor;

uniform sampler2D uDepth;
uniform sampler2D uNoise;
uniform sampler2D uTexture;

uniform float uTime;

const float zNear = 0.1;
const float zFar = 4096.0;

float linearDepth(float d) {
  float z_n = 2.0 * d - 1.0;
  float z_e = 2.0 * zNear * zFar / (zFar + zNear - z_n * (zFar - zNear));
  return z_e;
}

void main(void) {
  float depth = linearDepth(texture(uDepth, vTextureCoord).r);
  vec4 noise = texture(uNoise, (vTextureCoord * 8.5 * vec2(depth)));
  vec4 color = texture(uTexture, vTextureCoord);
  color.rgb += (noise.rgb) * 0.03;
  fragColor = color;
}
