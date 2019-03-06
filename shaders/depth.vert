#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;

uniform mat4 uShadowMatrix;
uniform mat4 uModelMatrix;

void main(void) {
  vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
  vec4 vertexPosition = uShadowMatrix * worldPosition;
  gl_Position = vertexPosition;
}
