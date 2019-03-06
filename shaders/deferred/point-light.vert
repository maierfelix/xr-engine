#version 300 es

precision highp float;

layout (location = 0) in vec4 aPosition;

uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uProjectionMatrix;

void main(void) {
  mat4 MVPMatrix = uProjectionMatrix * uViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * aPosition;
  gl_Position = vertexPosition;
}
