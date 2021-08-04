#include tutorialpack:shaders/post/header.glsl

uniform mat4 frxu_frameProjectionMatrix;

in vec4 in_vertex;
in vec2 in_uv;

out vec2 v_texcoord;

void main()
{
  vec4 screen = frxu_frameProjectionMatrix * vec4(in_vertex.xy * frxu_size, 0.0, 1.0);
  gl_Position = vec4(screen.xy, 0.2, 1.0);
  v_texcoord = in_uv;
}
