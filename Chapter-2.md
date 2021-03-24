# 2: Making the pipeline shader

## Creating the pipeline file

Now that we've set up our G-buffer, it's time to write to it! Before that, we need to set up some more things, namely **the pipeline itself**.

Start by creating the pipeline file in the `pipelines` folder. Canvas will look into this folders for valid pipeline files. We will name ours `tutorial_pipeline.json`. You're free to name yours anything but make sure to keep track of its filename.

The content of this file is the following (if you use a unique name for your pack make sure to replace "tutorialpack" with it):
```json5
{
  nameKey: "pipeline.tutorial_pipeline.name",
  descriptionKey: "pipeline.tutorial_pipeline.desc",

  materialProgram: {
    vertexSource: "tutorialpack:shaders/gbuffer/main.vert",
    fragmentSource: "tutorialpack:shaders/gbuffer/main.frag",
    samplers: [],
    samplerImages: []
  },

  drawTargets: {
    solidTerrain: "main_gbuffer",
    translucentTerrain: "main_gbuffer",
    translucentEntity: "main_gbuffer",
    weather: "main_gbuffer",
    clouds: "main_gbuffer",
    translucentParticles: "main_gbuffer"
  },
  
  defaultFramebuffer: "main_gbuffer",
  
  beforeWorldRender: {
    passes: [
      {
        // clears the main gbuffer at the start of each frames
        name: "clear_main_gbuffer",
        framebuffer: "main_gbuffer",
        program: "frex_clear"
      }
    ]
  },

  include: [
    "tutorialpack:pipeline_files/main.json"
  ]
}
```

Now that's a lot of copy paste. The content of this file should be self explanatory and there isn't much point going through it step by step, but the important bit is that we are pointing the default render targets to the gbuffer that we have set up before! That means whenever Canvas renders something the data will be stored in our gbuffer.

Another important bit is this part:

```json5
vertexSource: "tutorialpack:shaders/gbuffer/main.vert",
fragmentSource: "tutorialpack:shaders/gbuffer/main.frag"
```

It points to shader files that hasn't yet exist. We will be creating those files before we can write our pipeline shader.

## Creating the pipeline shader files

1. Inside the `shaders` folder, create a folder called `gbuffer`. This will be the place where we put all our G-buffer-related shaders.
2. Inside the `gbuffer` folder, create the files `main.vert` and `main.frag`. These will be our pipeline vertex and fragment shader files respectively.

*> Quick note: What is a shader "program"? A shader program consists of a vertex and a fragment shader!

# Making the vertex shader

Our first vertex shader would be a very basic one. First, start by adding these lines of code at the beginning of `main.vert`:

```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
```

These will import frex shaders api that are responsible for vertex data and view transformations. We will always need these in a vertex shader on the G-buffer pass. We will learn about other types of passes such as shadow pass and full frame pass later on.

Next, we want the following lines of code:

```glsl
#ifdef VANILLA_LIGHTING
  varying vec2 v_light;
  varying float v_aoShade;
#endif
```

These are used to transport vanilla light and ambient occlusion data to be used later on when being working on the shading.

And finally, we want to put a "vertex write function" into our vertex shader. This function looks like this:

```glsl
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

  #ifdef VANILLA_LIGHTING
    v_light = data.light;
    v_aoShade = data.aoShade;
  #endif
}
```

As the name implies, this is where our vertexes are written into the rasterization/interpolation process, which will produce fragments for the fragment shader.

Specifically, the data being written are **vertex positions** and vanilla lighting data. We don't want to write raw positions of the vertex, however. We want the vertexes to be positioned **relative to the camera position, rotation, and projection** so we are doing some transformations using vectors and **matrices**.

The concept of model-view-projection matrix is too complex to be explained in this part of the tutorial. We will revisit them later when we begin working on the volumetric light pass.

# Making the fragment shader

This time we will work on the `main.frag` file. Just like before, we begin by importing necessary libraries:

```glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
```

Then we will define the variables that will contain vanilla lighting data written by the vertex shader, same as before:

```glsl
#ifdef VANILLA_LIGHTING
  varying vec2 v_light;
  varying float v_aoShade;
#endif
```

Next, we want to set up our fragment data. This part is included in the fragment shader to allow pipelines to manipulate fragment data before any material shader could, but for this tutorial we won't be modifying anything so we can treat this part as mostly boilerplate code:

```glsl
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
```

And finally, we get to the most fun part of the pipeline shader, the fragment write function! In this part we will do many things from shading to writing into the G-buffer. We won't do any shading just yet, so we will simply write our fragment data directly to the G-buffer.

The fragment write function looks like this:
```glsl
void frx_writePipelineFragment(in frx_FragmentData fragData)
{
  // Obtain true color by multiplying sprite color (usually texture) and vertex color (usually biome color)
  vec4 color = fragData.spriteColor * fragData.vertexColor;

  // Write color data to the color attachment
  gl_FragData[0] = color;
  
  // Write position data to the depth attachment
  gl_FragDepth = gl_FragCoord.z;
}
```

Notice the `gl_FragData[0]` and `gl_FragDepth` variables. These are used for writing the color and depth data respectively.

# Testing your first render

At this point, your pipeline should be complete enough to render something! Try loading the resource pack and go to Video Setting > Canvas and change the pipeline to your tutorial pipeline. If you did everything right up to this point your pipeline should render a basic unshaded minecraft world. Congrats! If it won't render anything meaningful, or if your pipeline isn't detected then you might need to retrace your steps in case you were missing a semi-colon somewhere...

*> Quick tip: You can try messing with the `color` variable in the fragment shader. Multiply it, add to it, etc. and see how it affects the final image. This is where the fun begins!

*> Bonus step: You might notice that your pipeline is named gibberish when selecting it from the pipeline selection. You can change the displayed name by creating a language file containing the name and description keys of your pipeline. For example:
```json
"pipeline.tutorial_pipeline.name": "My Pipeline",
"pipeline.tutorial_pipeline.desc": "A pipeline made of hopes and dreams"
```
Learn more about creating language files in the [wiki](https://minecraft.fandom.com/wiki/Resource_Pack#Language).