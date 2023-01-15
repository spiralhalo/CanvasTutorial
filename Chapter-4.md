# 4: Adding sky shadows

Now that we got the vanilla features down pat, finally it's time to go outside the boundaries and add some non-vanilla feature! I bet you're shaking and sweating with excitement. Don't worry, I know that feeling.

## Setting up the sky shadow configuration

When setting up your sky shadow, there are a few important things to configure:

* The resolution of the shadow map.
* How many blocks "radius" to render the first, second, and third shadow cascades.

The resolution, of course, determines how sharp the shadow would be, but the cascade radiuses are as important. Each cascade radius determines how "zoomed in" the cascade is. To demonstrate, we will use the following configuration:

* Resolution: 1024
* Radius of cascades 1, 2, 3 respectively: 32, 16, 8

This means, for the first cascade it will render blocks in 32-blocks distance into the shadow map. For the second cascade it will render only 16-blocks distance while still using the entire 1024 x 1024 pixel resolution.

You can see how the second cascade will be more "zoomed in" and thus producing sharper shadow. The further an object is, the smaller resolution cascade will be used to render its shadow. That's how cascading shadow map works. It ensures nearby object has sharp shadow without requiring very high resolution shadow map.

Now let's create our sky shadow configuration file. Create a file called `skyshadow.json` in the `pipeline_files` folder. The file contents look like this:

```json5
{
  // Don't change this name
  skyShadows: {
    framebuffer: "shadow",
    allowEntities: true,
    allowParticles: true,
    supportForwardRender: true,
    vertexSource: "tutorialpack:shaders/gbuffer/shadow.vert",
    fragmentSource: "tutorialpack:shaders/gbuffer/shadow.frag",
    // first parameter to glPolygonOffset - variable slope factor
    offsetSlopeFactor: 1.1,
    // second parameter to glPolygonOffset - constant offset bias
    offsetBiasUnits: 4.0,
    // In-world radii of next-to-lowest to highest detail cascades.
    cascadeRadius: [32, 16, 8]
  },

  images: [
    // depth attachment for shadow map
    {
      name: "shadow_map",
      size: 1024,
      internalFormat: "DEPTH_COMPONENT32",
      pixelFormat: "DEPTH_COMPONENT",
      pixelDataType: "FLOAT",
      target: "TEXTURE_2D_ARRAY",
      depth: 4,
      texParams: [
        {name: "TEXTURE_MIN_FILTER", val: "LINEAR"},
        {name: "TEXTURE_MAG_FILTER", val: "LINEAR"},
        {name: "TEXTURE_WRAP_S", val: "CLAMP_TO_EDGE"},
        {name: "TEXTURE_WRAP_T", val: "CLAMP_TO_EDGE"},
        {name: "TEXTURE_COMPARE_MODE", val: "COMPARE_REF_TO_TEXTURE"},
        {name: "TEXTURE_COMPARE_FUNC", val: "LEQUAL"}
      ]
    }
  ],

  framebuffers: [
    {
      name: "shadow",
      depthAttachment: {image: "shadow_map", clearDepth: 1.0}
    }
  ]
}
```

Can you see where in the file did the previously discussed configuration go?

You may also notice that we've created another **framebuffer** called **shadow**. The shadow map rendering happens in a separate pass before world rendering, called the **shadow pass** for convenience. Since it renders separately, we need a separate framebuffer to write the shadow map into as well.

> **Quick reminder:** Recall that a framebuffer can only have one depth attachment. The shadow map is a depth image. We need a separate framebuffer for the shadow pass either way.

