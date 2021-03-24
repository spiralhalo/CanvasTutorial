# 3: Shading: Using vanilla lighting

## Applying vanilla lighting and ambient occlusion

If you've followed this tutorial so far, you should have a working pipeline that renders unshaded minecraft world. Now let's add some lighting to make it more playable.

All shading process will happen in our pipeline fragment shader. For optimization we can move this process into a deferred shading pass later, but for now we will do it in the G-buffer pass for simplicity. Another advantage for doing it in the G-buffer pass is that the shading will be applied to all objects including objects behind translucent layer.

To apply the lighting, we first need to convert the vanilla lighting data into light color by sampling the vanilla lightmap texture. We will do it right after color calculation in our fragment shader:

```glsl
// main.frag
// ...

void frx_writePipelineFragment(in frx_FragmentData fragData)
{
  // Obtain true color by multiplying sprite color (usually texture) and vertex color (usually biome color)
  vec4 color = fragData.spriteColor * fragData.vertexColor;
  
  // Always wrap vanilla lighting operation within #ifdef VANILLA_LIGHTING directive
  #ifdef VANILLA_LIGHTING

    // Obtain vanilla light color
    vec3 light_color = texture2D(frxs_lightmap, fragData.light).rgb;

    // ...
```

Next we will multiply the light color with the ambient occlusion factor. We only do it for objects with ambient occlusion enabled:

```glsl
    if (fragData.ao) {
      light_color *= fragData.aoShade;
    }
```

Finally we multiply the fragment color with the light color to apply the lighting data:
```glsl
    color.rgb *= light_color;
```

Once we close the `#ifdef` directive, our whole lighting operation will look like this:
```glsl
  // Always wrap vanilla lighting operation within #ifdef VANILLA_LIGHTING directive
  #ifdef VANILLA_LIGHTING

    // Obtain vanilla light color
    vec3 light_color = texture2D(frxs_lightmap, fragData.light).rgb;

    // Multiply it by ambient occlusion factor
    if (fragData.ao) {
      light_color *= fragData.aoShade;
    }

    // Finally, multiply the fragment color by the light color
    color.rgb *= light_color;
  #endif
```

You can test your pipeline to see if everything is rendering as expected.

> **Pro-tip:** Press `F3+A` to trigger chunk reload which will also recompile your pipeline! You can also set Canvas reload shortcut key in Controls option.

## Non-flat lighting trick: Fake diffuse

Now that we've applied the lighting data, you may notice that the lighting still looks somewhat flat. That is because minecraft light data doesn't contain directional value, so every faces of an object are lit uniformly. The solution to this is simply to fake the directional lighting by lighting the sides of objects less than the top.

To do this, we need the normal vector of the object. A normal vector is simply a vector that points at the direction a particular face is facing. For example, a cube has 6 faces that points upwards, northwards, eastwards, and so on. Using this information, we will be able to darken a particular face that points to a particular direction.

The normal vector is stored in the vertex. We can transport this information to the fragment, but for now it's much cheaper to simply transport the fake diffuse value. Hence we will do our fake diffuse calculation in the **vertex shader**.

Since we want our objects to be brighter on top, we start by calculating how much the normal vector is pointing up. This can be done with a dot product:

```glsl
// main.vert
// ...
void frx_writePipelineVertex(in frx_VertexData data)
{
  // ...
  float pointing_up = dot(data.normal, vec3(0.0, 1.0, 0.0));
  // ...
```

You can learn more about dot products (and vectors) in the field of Linear Algebra. It's very useful for all things shaders and rendering.

Note that the result of a unit-vector dot product is in the range of [-1, 1]. We don't want negative lighting value, so we will bring our value up into the [0, 1] range:

```glsl
  pointing_up = pointing_up * 0.5 + 0.5;
```

Finally, we write this value into a diffuse output. To prevent absolute darkness, let's pad this value by 0.3. The calculation will look like this:

```glsl
  v_diffuse = 0.3 + 0.7 * pointing_up;
```

Don't forget to define the new input/output at the beginning of both the vertex and fragment shader:
```glsl
// Vertex shader
out float v_diffuse; // Our new diffuse vertex output

// Fragment shader
in float v_diffuse; // Our new diffuse fragment input
```

Finally, in the **fragment shader**, apply our fake diffuse value to the fragment color. We only do this with objects that are marked as diffuse-enabled:

