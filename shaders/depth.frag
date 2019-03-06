#version 300 es

precision mediump float;

layout (location = 0) out vec4 fragColor;

void main(void) {
  float d = gl_FragCoord.z;
  fragColor = vec4(d, d, d, 1.0);
}
