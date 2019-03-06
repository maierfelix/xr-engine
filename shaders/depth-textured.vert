#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;
layout (location = 4) in vec2 aTexCoord;

out vec2 vTexCoord;

uniform mat4 uShadowMatrix;
uniform mat4 uModelMatrix;

uniform vec2 uTextureScale;

void main(void) {
  vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
  vec4 vertexPosition = uShadowMatrix * worldPosition;
  vec2 texCoords = aTexCoord;
  gl_Position = vertexPosition;
  vTexCoord = texCoords * uTextureScale;
}
