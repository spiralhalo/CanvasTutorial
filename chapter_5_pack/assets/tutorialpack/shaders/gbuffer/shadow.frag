#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

frx_FragmentData frx_createPipelineFragment()
{
  return frx_FragmentData (
    texture2D(frxs_baseColor, frx_texcoord, frx_matUnmippedFactor() * -4.0),
    frx_color
  );
}

void frx_writePipelineFragment(in frx_FragmentData fragData)
{
  gl_FragDepth = gl_FragCoord.z;
}
