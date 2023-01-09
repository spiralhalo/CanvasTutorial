# 3: Shading: Using vanilla lighting

## Applying vanilla lighting and ambient occlusion

If you've followed this tutorial so far, you should have a working pipeline that renders unshaded minecraft world. Now let's add some lighting to make it more playable.

All shading process will happen in our pipeline fragment shader. For optimization we can move this process into a deferred shading pass later, but for now we will do it in the G-buffer pass for simplicity. Another advantage for doing it in the G-buffer pass is that the shading will be applied to all objects including objects behind translucent layers.

To apply the lighting, we will add a lighting operation block inside the write pipeline fragment function in our fragment shader. We will add it right after color calculation as shown here:

```glsl
// main.frag
// ...

// This is the function that we've created earlier
void frx_pipelineFragment() {
  vec4 color = frx_fragColor;
  
  // LIGHTING OPERATION CODE GOES HERE
```

First we start the lighting operation by sampling the light map using the light coordinates input:

```glsl
  // Obtain vanilla light color from the light map
  vec3 lightmap = texture(frxs_lightmap, frx_fragLight.xy).rgb;
```
> If you're new to GLSL, or if you're coming from an old version like GLSL 120, we use the `texture` built-in function to access GPU memory to read a specific image. This is usually the most espensive part of the shading process, but because the Minecraft lightmap texture is so small, it's very cheap; performance cost scales with resolution.

Next we will multiply the light color with the ambient occlusion factor. We only do it for objects with ambient occlusion enabled:

```glsl
  if(frx_fragEnableAo) {
    lightmap *= frx_fragLight.z;
  }
```

Finally we multiply the fragment color with the light color to apply the lighting data:
```glsl
  color.rgb *= lightmap;
```

Once we finish that last multiplication, our lighting operation will look like this:
```glsl
  // Obtain vanilla light color from the light map
  vec3 lightmap = texture(frxs_lightmap, frx_fragLight.xy).rgb;

  // Multiply it by ambient occlusion factor
  if(frx_fragEnableAo) {
    lightmap *= frx_fragLight.z;
  }

  // Finally, multiply the fragment color by the light color
  color.rgb *= lightmap;
```

This code can be optimized slightly, but for the sake of the tutorial, its goal is to be more readable.

Once you have the lighting code in your fragment shader, you can test your pipeline to see if everything is rendering as expected.

> **Pro-tip:** Press `=` to quickly recompile your pipeline! You can also set a different Canvas reload shortcut key in Controls. I prefer setting it to `r`.

## Non-flat lighting trick: Fake diffuse

Now that we've applied the lighting data, you may notice that the lighting still looks somewhat flat. That is because minecraft light data doesn't contain directional value, so every faces of an object are lit uniformly. The solution to this is simply to fake the directional lighting by lighting the sides of objects less than the top.

To do this, we need the normal vector of the object. A normal vector is simply a vector that points at the direction a particular face is facing. For example, a cube has 6 faces that points upwards, northwards, eastwards, and so on. Using this information, we will be able to darken a particular face that points to a particular direction.

We can do our fake diffuse calculation in the **fragment shader**, right before we multiply the color by the lightmap.

Since we want our objects to be brighter on top, we start by calculating how much the normal vector is pointing up. This can be done with a dot product:

```glsl
// main.frag
// ...
void frx_pipelineFragment() {
  // ...
  float diffuseFactor = dot(frx_vertexNormal, vec3(0.0, 1.0, 0.0));
  // ...
```

You can learn more about dot products (and vectors) in the field of Linear Algebra. It's very useful for all things shaders and rendering.

Note that the result of a unit-vector dot product is in the range of [-1, 1]. We don't want negative lighting value, so we will bring our value up into the [0, 1] range:

```glsl
  diffuseFactor = diffuseFactor * 0.5 + 0.5;
```

Finally, we want to prevent absolute darkness, let's pad this value by 0.3. The calculation will look like this:

```glsl
  diffuseFactor = 0.3 + 0.7 * diffuseFactor;
```

Finally, we want to apply our fake diffuse value to the lightmap before we apply lighting to the color. We only do this with objects that are marked as diffuse-enabled:

```glsl
  // ... lighting calculation goes here ...

  // Apply diffuse shading only if the material specifies it
  if (frx_fragEnableDiffuse) {
    lightmap *= diffuseFactor;
  }

  // ... multiply color by lightmap goes here ...
```

Now test your shader once again to see if the fake diffuse is applied properly.

## Emissivity

The last step into completing the quasi-vanilla lighting is to apply emissivity. Emissive objects emit light, therefore all the previous lighting and diffuse multiplication shouldn't apply to them. There are various ways to do this, but the simplest way it so simply mix our final color with the original color before any lighting is applied.

We do this by interpolating the lightmap before we apply lighting, based on emission:

```glsl
  // ... applying diffuse goes here ...

  // Emissive objects are at full brightness
  lightmap = mix(lightmap, vec3(1.0), frx_fragEmissive);

  // ... multiply color by lightmap goes here ...
```

Once we completed everything in this chapter, our final shader program should look like this:

`main.vert`:
```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl

void frx_pipelineVertex() {
  if (frx_modelOriginScreen) {
    // Position of hand and GUI items
    gl_Position = frx_guiViewProjectionMatrix * frx_vertex;
  } else {
    // Position of world objects
    frx_vertex += frx_modelToCamera;
    gl_Position = frx_viewProjectionMatrix * frx_vertex;
  }
}
```

`main.frag`:
```glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

// In the case of multiple color attachments, you use different layout qualifiers.
layout(location = 0) out vec4 fragColor;

void frx_pipelineFragment() {
  // Variables prefixed with frx_ are parts of the API. 
  // In this case, since we included frex:shaders/api/fragment.glsl, 
  // we get access to most of the information we would want in the G-Buffer program.
  //
  // frx_fragColor refers to the Minecraft texture color, 
  // already multiplied with the vertex color so we can use it just like this.
  vec4 color = frx_fragColor;

  // Obtain vanilla light color from the light map
  vec3 lightmap = texture(frxs_lightmap, frx_fragLight.xy).rgb;

  // Multiply it by ambient occlusion factor
  if(frx_fragEnableAo) {
    lightmap *= frx_fragLight.z;
  }

  // Find out how much this surface is facing up
  float diffuseFactor = dot(frx_vertexNormal, vec3(0.0, 1.0, 0.0));

  // Normalize the diffuse factor and add a padding of 0.3
  diffuseFactor = diffuseFactor * 0.5 + 0.5;
  diffuseFactor = 0.3 + 0.7 * diffuseFactor;

  // Apply diffuse shading only if the material specifies it
  if (frx_fragEnableDiffuse) {
    lightmap *= diffuseFactor;
  }

  // Emissive objects are at full brightness
  lightmap = mix(lightmap, vec3(1.0), frx_fragEmissive);

  // Finally, multiply the fragment color by the light color
  color.rgb *= lightmap;

  // Write color data to the color attachment
  fragColor = color;
  
  // Write position data to the depth attachment
  gl_FragDepth = gl_FragCoord.z;
}
```

If no errors popped up, you should see a Minecraft world that looks mostly like Vanilla! Otherwise, you may want to retrace your steps and find out if you went wrong somewhere.