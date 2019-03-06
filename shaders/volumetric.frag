#version 300 es
precision highp float;
precision highp sampler3D;

#define MAX_STEPS 64

in vec3 vWorldPosition;

uniform mat4 uModelMatrix;
uniform mat4 uModelInverseMatrix;

uniform vec3 uCameraPosition;

uniform sampler2D uRayOrigin;

uniform sampler3D uVolumeBuffer;

layout (location = 0) out vec4 fragColor;

const float volumeScale = 8.0;
const vec3 volumeColor = vec3(240, 113, 120) / 255.0;

vec3 worldToTex(vec3 worldPos) {
  return clamp(((uModelInverseMatrix * vec4(worldPos, 1.0)).xyz) * 0.5 + 0.5, 0.0, 1.0);
}

void main() {
  vec4 color = vec4(0.0);
  float transmittance = 1.0;
  float stepSize = 1.73205081 / float(MAX_STEPS);
  vec3 worldPos = vWorldPosition;
  vec3 worldDir = normalize(uCameraPosition - worldPos) * (volumeScale * 1.0);
  vec3 ray = worldPos;
  vec3 step = worldDir * stepSize;
  for (int ii = 0; ii < MAX_STEPS; ii++) {
    vec3 tex = worldToTex(ray);
    float density = texture(uVolumeBuffer, tex).r;
    float dtm = exp(-1.0 * stepSize * density);
    transmittance *= dtm;
    color.rgb += (1.0 - dtm) * volumeColor * transmittance;
    ray += step;
    if (
      tex.x > 1.0 || tex.x < 0.0 ||
      tex.y > 1.0 || tex.y < 0.0 ||
      tex.z > 1.0 || tex.z < 0.0
    ) break;
    //if (distance(worldPos, vec3(-8.0)) >= 16.0) break;
  };
  color.a = 1.0 - transmittance;
  fragColor = color;
}
