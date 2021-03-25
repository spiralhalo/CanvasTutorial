#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl

// Cascade level
uniform int frxu_cascade;

void frx_writePipelineVertex(in frx_VertexData data)
{
  // Move to camera origin
  vec4 shadowVertex = data.vertex + frx_modelToCamera();
  gl_Position = frx_shadowViewProjectionMatrix(frxu_cascade) * shadowVertex;
}
