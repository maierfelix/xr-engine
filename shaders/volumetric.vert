#version 300 es

precision highp float;

layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec3 aTangent;
layout (location = 3) in vec3 aBitangent;
layout (location = 4) in vec2 aTexCoord;

out vec3 vWorldPosition;

uniform vec3 uCameraPosition;

uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uModelInverseMatrix;
uniform mat4 uProjectionMatrix;

void main(void) {
  vec4 vertex = vec4(aPosition, 1.0);
  mat4 MVPMatrix = uProjectionMatrix * uViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * vertex;
  vec4 worldPosition = uModelMatrix * vertex;
  vec4 viewPosition = uViewMatrix * uModelMatrix * vertex;
  vec4 surfaceNormal = uModelMatrix * vec4(aNormal, 0.0);
  vec2 texCoords = aTexCoord;
  gl_Position = vertexPosition;
  vWorldPosition = worldPosition.xyz;
}
