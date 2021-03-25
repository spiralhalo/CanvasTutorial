# 5.1: Setting up the full-frame pass
## Setting up fabulous graphics mode

You may have heard of it; fabulous graphics is a new graphics mode introduced in 1.16 that allows particles and cloud to be rendered behind water and stained glass, or more generally translucent object. It is also called "advanced translucency" in Canvas's codebase for that reason.

Basically, fabulous graphics mode let us render the different translucent layers separately and composite them into a single frame image. We will do that later in chapter 6.

Why fabulous graphics mode is relevant right now is because the fabulous graphics pass happens before hand rendering. Hand rendering completely overwrites the depth buffer and we need that for our full frame pass. To put it simply, we can't have volumetric lighting without fabulous graphics mode enabled.

Whilst *implementing* fabulous graphics is an elaborate process, *enabling* it is pretty simple. Simply add this item after `drawTargets` in our pipeline configuration:

```json5
  fabulousTargets: {
    entity: "main_gbuffer",
    particles: "main_gbuffer",
    weather: "main_gbuffer",
    clouds: "main_gbuffer",
    translucent: "main_gbuffer"
  }
```

This item defines a whole new set of targets for the different layers. We don't need to worry about the actual targets for now as we simply want to enable the fabulous pass. Do keep in mind that since we didn't implement fabulous graphics completely, some glitch may occur but it will be fixed once we implemented advanced translucency in chapter 6.

## Setting up a full frame pass for our volumetric lighting

Setting up a full frame pass involves a few steps:

1. Creating image attachment(s) for that pass
2. Creating a framebuffer to contain those image attachments
3. Creating a shader program, also for that pass
4. Writing the shader program
5. Adding the pass to the pipeline

### Creating image attachment, framebuffer, and program for our pass

We already learned how to create images and framebuffers in chapter 1 when creating the G-buffer. The process is the same. The difference is that we don't need to create a depth attachment this time. Full frame passes can't have depth attachment anyway (I tried..)

Let's create a new pipeline file in (you guessed it) `pipeline_files` folder and call it `volumetric_light.json`. We will define our image attachment, framebuffer, and shader program here.

I will not be adding more code sample for things we've already done before. Instead, I will start numbering the steps to make sure you don't miss any!

**Step 1:** Create an image called `volumetric_light_result` and attach it to a framebuffer called `volumetric_light_fb`. Remember, no depth attachment this time. If you forgot how the code looks like, refer back to chapter 1.

**Step 2:** Now let's create a program in the same file. Similar to images and framebuffers, we need to create a new array called `programs` to store our program definitions.

Our program definition looks like this (put it in the `programs` array):

```json5
{
  name: "volumetric_light_program",
  vertexSource: "tutorialpack:shaders/post/basic_frame.vert",
  fragmentSource: "tutorialpack:shaders/post/volumetric_light.frag",
  samplers: ["u_color", "u_depth"]
}
```

The keywords should make it clear what these fields are, but do notice the `samplers` array. The content of this array will refer to **sampler uniforms** inside our volumetric light shader, which will receive the content of our G-buffer attachments (recall: color and depth). Keep this in mind as we will revisit them multiple times further down this chapter.

**Step 3:** Next, import the new pipeline file into our pipeline by adding its path in the `include` array in the pipeline file (`tutorial_pipeline.json`).

So far, we've defined the ingredients for our volumetric light pass, but it's not recognized as a pass just yet. The next step is to add the volumetric light pass into the rendering pipeline.

## Adding the pass to the pipeline

Create a new pipeline file called `passes.json`. It's not actually necessary to separate it this way, but who knows what full frame passes we will add after finishing this tutorial (wink wink) so the list might get long really fast.

In the pipeline file, create an object called `fabulous` with a `passes` array inside it, like this:

```json5
{
  fabulous: {
    passes: [
      // the fabulous graphics passes shall go here
    ]
  }
}
```

The `passes` array inside the `fabulous` object will store all the fabulous graphics passes.

> **What types of passes are available in Canvas?**
> 
> Canvas pipelines can define full-frame passes in three stages:
>
> 1. `beforeWorldRender`
> 2. `fabulous`, which executes after world render and before hand render
> 3. `afterRenderHand`

Next, insert our volumetric light pass inside the `passes` array, like this:

```json5
  {
    name: "volumetric_light",
    program: "volumetric_light_program",
    framebuffer: "volumetric_light_fb",
    samplerImages: ["main_color", "main_depth"]
  }
```

As mentioned in the previous section, the uniform samplers of our volumetric light shader will receive the color and depth content of the G-buffer but this doesn't happen automatically. The `samplerImages` array is where we tell the pipeline the name of the **images** that the program shall receive in this particular pass. Recall the names of those images from chapter 1.

Finally, we import the content of `passes.json` by including it in our pipeline file.

> **Quick-tip:** The ordering of the imported files matter! For example, if you have multiple `fabulous` passes array in two pipeline files, the passes will execute in order of which file is imported first!

## Creating the vertex and fragment shaders

Let's create a new folder called `post` in our `shaders` folder. This will contain shader files for full-frame passes and separate them from the G-buffer pass shaders.

One thing to note before writing our full-frame shaders is that, unlike world render or shadow render pass shaders, full-frame shaders are not interfaced. That means what we write will be the final shader code and what we doesn't `#include` will not be part of our shader code at all.

Previously, our shaders have been silently including the necessary GL headers. This time, we will manually write that header to be included in our full-frame shaders.

### Creating the header file

Create a file called `header.glsl` in the `post` folder. The content of this file looks like this:

```glsl
#include frex:shaders/api/header.glsl

uniform ivec2 frxu_size; // size of viewport
uniform int frxu_lod; // lod value of this pass
```

The first line imports Canvas's OpenGL header so we don't need to handle it manually.

The last two lines are uniforms special to full-frame passes. We won't be using the lod part just yet but we'll include it anyway for completeness.

Now that we've created our header file, we can move on to the next step. Note that this header is **not** imported automatically. We will import it when creating our vertex and fragment shaders.

### Creating the vertex shader

Create a file named `basic_frame.vert` inside the `post` folder. This vertex shader will be the vertex source for most full-frame passes. As the name implies, it does basic things without any special operation for specific needs.

The content of this shader looks like this:
```glsl
#include tutorialpack:shaders/post/header.glsl

in vec2 in_uv;
out vec2 v_texcoord;

void main()
{
  vec4 screen = gl_ProjectionMatrix * vec4(gl_Vertex.xy * frxu_size, 0.0, 1.0);
  gl_Position = vec4(screen.xy, 0.2, 1.0);
  v_texcoord = in_uv;
}
```

Since the full-frame shaders aren't interfaced, our shader code directly goes in OpenGL's `void main` function.

Essentially, what this shader does is placing the vertexes on the corners of the screen (since the screen is a rectangle, that means two triangles or 6 vertexes) and then outputting the texture coordinates.

### Creating the fragment shader

Our volumetric lighting fragment shader will be a file named `volumetric_light.frag` inside the `post` folder.

For now, the content of this file looks like this:

```glsl
#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_color;
uniform sampler2D u_depth;

in vec2 v_texcoord;

void main()
{
  // Volumetric lighting algorithm goes here
}
```

Notice the `u_color` and `u_depth` sampler uniforms. They are named the same as we've defined previously in our volumetric lighting program, so the renderer can know that these samplers exist and assign the correct images. These samplers will receive the color and depth attachments of the G-buffer as previously mentioned.

We will work on the volumetric lighting fragment shader in the next sub-chapter.
