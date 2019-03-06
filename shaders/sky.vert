#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;

out vec4 vTexCoord;

uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uProjectionMatrix;

void main(void) {
  mat4 MVPMatrix = uProjectionMatrix * uViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * vec4(aPosition, 1.0);
  gl_Position = vertexPosition;
  vTexCoord = vec4(aPosition, 1.0);
}
