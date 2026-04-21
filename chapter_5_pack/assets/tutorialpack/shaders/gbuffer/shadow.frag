#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

void frx_pipelineFragment()
{
  gl_FragDepth = gl_FragCoord.z;
}
