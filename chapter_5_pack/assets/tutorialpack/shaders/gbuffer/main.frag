#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
#include tutorialpack:shaders/lib/glintify.glsl

in float v_diffuse;
in vec4 v_shadowViewPos;

out vec4 fragColor;

// Helper function
vec3 shadowDist(int cascade)
{
  vec4 c = frx_shadowCenter(cascade);
  return abs((c.xyz - v_shadowViewPos.xyz) / c.w);
}

// Function for obtaining the cascade level
int selectShadowCascade()
{
  vec3 d3 = shadowDist(3);
  vec3 d2 = shadowDist(2);
  vec3 d1 = shadowDist(1);

  int cascade = 0;

  if (d3.x < 1.0 && d3.y < 1.0 && d3.z < 1.0) {
    cascade = 3;
  } else if (d2.x < 1.0 && d2.y < 1.0 && d2.z < 1.0) {
    cascade = 2;
  } else if (d1.x < 1.0 && d1.y < 1.0 && d1.z < 1.0) {
    cascade = 1;
  }

  return cascade;
}

void frx_pipelineFragment()
{
  // Base fragment color is the result of texture and vertex color multiplication
  vec4 color = frx_fragColor;
  
  // Store this unshaded color for later use
  vec3 original_color = color.rgb;
  
  // Always wrap vanilla lighting operation within #ifdef VANILLA_LIGHTING directive
  #ifdef VANILLA_LIGHTING

    // Obtain the cascade level
    int cascade = selectShadowCascade();

    // Obtain shadow-space position
    vec4 shadowPos = frx_shadowProjectionMatrix(cascade) * v_shadowViewPos;

    // Transform into texture coordinates
    vec3 shadowTexCoord = shadowPos.xyz * 0.5 + 0.5;

    // Sample the shadow map
    float directSkyLight = texture(frxs_shadowMap, vec4(shadowTexCoord.xy, float(cascade), shadowTexCoord.z));

    // Pad the value to prevent absolute darkness
    directSkyLight = 0.65 + 0.45 * directSkyLight;

    // Clip to 0.96875 because of how light map works
    directSkyLight = min(0.96875, directSkyLight);

    // Replace the sky light
    frx_fragLight.y = directSkyLight;

    // Obtain vanilla light color
    vec3 light_color = texture(frxs_lightmap, frx_fragLight.xy).rgb;

    // Multiply it by ambient occlusion factor
    if (frx_fragEnableAo) {
      light_color *= frx_fragLight.z;
    }

    // Finally, multiply the fragment color by the light color
    color.rgb *= light_color;
  #endif

  // Multiply the color once more with the diffuse shading
  if (frx_fragEnableDiffuse) {
    color.rgb *= v_diffuse;
  }

  // Apply emissive
  color.rgb = mix(color.rgb, original_color, frx_fragEmissive);

  // Apply flash and hurt effect
  if (frx_matFlash == 1) {
    color.rgb = color.rgb * 0.25 + 0.75;
  } else if (frx_matHurt == 1) {
    color.rgb = vec3(0.25, 0.0, 0.0) + color.rgb * 0.75;
  }

  // Apply glint shader
  color.rgb += noise_glint(frx_normalizeMappedUV(frx_texcoord), frx_matGlint);

  // Write color data to the color attachment
  fragColor = color;
  
  // Write position data to the depth attachment
  gl_FragDepth = gl_FragCoord.z;
}
