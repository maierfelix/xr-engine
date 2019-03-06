#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;

out vec3 vWorldPosition;
out vec3 vViewPosition;
out vec3 vSurfaceNormal;
out vec4 vShadowCoords;

uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uProjectionMatrix;

uniform mat4 uShadowMatrix;

void main(void) {
  mat4 MVPMatrix = uProjectionMatrix * uViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * vec4(aPosition, 1.0);
  vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
  vec4 viewPosition = uViewMatrix * worldPosition;
  vec4 surfaceNormal = uModelMatrix * vec4(aNormal, 0.0);
  gl_Position = vertexPosition;
  vWorldPosition = worldPosition.xyz;
  vViewPosition = viewPosition.xyz;
  vSurfaceNormal = surfaceNormal.xyz;
  vShadowCoords = uShadowMatrix * worldPosition;
}
