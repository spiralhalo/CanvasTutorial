#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_source;

in vec2 v_texcoord;

out vec4 fragColor;

void main()
{
  fragColor = texture2D(u_source, v_texcoord);
}
