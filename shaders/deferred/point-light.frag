#version 300 es

precision mediump float;

#define EPSILON 0.00000001
#define PI 3.1415926535897932384626433832795
#define MOD3 vec3(443.8975,397.2973, 491.1871)

const float RCP_4PI = 1.0 / ( 4.0 * PI );

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
  float NoL = max(dot(N, L), 0.0);
  float NoV = max(dot(N, V), 0.0);
  float NoH = max(dot(N, H), 0.0);
  float VoH = max(dot(V, H), 0.0);
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
  vec3 p3 = fract(vec3(p.xyx) * MOD3);
  p3 += dot(p3, p3.yxz + 19.19);
  return fract(vec3((p3.x + p3.y) * p3.z, (p3.x + p3.z) * p3.y, (p3.y + p3.z) * p3.x));
}

vec3 ditherRGB(vec3 c, vec2 seed){
  return c + hash32(seed) / 255.0;
}

/*float rand(vec2 co) {
  return fract(sin(dot(co.xy ,vec2(12.9898,78.233))) * 43758.5453 + uTime);
}*/

vec3 diffuseContribution = vec3(0.0);
vec3 specularContribution = vec3(0.0);

uniform vec3 uLightColor;
uniform vec3 uLightPosition;
uniform float uLightRadius;
uniform float uLightIntensity;

uniform vec3 uCameraPosition;

uniform sampler2D uGPosition;
uniform sampler2D uGNormal;
uniform sampler2D uGAlbedo;
uniform sampler2D uGEmissive;
uniform sampler2D uGRSMA;
uniform sampler2D uSSAO;

layout (location = 0) out vec4 fragColor;
layout (location = 1) out vec4 specularColor;

void main(void) {

  ivec2 fragCoord = ivec2(gl_FragCoord.xy);

  vec3 position = texelFetch(uGPosition, fragCoord, 0).xyz;

  vec3 normal = texelFetch(uGNormal, fragCoord, 0).xyz;
  vec3 albedo = texelFetch(uGAlbedo, fragCoord, 0).xyz;
  vec3 emissive = texelFetch(uGEmissive, fragCoord, 0).xyz;
  vec4 rsma = texelFetch(uGRSMA, fragCoord, 0).xyzw;
  vec4 ssao = texelFetch(uSSAO, fragCoord, 0).xyzw;

  float roughness = min(max(rsma.x, EPSILON), 1.0);
  float specularity = min(max(rsma.y, 0.0), 1.0);
  float metallness = min(max(rsma.z, EPSILON), 1.0);
  float ambientOcclusion = min(max(rsma.w, 0.0), 1.0);

  albedo.xyz = vec3(
    pow(albedo.x, 2.2),
    pow(albedo.y, 2.2),
    pow(albedo.z, 2.2)
  );

  vec3 diffuseColor = (albedo * ambientOcclusion) * (1.0 - metallness);

  vec3 F0 = mix(vec3(0.08), albedo, metallness);

  vec3 N = normalize(normal);
  vec3 V = normalize(uCameraPosition - position);
  vec3 L = normalize(uLightPosition - position);
  vec3 H = normalize(V + L);

  float NoL = max(dot(N, L), 0.0);

  vec3 BRDF = SpecularBRDF(N, V, L, H, roughness, F0);

  float lumi = uLightIntensity * RCP_4PI;

  float distance = length(uLightPosition - position);
  float attenuation = PointAttenuation(distance, uLightRadius);

  diffuseContribution = (lumi * NoL * uLightColor) * attenuation;
  specularContribution = (lumi * NoL * (BRDF * specularity)) * attenuation;

  diffuseContribution *= diffuseColor;
  specularContribution *= F0;

  vec3 color = diffuseContribution + specularContribution;

  color = color / (color + vec3(1.0));
  color = pow(color, vec3(1.0 / 2.2));
  color = ditherRGB(color, gl_FragCoord.xy);

  fragColor = vec4(color, 1.0);
  specularColor = vec4(specularContribution, 1.0);
}
