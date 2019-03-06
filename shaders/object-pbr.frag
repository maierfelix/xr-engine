#version 300 es

precision mediump float;

#define EPSILON 0.00000001
#define PI 3.141592653589793
#define INVPI 0.3183098861837907

#define RCP4PI 1.0 / (4.0 * PI)

#define SHADOW_FADE 0.75

in mat3 vTBN;
in vec3 vWorldPosition;
in vec3 vViewPosition;
in vec3 vSurfaceNormal;
in vec2 vTexCoord;
in vec4 vShadowCoords;

uniform sampler2D uAlbedoMap;
uniform sampler2D uNormalMap;
uniform sampler2D uEmissiveMap;
uniform sampler2D uRoughnessMap;
uniform sampler2D uMetallnessMap;
uniform sampler2D uSpecularMap;
uniform sampler2D uAmbientOcclusionMap;
uniform sampler2D uShadowMap;

uniform vec3 uCameraPosition;

uniform vec3 uLightColor;
uniform vec3 uLightPosition;
uniform float uLightRadius;
uniform float uLightIntensity;
uniform float uLightAttenuation;

uniform mat4 uShadowMatrix;

layout (location = 0) out vec4 fragColor;

// Disney's GGX/Trowbridge-Reitz
float DGGX(float NoH, float roughness) {
  float a = roughness * roughness;
  float a2 = a * a;
  float denom = PI * pow(((NoH * NoH) * (a2 - 1.0) + 1.0), 2.0);
  return a2 / denom;
}

float GGX(float NoV, float roughness) {
  float k = (roughness * roughness) / 2.0;
  return NoV / (NoV * (1.0 - k) + k);
}

float GeometrySmith(float NoV, float NoL, float roughness) {
  return GGX(NoL, roughness) * GGX(NoV, roughness);
}

// UE4 gaussian approximation
vec3 FresnelSchlick(float VoH, vec3 F0) {
  return F0 + (1.0 - F0) * exp2((-5.55473 * VoH - 6.98316) * VoH);
}

vec3 SpecularBRDF(vec3 N, vec3 V, vec3 L, vec3 H, float roughness, vec3 F0) {
  float NoL = max(dot(N, L), 0.0) + EPSILON;
  float NoV = max(dot(N, V), 0.0) + EPSILON;
  float NoH = max(dot(N, H), 0.0) + EPSILON;
  float VoH = max(dot(V, H), 0.0) + EPSILON;
  float D = DGGX(NoH, roughness);
  vec3 F = FresnelSchlick(VoH, F0);
  float G = GeometrySmith(NoV, NoL, roughness);
  //return (D * F * G) / (4.0 * NoL * NoV + EPSILON);
  return (D * F * G);
}

float PointAttenuation(float dist, float radius) {
  return pow(clamp(1.0 - pow(dist / radius, 4.0), 0.0, 1.0), 2.0) / (dist * dist + 1.0);
}

// source: internetz
vec3 hash32(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(443.8975,397.2973, 491.1871));
  p3 += dot(p3, p3.yxz + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

// knarkowicz.wordpress.com/2016/01/06/aces-filmic-tone-mapping-curve/
vec3 ACESFilm(vec3 x) {
  float a = 2.51;
  float b = 0.03;
  float c = 2.43;
  float d = 0.59;
  float e = 0.14;
  return clamp((x*(a*x+b))/(x*(c*x+d)+e), 0.0, 1.0);
}

// filmicgames.com/archives/75
vec3 Uncharted2Tonemap(vec3 x) {
  float a = 0.15;
  float b = 0.50;
  float c = 0.10;
  float d = 0.20;
  float e = 0.02;
  float f = 0.30;
  return ((x*(a*x+c*b)+d*e)/(x*(a*x+b)+d*f))-e/f;
}

vec3 DitherRGB(vec3 c, vec2 seed){
  return c + hash32(seed) / 255.0;
}

float CalculateShadow(vec4 pos, float NoL) {
  vec3 projCoords = pos.xyz / pos.w;
  projCoords = projCoords * 0.5 + 0.5;
  float intensity = texture(uShadowMap, projCoords.xy).a;
  float currentDepth = projCoords.z;
  float shadow = 0.0;
  vec2 texelSize = vec2(1.0 / 4096.0);
  float bias = clamp(0.005 * tan(acos(NoL)), 0.0, 0.0005);
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      vec2 depthCoords = projCoords.xy + vec2(x, y) * texelSize;
      float depth = texture(uShadowMap, depthCoords).r;
      bool shadowed = (
        projCoords.z > depth && depth > 0.0004 &&
        projCoords.x <= 1.0 && projCoords.x >= 0.0 &&
        projCoords.y <= 1.0 && projCoords.y >= 0.0
      );
      if (shadowed) shadow += intensity;
      vec3 d = abs(projCoords - 0.5);
      float fade = max(max(d.x, d.y), d.z) * 2.0;
      shadow *= 1.0 - (fade - SHADOW_FADE) / (1.0 - SHADOW_FADE);
    };
  };
  shadow /= 69.0;
  if (projCoords.z > 1.0) shadow = 0.0;
  return 1.0 - shadow;
}

void main(void) {

  vec3 surfaceNormal = vSurfaceNormal;
  vec2 texCoords = vTexCoord;

  vec4 albedo = texture(uAlbedoMap, texCoords);
  if (albedo.a <= 0.0004) discard;
  albedo = pow(albedo, vec4(2.2));

  vec4 emissive = texture(uEmissiveMap, texCoords);

  float roughness = texture(uRoughnessMap, texCoords).r;
  float metallness = texture(uMetallnessMap, texCoords).r;
  float specularity = texture(uSpecularMap, texCoords).r;
  float ambientOcclusion = texture(uAmbientOcclusionMap, texCoords).r;

  vec3 normal = texture(uNormalMap, texCoords).rgb * 2.0 - 1.0;
  normal = (vTBN * normal);

  vec3 position = vWorldPosition;

  roughness = min(max(roughness, EPSILON), 1.0);
  metallness = min(max(metallness, EPSILON), 1.0);
  specularity = min(max(specularity, 0.0), 1.0);
  ambientOcclusion = min(max(ambientOcclusion, 0.0), 1.0);

  vec3 diffuseColor = (albedo.rgb * ambientOcclusion) * (1.0 - metallness);

  vec3 F0 = mix(vec3(0.08), albedo.rgb, metallness);

  vec3 N = normalize(normal);
  vec3 V = normalize(uCameraPosition - position);
  vec3 L = normalize(uLightPosition - position);
  vec3 H = normalize(V + L);

  float NoL = max(dot(N, L), 0.0);

  vec3 BRDF = SpecularBRDF(N, V, L, H, roughness, F0);

  float lumi = uLightIntensity * RCP4PI;

  float distance = length(uLightPosition - position);
  float attenuation = PointAttenuation(distance, uLightRadius);
  attenuation = uLightAttenuation;

  vec3 diffuseContribution = (lumi * NoL * (uLightColor / 255.0)) * attenuation;
  vec3 specularContribution = (lumi * NoL * (BRDF * specularity)) * attenuation;

  diffuseContribution *= diffuseColor;
  specularContribution *= F0;

  vec3 color = diffuseContribution + specularContribution;

  float shadow = CalculateShadow(vShadowCoords, NoL);
  color *= shadow;

  color = Uncharted2Tonemap(color * 4.5);
  color = color * (1.0 / Uncharted2Tonemap(vec3(11.2)));
  color = pow(color, vec3(1.0 / 2.2));

  color = DitherRGB(color, gl_FragCoord.xy);

  fragColor = vec4(color.rgb, 1.0);

}
