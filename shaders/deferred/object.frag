#version 300 es

precision mediump float;

in mat3 vTBN;
in vec3 vWorldPosition;
in vec3 vViewPosition;
in vec3 vSurfaceNormal;
in vec2 vTexCoord;

uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;
uniform sampler2D uEmissiveMap;
uniform sampler2D uRoughnessMap;
uniform sampler2D uMetallnessMap;
uniform sampler2D uSpecularMap;
uniform sampler2D uAmbientOcclusionMap;

layout (location = 0) out vec3 gPosition;
layout (location = 1) out vec3 gNormal;
layout (location = 2) out vec3 gAlbedo;
layout (location = 3) out vec3 gEmissive;
layout (location = 4) out vec4 gRSMA;

void main(void) {

  vec3 surfaceNormal = vSurfaceNormal;
  vec2 texCoords = vTexCoord;

  vec4 albedo = texture(uAlbedoMap, texCoords);
  if (albedo.a <= 0.0004) discard;

  albedo = pow(albedo, vec4(2.2));

  vec4 emissive = texture(uEmissiveMap, texCoords);

  float ao = texture(uAmbientOcclusionMap, texCoords).r;
  float roughness = texture(uRoughnessMap, texCoords).r;
  float metallness = texture(uMetallnessMap, texCoords).r;
  float specular = texture(uSpecularMap, texCoords).r;

  vec3 normal = texture(uNormalMap, texCoords).rgb * 2.0 - 1.0;
  surfaceNormal = (vTBN * normal);

  gPosition = vWorldPosition;
  gNormal = surfaceNormal;
  gAlbedo = albedo.rgb;
  gEmissive = emissive.rgb;
  gRSMA = vec4(
    roughness,
    specular,
    metallness,
    ao
  );

}
