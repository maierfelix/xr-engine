#version 300 es

precision mediump float;

in vec2 vTexCoord;

uniform sampler2D uAlbedoMap;

layout (location = 0) out vec4 fragColor;

void main(void) {
  vec2 texCoords = vTexCoord;

  vec4 albedo = texture(uAlbedoMap, texCoords);
  if (albedo.a <= 0.0004) discard;

  float d = gl_FragCoord.z;
  fragColor = vec4(d, d, d, 1.0);
}
