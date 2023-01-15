# 2: Making the pipeline shader

## Creating the pipeline file

Now that we've set up our G-buffer, it's time to write to it! Before that, we need to set up some more things, namely **the pipeline itself**. I know that it sounds weird to start with a framebuffer before the pipeline itself, but the pipeline setup is pretty boring. You'll see.

Start by creating the pipeline file in the `pipelines` folder. Canvas will look into this folders for valid pipeline files. We will name ours `tutorial_pipeline.json5`. You're free to name yours anything but make sure to keep track of its filename.

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

Now that's a lot of copy paste. The content of this file should be self explanatory and there isn't much point going through it step by step. The important bit is that we are pointing the default render targets to the G-buffer that we have set up before! That means whenever Canvas renders something the data will be stored in our G-buffer.

Another important bit is this part:

```json5
vertexSource: "tutorialpack:shaders/gbuffer/main.vert",
fragmentSource: "tutorialpack:shaders/gbuffer/main.frag"
```

It points to shader files that don't yet exist. We will be creating those files before we can write our pipeline shader.

### Creating the pipeline shader files

1. Inside the `shaders` folder, create a folder called `gbuffer`. This will be the place where we put all our G-buffer-related shaders.
2. Inside the `gbuffer` folder, create the files `main.vert` and `main.frag`. These will be our pipeline vertex and fragment shader files respectively.

> **Quick note:** What is a shader "program"? A shader program consists of a vertex and a fragment shader!

## Making the vertex shader

Our first vertex shader would be a very basic one. First, start by adding these lines of code at the beginning of `main.vert`:

```glsl
#include frex:shaders/api/vertex.glsl
#include frex:shaders/api/view.glsl
```

These will import frex shaders api that are responsible for vertex data and view transformations. We will always need these in a vertex shader on the G-buffer pass. We will learn about other types of passes such as shadow pass and full frame pass later on.

Next, we would want to define any *varying variables*, which in GLSL represent data that varies per-vertex.
If it sounds too complicated, don't worry; we won't have any need for varying variables for now in this tutorial.

Finally, as the main bread and butter of the shader, we want to use a "vertex write function" so our vertex shader will be able to move Minecraft's vertices to their proper place. This function looks like this:

```glsl
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

As the name implies, this is where our vertexes are transformed and written into the rasterization/interpolation process, which will produce fragments for the fragment shader.

Specifically, the data being written are **vertex positions** and vanilla lighting data. We don't want to write raw positions of the vertex, however. We want the vertexes to be positioned **relative to the camera position, rotation, and projection** so we are doing some transformations using vectors and **matrices**.

> Vertex positions are transformed to something called **clip space**, so OpenGL can internally decide what objects are displayed on the screen and what objects can be discarded, or *clipped*.

The concept of model-view-projection matrix is very useful but out of scope for this section of the tutorial.

> **What is a vertex?** A vertex in the context of rendering is an abstract object that makes up the corners of a triangle. A vertex contains positional information, but it can also contain other information added by the renderer such as normals. The vertex shader is responsible for transforming these information and passing them on to the intermediate stage between the vertex and fragment stages.

## Making the fragment shader

This time we will work on the `main.frag` file. Just like before, we begin by importing necessary libraries:

```glsl
#include frex:shaders/api/material.glsl
#include frex:shaders/api/fragment.glsl
```

Then we will define our fragment color output here, so OpenGL knows what we want to display to the screen:

```glsl
// In the case of multiple color attachments, you use different layout qualifiers.
layout(location = 0) out vec4 fragColor;
```

And finally, we get to the most fun part of the pipeline shader, the fragment write function! In this part we will do many things from shading to writing into the G-buffer. We won't do any advanced shading just yet, so we will simply write our fragment data directly to the G-buffer.

The fragment write function looks like this:
```glsl
void frx_pipelineFragment() {
  // Variables prefixed with frx_ are parts of the API. 
  // In this case, since we included frex:shaders/api/fragment.glsl, 
  // we get access to most of the information we would want in the G-Buffer program.
  //
  // frx_fragColor refers to the Minecraft texture color, 
  // already multiplied with the vertex color so we can use it just like this.
  vec4 color = frx_fragColor;

  // Write color data to the color attachment
  fragColor = color;
  
  // Write position data to the depth attachment
  gl_FragDepth = gl_FragCoord.z;
}
```

Notice the `fragColor` and `gl_FragDepth` variables. These are used for writing the color and depth data respectively.

> **What is a fragment?** A fragment is simply an "unprocessed" pixel! The fragment shader is responsible for processing and writing fragments into the framebuffer before they can be displayed as pixels on the screen or sampled as texture by other shaders further down the pipeline.

## Testing your first render

At this point, your pipeline should be complete enough to render something! Try loading the resource pack and go to `Options / Video Settings / Canvas / Pipeline Options / Pipelines` and change the pipeline to your tutorial pipeline. If you did everything right up to this point your pipeline should render a basic unshaded minecraft world. Congrats!

If it won't render anything meaningful, or if your pipeline isn't detected then you might need to retrace your steps in case you were missing a semi-colon somewhere...

Don't worry, this will likely happen often regardless of how advanced you are at shader development. Let's get Canvas to aid us with debugging to make our lives easier. Go to Canvas setting, scroll down to the bottom section and enable the option that says **Enable Shader Debug Output**. Now every time your shader is compiled, a folder called `canvas_shader_debug` will be created inside your `.minecraft` folder. Depending on whether your shader compiles successfully or not, a `failed` subfolder may be created as well to contain all the compilation error messages. When you have a shader compilation error, you will only need to worry about the `failed` folder. Else, you can use the shader debug output to deal with pesky compatibility issues.

> **Quick tip:** You can try messing with the `color` variable in the fragment shader. Multiply it, add to it, etc. and see how it affects the final image. This is where the fun begins!

## Bonus step

You might notice that your pipeline is named gibberish when selecting it from the pipeline selection. You can change the displayed name by creating a language file containing the name and description keys of your pipeline. For example:
```json
"pipeline.tutorial_pipeline.name": "My Pipeline",
"pipeline.tutorial_pipeline.desc": "A pipeline made of hopes and dreams"
```
Learn more about creating language files in the [wiki](https://minecraft.fandom.com/wiki/Resource_Pack#Language).
