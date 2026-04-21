#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
#include frex:shaders/api/world.glsl

out float v_diffuse;
out vec4 v_shadowViewPos;

void frx_pipelineVertex()
{
	if (frx_isGui) {
    // Position of hand and GUI items
		gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
  } else {
    // Position of world objects
		frx_vertex += frx_modelToCamera;
		gl_Position = frx_viewProjectionMatrix * frx_vertex;
  }

  v_shadowViewPos = frx_shadowViewMatrix * frx_vertex;

  // Create fake diffuse value
  float pointing_to_light;
  if (frx_worldHasSkylight == 1 && !frx_isGui) {
    pointing_to_light = dot(frx_vertexNormal, frx_skyLightVector);
  } else {
    pointing_to_light = dot(frx_vertexNormal, vec3(0.0, 1.0, 0.0));
  }
  pointing_to_light = pointing_to_light * 0.5 + 0.5;
  v_diffuse = 0.3 + 0.7 * pointing_to_light;
}
