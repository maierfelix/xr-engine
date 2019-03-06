#version 300 es

precision mediump float;

layout (location = 0) in vec3 aPosition;
layout (location = 1) in vec3 aNormal;
layout (location = 2) in vec3 aTangent;
layout (location = 3) in vec3 aBitangent;
layout (location = 4) in vec2 aTexCoord;

out mat3 vTBN;
out vec3 vWorldPosition;
out vec3 vViewPosition;
out vec3 vSurfaceNormal;
out vec2 vTexCoord;

uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform mat4 uNormalMatrix;
uniform mat4 uProjectionMatrix;

uniform vec2 uTextureScale;

void main(void) {
  mat4 MVPMatrix = uProjectionMatrix * uViewMatrix * uModelMatrix;
  vec4 vertexPosition = MVPMatrix * vec4(aPosition, 1.0);
  vec4 worldPosition = uModelMatrix * vec4(aPosition, 1.0);
  vec4 viewPosition = uViewMatrix * uModelMatrix * vec4(aPosition, 1.0);
  vec4 surfaceNormal = uModelMatrix * vec4(aNormal, 0.0);
  vec2 texCoords = aTexCoord;
  mat3 TBN = mat3(
    vec3(1.0, 0.0, 0.0),
    vec3(0.0, 1.0, 0.0),
    vec3(0.0, 0.0, 1.0)
  );
  // normal map
  {
    vec3 tang = normalize((uNormalMatrix * vec4(aTangent, 0)).xyz);
    vec3 norm = normalize((uNormalMatrix * vec4(aNormal, 0)).xyz);
    vec3 bitang = normalize((uNormalMatrix * vec4(aBitangent, 0)).xyz);
    float handedness = sign(dot(cross(norm, tang), bitang));
    TBN = mat3(tang * handedness, bitang * handedness, norm);
  }
  gl_Position = vertexPosition;
  vTBN = TBN;
  vWorldPosition = worldPosition.xyz;
  vViewPosition = viewPosition.xyz;
  vSurfaceNormal = surfaceNormal.xyz;
  vTexCoord = texCoords * uTextureScale;
}
