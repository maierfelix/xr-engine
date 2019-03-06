#version 300 es

precision mediump float;

uniform float uTime;
uniform sampler2D uTexture;

in vec2 vBlurTexCoords[11];

layout (location = 0) out vec4 fragColor;

void main() {
  vec4 color = vec4(0.0);
  color += texture(uTexture, vBlurTexCoords[0]) * 0.0093;
  color += texture(uTexture, vBlurTexCoords[1]) * 0.028002;
  color += texture(uTexture, vBlurTexCoords[2]) * 0.065984;
  color += texture(uTexture, vBlurTexCoords[3]) * 0.121703;
  color += texture(uTexture, vBlurTexCoords[4]) * 0.175713;
  color += texture(uTexture, vBlurTexCoords[5]) * 0.198596;
  color += texture(uTexture, vBlurTexCoords[6]) * 0.175713;
  color += texture(uTexture, vBlurTexCoords[7]) * 0.121703;
  color += texture(uTexture, vBlurTexCoords[8]) * 0.065984;
  color += texture(uTexture, vBlurTexCoords[9]) * 0.028002;
  color += texture(uTexture, vBlurTexCoords[10]) * 0.0093;
  fragColor = color;
}
