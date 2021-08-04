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

The shader code for the shadow pass is straightforward. We simply transform the vertexes in the vertex shader and write the depth value in the fragment shader. The difference is instead of using the camera's transformation we use the shadow transformations.

The shader files will be named `shadow.vert` and `shadow.frag`. We will put them in our `gbuffer` folder. The contents of these files are as follows:

`shadow.vert`:
```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl

// Cascade level that is currently rendering, 0-3
uniform int frxu_cascade;

void frx_writePipelineVertex(in frx_VertexData data)
{
  // Move to camera origin
  vec4 shadowVertex = data.vertex + frx_modelToCamera();
  gl_Position = frx_shadowViewProjectionMatrix(frxu_cascade) * shadowVertex;
}
```

`shadow.frag`:
```glsl
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
```

## Applying the shadows

### Sampling the shadowmap

Now that we've set up the sky shadow configuration, a shadow map will be generated at the beginning of each frame. There are two ways to sample the shadow map in the G-buffer pass:

* `frxs_shadow map` to sample using the `shadow2DArray` function. This is the easiest way to sample the shadow map for most purposes.
* `frxs_shadow mapTexture` to sample the shadow map directly. For advanced use.

To sample the shadow map we need the coordinates of an object in the **shadow-space**. This is where the shadow transformations will come in handy.

First, we will create a new input/ouput both in our vertex and fragment shaders (Remember, these are the `main.vert` and `main.frag` files):

```glsl
// Vertex shader
out vec4 v_shadowViewPos;

// Fragment shader
in vec4 v_shadowViewPos;
```

Next, just after the camera transformations in the **vertex shader**, we will calculate the shadow view-space coordinate and write it into the new output:

```glsl
  // ... camera trasnformation goes here ...

  v_shadowViewPos = frx_shadowViewMatrix() * data.vertex;

  // ...
```

That's all that we need to do in the vertex level. Notice that we haven't taken the shadow cascade level into consideration. We will do it in the fragment level.

In our fragment shader, we will obtain a cascade-specific shadow-space coordinate for each fragment. This is done by transforming the shadow view-space coordinate with the shadow projection matrix of the corresponding cascade. Before we can do that, we need to know which cascade level each fragment falls into.

This operation is quite elaborate and Canvas-specific, so we will borrow a function from Canvas's default shader that does exactly that. We will put this function just above the `frx_createPipelineFragment` function in our fragment shader:

```glsl
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
```

Now we can obtain the shadow-space coordinate for the current fragment. We won't do that just yet, but the code looks like this:

```glsl
// Obtain shadow-space position
vec4 shadowPos = frx_shadowProjectionMatrix(cascade) * v_shadowViewPos;

// Transform into texture coordinates
vec3 shadowTexCoord = shadowPos.xyz * 0.5 + 0.5;
```

### Applying the shadow itself

There are many ways to apply shadows. In a PBR rendering pipeline, the shadow calculation will only be applied to direct sun light calculation, without affecting ambient light.

In vanilla lighting, there are only block light and sky light values. One obvious way to apply the shadow is to alter the sky light value somehow. For simplicity, we will simply **replace the sky light value** with the value obtained from sampling the shadowmap.

> **Quick-tip:** Feel free to come up with a more elaborate method after finishing this chapter! It will be a good exercise to reinforce your understanding of shading.

Recall the following code in our fragment shader:

```glsl
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

This is the part of the fragment shader that handles shading. Notice that we use the `fragData.light` vector in order to sample the light color from the light map.

The `fragData.light` is a 2-dimensional vector where the `x` value represents the **block light** while the `y` value represents the **sky light**. We want to replace the sky light with our shadow value, so we simply add the following code before sampling the light map:

```glsl
  // Obtain the cascade level
  int cascade = selectShadowCascade();

  // Obtain shadow-space position
  vec4 shadowPos = frx_shadowProjectionMatrix(cascade) * v_shadowViewPos;

  // Transform into texture coordinates
  vec3 shadowTexCoord = shadowPos.xyz * 0.5 + 0.5;

  // Sample the shadow map
  float directSkyLight = shadow2DArray(frxs_shadowMap, vec4(shadowTexCoord.xy, float(cascade), shadowTexCoord.z)).r;

  // Pad the value to prevent absolute darkness
  directSkyLight = 0.3 + 0.7 * directSkyLight;

  // Clip to 0.96875 because of how light map works
  directSkyLight = min(0.96875, directSkyLight);

  // Replace the sky light
  fragData.light.y = directSkyLight;

  // ... sampling the light map goes here ...
```

Now when you test the pipeline you should see some shadows in the world!

> **Why does my shadow sometimes disappear when I look away?** This is a know Canvas issue. Be patient and wait for it to get fixed.

### Adjusting the fake diffuse

Recall the following fake diffuse calculation in the vertex shader:

```glsl
  float pointing_up = dot(data.normal, vec3(0.0, 1.0, 0.0));
  pointing_up = pointing_up * 0.5 + 0.5;
  v_diffuse = 0.3 + 0.7 * pointing_up;
```

In this fake diffuse code, we specifically made it so that faces that point up are shaded more brightly. Since we've added shadows, it makes more sense if the faces that **points towards the sky light** are shaded more brightly instead. 

This can be achieved by utilizing the `frx_skyLightVector()` which as the name implies, represents a vector that points towards the skylight. The change to be made is quite straightforward:

```glsl
  float pointing_to_light = dot(data.normal, frx_skyLightVector());
```

However, there is a precaution that comes with this. First of all, not all dimensions have a sky light source. Secondly, we still want GUI items to use the original fake diffuse. Therefore, we will add some checks so that the final code will look like this:

```glsl
  float pointing_to_light;
  if (frx_worldFlag(FRX_WORLD_HAS_SKYLIGHT) && !frx_isGui()) {
    pointing_to_light = dot(data.normal, frx_skyLightVector());
  } else {
    pointing_to_light = dot(data.normal, vec3(0.0, 1.0, 0.0));
  }
  pointing_to_light = pointing_to_light * 0.5 + 0.5;
  v_diffuse = 0.3 + 0.7 * pointing_to_light;
```

Last but not least, we need to import the Frex World API in order to access the `frx_worldFlag` and `frx_skyLightVector` functions. We add the following item to our list of `include`s at the beginning of the vertex shader file:

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

You can add this item in the pipeline json or the sky shadow configuration json, whichever makes more sense to you.
