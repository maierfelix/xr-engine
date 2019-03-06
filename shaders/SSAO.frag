#version 300 es

precision mediump float;

uniform sampler2D uDepth;
uniform sampler2D uNormal;

layout (location = 0) out vec4 fragColor;

in vec2 vTextureCoord;

uniform mat4 uViewMatrix;
uniform mat4 uProjectionMatrix;
uniform mat4 uViewProjectionInverseMatrix;

const float radius = 1.0;

float rand(vec2 coord) {
  return fract(sin(dot(coord ,vec2(12.9898,78.233))) * 43758.5453);
}

vec3 getPosition(vec2 uv, float depth) {
  vec4 pos = vec4(uv.x * 2.0 - 1.0, (uv.y * 2.0 - 1.0), depth * 2.0 - 1.0, 1.0);
  pos = uViewProjectionInverseMatrix * pos;
  pos = pos/pos.w;
  return pos.xyz;
}

float doAO(vec2 tcoord,vec2 uv, vec3 p, vec3 n) {
  float depth = texture(uDepth, tcoord + uv).r;
  vec3 diff = getPosition(tcoord + uv, depth) - p;
  vec3 v = normalize(diff);
  float d = length(diff)*0.15;
  float occ = max(0.0,dot(n,v)-0.1)*(1.0/(1.0+d))*2.2;
  return occ;
}

void main() {

  vec2 rr = vec2(rand(vTextureCoord), rand(vTextureCoord + 0.001));

  float depth = texture(uDepth, vTextureCoord).r;

  vec4 nTex = texture(uNormal, vTextureCoord);

  vec3 normalView = normalize(nTex).xyz;

  vec3 p = getPosition(vTextureCoord, depth).xyz;
  vec3 n = normalView;

  vec2 ref[4];
  ref[0] = reflect(vec2(1.0, 0.0), rr);
  ref[1] = reflect(vec2(-1.0, 0.0), rr);
  ref[2] = reflect(vec2(0.0, 1.0), rr);
  ref[3] = reflect(vec2(0.0, -1.0), rr);

  float occlusion = 0.0;

  for (int j = 0; j < 4; ++j) {
    vec2 coord1 = ref[j] * radius;
    vec2 coord2 = vec2(coord1.x*0.707 - coord1.y*0.707, coord1.x*0.707 + coord1.y*0.707);
    occlusion += doAO(vTextureCoord,coord1*(1.0-depth)*0.25, p, n);
    occlusion += doAO(vTextureCoord,coord2*(1.0-depth)*0.5, p, n);
    occlusion += doAO(vTextureCoord,coord1*(1.0-depth)*0.75, p, n);
    occlusion += doAO(vTextureCoord,coord2*(1.0-depth), p, n);
  }

  occlusion /= 16.0;

  fragColor = vec4(vec3(occlusion), 1.0);

}
