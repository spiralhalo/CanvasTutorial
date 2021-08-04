#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

#ifdef VANILLA_LIGHTING
  out vec2 v_light;
  out float v_aoShade;
#endif
out float v_diffuse;
out vec4 v_shadowViewPos;

void frx_writePipelineVertex(in frx_VertexData data)
{
  if (frx_modelOriginType() == MODEL_ORIGIN_SCREEN) {
    // Position of hand and GUI items
    gl_Position = frx_guiViewProjectionMatrix() * data.vertex;
  } else {
    // Position of world objects
    data.vertex += frx_modelToCamera();
    gl_Position = frx_viewProjectionMatrix() * data.vertex;
  }

  v_shadowViewPos = frx_shadowViewMatrix() * data.vertex;

  // Create fake diffuse value
  float pointing_to_light;
  if (frx_worldFlag(FRX_WORLD_HAS_SKYLIGHT) && !frx_isGui()) {
    pointing_to_light = dot(data.normal, frx_skyLightVector());
  } else {
    pointing_to_light = dot(data.normal, vec3(0.0, 1.0, 0.0));
  }
  pointing_to_light = pointing_to_light * 0.5 + 0.5;
  v_diffuse = 0.3 + 0.7 * pointing_to_light;

  #ifdef VANILLA_LIGHTING
    v_light = data.light;
    v_aoShade = data.aoShade;
  #endif
}
