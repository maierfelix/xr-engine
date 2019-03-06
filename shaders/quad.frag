#version 300 es

precision mediump float;

in vec2 vTextureCoord;

layout (location = 0) out vec4 fragColor;

uniform sampler2D uTexture;

void main(void) {
  vec4 color = texture(uTexture, vTextureCoord);
  fragColor = color;
}
