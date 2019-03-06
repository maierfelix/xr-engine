#version 300 es

precision mediump float;

in mat3 vTBN;
in vec3 vWorldPosition;
in vec3 vViewPosition;
in vec3 vSurfaceNormal;
in vec2 vTexCoord;
in vec4 vShadowCoords;

uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;

uniform vec3 uCameraPosition;

uniform vec3 uLightColor;
uniform vec3 uLightPosition;
uniform float uLightRadius;
uniform float uLightIntensity;

uniform sampler2D uShadowMap;

layout (location = 0) out vec4 fragColor;

void main(void) {

  vec3 surfaceNormal = vSurfaceNormal;
  vec2 texCoords = vTexCoord;

  vec4 albedo = texture(uAlbedoMap, texCoords);
  if (albedo.a <= 0.0004) discard;

  vec3 normal = texture(uNormalMap, texCoords).rgb * 2.0 - 1.0;
  normal = (vTBN * normal);

  vec3 position = vWorldPosition;

  vec3 color = albedo.rgb;

  vec3 N = normalize(normal);
  vec3 V = normalize(uCameraPosition);
  vec3 L = normalize(uLightPosition);
  color = color * max(dot(L, N), 0.0);

  fragColor = vec4((albedo.rgb) + vec3(0.001), albedo.a);
}
