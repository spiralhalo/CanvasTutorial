#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_source;

in vec2 v_texcoord;

void main()
{
  gl_FragData[0] = texture2D(u_source, v_texcoord);
}
