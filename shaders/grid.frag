#version 300 es

precision mediump float;

#define SHADOW_FADE 0.75

in vec3 vWorldPosition;
in vec3 vViewPosition;
in vec3 vSurfaceNormal;
in vec2 vTexCoord;
in vec4 vShadowCoords;

layout (location = 0) out vec4 fragColor;

uniform float uMajor;
uniform float uMinor;
uniform float uWidth;

uniform vec3 uGridColor;
uniform vec3 uGroundColor;

uniform sampler2D uShadowMap;

float CalculateShadow(vec4 pos) {
  vec3 projCoords = pos.xyz / pos.w;
  projCoords = projCoords * 0.5 + 0.5;
  float closestDepth = texture(uShadowMap, projCoords.xy).r;
  float currentDepth = projCoords.z;
  float shadow = 0.0;
  vec2 texelSize = vec2(1.0 / 4096.0);
  for (int x = -1; x <= 1; ++x) {
    for (int y = -1; y <= 1; ++y) {
      vec2 depthCoords = projCoords.xy + vec2(x, y) * texelSize;
      float depth = texture(uShadowMap, depthCoords).r;
      bool shadowed = (
        projCoords.z > depth && depth > 0.0004 &&
        projCoords.x <= 1.0 && projCoords.x >= 0.0 &&
        projCoords.y <= 1.0 && projCoords.y >= 0.0
      );
      if (shadowed) shadow += texture(uShadowMap, depthCoords).a;
      vec3 d = abs(projCoords - 0.5);
      float fade = max(max(d.x, d.y), d.z) * 2.0;
      shadow *= 1.0 - (fade - SHADOW_FADE) / (1.0 - SHADOW_FADE);
    };
  };
  shadow /= 69.0;
  return 1.0 - shadow;
}

void main(void) {

  float wx = vWorldPosition.x;
  float wz = vWorldPosition.z;

  float x0 = abs(fract(wx / uMajor - 0.5) - 0.5) / fwidth(wx) * uMajor / 2.0;
  float z0 = abs(fract(wz / uMajor - 0.5) - 0.5) / fwidth(wz) * uMajor / 2.0;

  float x1 = abs(fract(wx / uMinor - 0.5) - 0.5) / fwidth(wx) * uMinor;
  float z1 = abs(fract(wz / uMinor - 0.5) - 0.5) / fwidth(wz) * uMinor;

  float e0 = 1.0 - clamp(min(x0, z0), 0.0, 1.0);
  float e1 = 1.0 - clamp(min(x1, z1), 0.0, 1.0);

  vec3 c0 = uGridColor / 255.0;
  vec3 c1 = uGroundColor / 255.0;

  vec3 color = c1;
  if (e0 > (1.0 - uWidth)) color = mix(fragColor.rgb, 1.0 - c0, e0 * 0.5);
  else color = mix(fragColor.rgb, (1.0 - c0) * (1.0 / uMajor), e1 * 1.5);

  float shadow = CalculateShadow(vShadowCoords);

  fragColor.rgb = c1;
  fragColor.rgb -= color.rgb;
  fragColor.rgb *= shadow;
  fragColor.a = 1.0;

}