Next we will reference our sky shadow configuration in our pipeline file (remember, it's the `tutorial_pipeline.json` file in the `pipelines` folder.) To do this we will add the following item inside the `include` array object:

```json5
"tutorialpack:pipeline_files/skyshadow.json"
```

So our `include` array would look like this:


```json5
// ...
  include: [
    "tutorialpack:pipeline_files/main.json",
    "tutorialpack:pipeline_files/skyshadow.json"
  ]
// ...
```

> **Quick tip:** The `include` array simply imports the content of other pipeline json file and merge them together. It can be used in any pipeline configuration file.

## Making the shadow pass shader program

The shader code for the shadow pass is straightforward. We simply transform the vertexes in the vertex shader and write the depth value in the fragment shader. The difference is instead of using the camera's transformation we use the shadow transformations so that we see the world from the point of view of the sun.

The shader files will be named `shadow.vert` and `shadow.frag`. We will put them in our `gbuffer` folder. The contents of these files are as follows:

`shadow.vert`:
```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl

// Cascade level that is currently rendering, 0-3
uniform int frxu_cascade;

void frx_pipelineVertex() {
  // Move to camera origin
  vec4 shadowVertex = frx_vertex + frx_modelToCamera;
  gl_Position = frx_shadowViewProjectionMatrix(frxu_cascade) * shadowVertex;
}
```

`shadow.frag`:
```glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl

void frx_pipelineFragment() {
  // Shadow pass only cares about depth
  gl_FragDepth = gl_FragCoord.z;
}
```

## Applying the shadows

### Sampling the shadowmap

Now that we've set up the sky shadow configuration, a shadow map will be generated at the beginning of each frame. There are two ways to sample the shadow map in the G-buffer pass:

* `frxs_shadowMap` to sample the shadow map using GPU hardware accelerated interpolation, so you get smooth shadows for low performance cost
* `frxs_shadowMapTexture` to sample the shadow map directly. For advanced use.

To sample the shadow map we need the coordinates of an object in the **shadow-space**. This is where the shadow transformations will come in handy.

First, we will create an input/ouput both in our vertex and fragment shaders (Remember, these are the `main.vert` and `main.frag` files):

```glsl
// Vertex shader
out vec4 shadowViewPos;

// Fragment shader
in vec4 shadowViewPos;
```
> **Note**: This is how you exchange data between the vertex and fragment shader - they are called in/out variables or "varying" variables. The names should correspond between both shaders, and the use of in/out should reflect the nature of the variable - if it is set in the vertex shader and read in the fragment shader, the vertex shader will use the `out` qualifier while the fragment shader will use the `in` qualifier.

Next, just after the camera transformations in the **vertex shader**, we will calculate the shadow view-space coordinate and write it into the new output:

```glsl
  // ... camera trasnformation goes here ...

  shadowViewPos = frx_shadowViewMatrix * vec4(frx_vertex.xyz + frx_vertexNormal.xyz * 0.1, frx_vertex.w);

  // ...
```

Don't worry about the math here, it is for something called **shadow bias**. You'll learn about it later, but this is just a preemptive measure to prevent it from becoming a problem.

That's all that we need to do in the vertex level. Notice that we haven't taken the shadow cascade level into consideration. We will do it in the fragment level.

In our fragment shader, we will obtain a cascade-specific shadow-space coordinate for each fragment. This is done by transforming the shadow view-space coordinate with the shadow projection matrix of the corresponding cascade. Before we can do that, we need to know which cascade level each fragment falls into.

This operation is quite elaborate and Canvas-specific, so we will borrow a function from Canvas's default shader that does exactly that. We will put this function just above the `frx_pipelineFragment()` function in our fragment shader:

```glsl
// Helper function
vec3 shadowDist(int cascade)
{
  vec4 c = frx_shadowCenter(cascade);
  return abs((c.xyz - shadowViewPos.xyz) / c.w);
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

// ... pipeline fragment function goes here ...
```

Now we can obtain the shadow-space coordinate for the current fragment. We won't do that just yet, but the code looks like this:

```glsl
// Obtain shadow-space position
vec4 shadowPos = frx_shadowProjectionMatrix(cascade) * shadowViewPos;

// Transform into texture coordinates
vec3 shadowTexCoord = shadowPos.xyz * 0.5 + 0.5;
```

### Applying the shadow itself

There are many ways to apply shadows. In a PBR rendering pipeline, the shadow calculation will only be applied to direct sun light calculation, without affecting ambient light.

In vanilla lighting, there are only block light and sky light values. One obvious way to apply the shadow is to alter the sky light value somehow. For simplicity, we will simply **blend the sky light value** with the value obtained from sampling the shadowmap.

> **Quick-tip:** Feel free to come up with a more elaborate method after finishing this chapter! It will be a good exercise to reinforce your understanding of shading.

Recall the following code in our fragment shader:

```glsl
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
```

This is the part of the fragment shader that handles shading. Notice that we use the `frx_fragLight` vector in order to sample the light color from the light map.

The `frx_fragLight` is a 3-dimensional vector where the `x` value represents the **block light**, the `y` value represents the **sky light**, and the `z` value represents the AO shading. We want to blend the sky light with our shadow value, so we simply add the following code before sampling the light map:

```glsl
  // Obtain the cascade level
  int cascade = selectShadowCascade();

  // Obtain shadow-space position
  vec4 shadowPos = frx_shadowProjectionMatrix(cascade) * shadowViewPos;

  // Transform into texture coordinates
  vec3 shadowTexCoord = shadowPos.xyz * 0.5 + 0.5;

  // Sample the shadow map
  float directSkyLight = texture(frxs_shadowMap, vec4(shadowTexCoord.xy, cascade, shadowTexCoord.z));

  // Pad the value to prevent absolute darkness
  directSkyLight = 0.3 + 0.7 * directSkyLight;

  // Blend with the sky light using a simple multiply
  fragData.light.y *= directSkyLight;

  // ... sampling the light map goes here ...
```

Now when you test the pipeline you should see some shadows in the world!

> **Why does my shadow sometimes disappear when I look away?** In `Options / Video Settings / Canvas / Debug`, set Shadow Priming Strategy to `TIERED` and `Disable Shadow Self-Occlusion` to `true`. This will minimize shadow flickering.

### Adjusting the fake diffuse

Recall the following fake diffuse calculation:

```glsl
  // Find out how much this surface is facing up
  float diffuseFactor = dot(frx_vertexNormal, vec3(0.0, 1.0, 0.0));
```

In this fake diffuse code, we specifically made it so that faces that point up are shaded more brightly. Since we've added shadows, it makes more sense if the faces that **points towards the sky light** are shaded more brightly instead. 

This can be achieved by utilizing the `frx_skyLightVector` which as the name implies, represents a vector that points towards the skylight. The change to be made is quite straightforward:

```glsl
  float diffuseFactor = dot(frx_vertexNormal, frx_skyLightVector);
```

However, there is a precaution that comes with this. First of all, not all dimensions have a sky light source. Secondly, we still want GUI items to use the original fake diffuse. Therefore, we will add some checks so that the final code will look like this:

```glsl
  float diffuseFactor;
  if (frx_isGui) {
    diffuseFactor = dot(frx_vertexNormal, frx_skyLightVector);
  } else {
    diffuseFactor = dot(frx_vertexNormal, vec3(0.0, 1.0, 0.0));
  }
```

To access the `frx_skyLightVector`, we need to include FREX's world API, which we should have already done when adding the enchantment glint, but if not, you'll want to make sure it's added with the rest of your includes.

```glsl
#include frex:shaders/api/world.glsl
```

### Bonus Step

While testing you might notice some flickering, or "shadow acne" on the side of blocks. This is because the sky angle aligns completely to the east/west axis and have a hard time prioritizing the south/north faces, a limitation in our computers' precision.

To remedy this, Canvas allow pipeline configuration to tilt the sky light zenith by an angle. To do this, add the following item in your pipeline configuration:

```glsl
  sky: {
    defaultZenithAngle: 15
  }
```

You can add this item in the pipeline json or the sky shadow configuration json; whichever makes more sense to you.