```glsl
  // ... lighting calculation goes here ...

  if (fragData.diffuse) {
    color.rgb *= v_diffuse;
  }

  // ... writing to the g-buffer goes here ...
```

Now test your shader once again to see if the fake diffuse is applied properly.

## Emissivity

The last step into completing the quasi-vanilla lighting is to apply emissivity. Emissive objects emit light, therefore all the previous lighting and diffuse multiplication shouldn't apply to them. There are various ways to do this, but the simplest way it so simply mix our final color with the original color before any lighting is applied.

First, in the fragment shader, we store the original color in a new variable:

```glsl
void frx_writePipelineFragment(in frx_FragmentData fragData)
{
  // Obtain true color by multiplying sprite color (usually texture) and vertex color (usually biome color)
  vec4 color = fragData.spriteColor * fragData.vertexColor;

  // Store this unshaded color for later use
  vec3 original_color = color.rgb;

  // ...
```

And then, just before writing the color into the G-buffer, we will interpolate the original color based on the emissivity value of this fragment:

```glsl
  // ... applying diffuse goes here ...

  color.rgb = mix(color.rgb, original_color, fragData.emissivity);

  // ... writing to the g-buffer goes here ...
```

Once we completed everything in this chapter, our final shader should look like this:

`main.vert`:
```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl

#ifdef VANILLA_LIGHTING
  out vec2 v_light;
  out float v_aoShade;
#endif
out float v_diffuse;

void frx_writePipelineVertex(in frx_VertexData data)
{
  if (frx_modelOriginType() == MODEL_ORIGIN_SCREEN) {
    // Position of hand and GUI items
    gl_Position = gl_ModelViewProjectionMatrix * data.vertex;
  } else {
    // Position of world objects
    data.vertex += frx_modelToCamera();
    gl_Position = frx_viewProjectionMatrix() * data.vertex;
  }

  float pointing_up = dot(data.normal, vec3(0.0, 1.0, 0.0));
  pointing_up = pointing_up * 0.5 + 0.5;
  v_diffuse = 0.3 + 0.7 * pointing_up;

  #ifdef VANILLA_LIGHTING
    v_light = data.light;
    v_aoShade = data.aoShade;
  #endif
}
```

`main.frag`:
```glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

#ifdef VANILLA_LIGHTING
  in vec2 v_light;
  in float v_aoShade;
#endif
in float v_diffuse;

// Fragment setup - Most of the time you don't need to modify these
frx_FragmentData frx_createPipelineFragment()
{
#ifdef VANILLA_LIGHTING
  return frx_FragmentData (
    texture2D(frxs_baseColor, frx_texcoord, frx_matUnmippedFactor() * -4.0),
    frx_color,
    frx_matEmissive() ? 1.0 : 0.0,
    !frx_matDisableDiffuse(),
    !frx_matDisableAo(),
    frx_normal,
    v_light,
    v_aoShade
  );
#else
  return frx_FragmentData (
    texture2D(frxs_baseColor, frx_texcoord, frx_matUnmippedFactor() * -4.0),
    frx_color,
    frx_matEmissive() ? 1.0 : 0.0,
    !frx_matDisableDiffuse(),
    !frx_matDisableAo(),
    frx_normal
  );
#endif
}
// End of fragment setup

void frx_writePipelineFragment(in frx_FragmentData fragData)
{
  // Obtain true color by multiplying sprite color (usually texture) and vertex color (usually biome color)
  vec4 color = fragData.spriteColor * fragData.vertexColor;
    
  // Store this unshaded color for later use
  vec3 original_color = color.rgb;
  
  // Always wrap vanilla lighting operation within #ifdef VANILLA_LIGHTING directive
  #ifdef VANILLA_LIGHTING

    // Obtain vanilla light color
    vec3 light_color = texture2D(frxs_lightmap, fragData.light).rgb;

    // Multiply it by ambient occlusion factor
    if (fragData.ao) {
      light_color *= fragData.aoShade;
    }

    // Finally, multiply the fragment color by the light color
    color.rgb *= light_color;
  #endif

  // Multiply the color once more with the diffuse shading
  if (fragData.diffuse) {
    color.rgb *= v_diffuse;
  }

  // Apply emissivity
  color.rgb = mix(color.rgb, original_color, fragData.emissivity);

  // Write color data to the color attachment
  gl_FragData[0] = color;
  
  // Write position data to the depth attachment
  gl_FragDepth = gl_FragCoord.z;
}
```
