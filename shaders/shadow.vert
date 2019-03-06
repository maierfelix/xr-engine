#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;

void main(void) {
  mat4 MVPMatrix = uLightProjectionMatrix * uLightViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * vec4(aPosition, 1.0);
  gl_Position = vertexPosition;
}
