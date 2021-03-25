# 5: Compositing and advanced translucency

**..is just a fancy way to say fabulous graphics mode.**

You may have heard of it; fabulous graphics is a new graphics mode introduced in 1.16 that allows particles and cloud to be rendered behind water and stained glass, or more generally translucent object. It is also called "advanced translucency" in Canvas's codebase for that reason.

Basically, fabulous graphics mode let us render translucent objects to separate layers and composite them into a single frame image. The "rendering into separate layers" part is just pipeline specifications, but the compositing part will be done in shaders.

## Setting up the pipeline to render to multiple layers

Declaring the different layers will make our pipeline files rather verbose, but it's actually quite easy.

Remember the `main_gbuffer` framebuffer that we created in chapter 1.

So far the `main_gbuffer` has been the render target for **everything**. This time, we will set it up so that the `main_gbuffer` becomes only the render target for **solid terrain**.

Also, we will be creating a new framebuffer for unmanaged draws. Unmanaged draws simply refer to direct draw calls that we can't affect using shaders. Mods that draws directly to the default framebuffer is one example.

We will call this unmanaged framebuffer `main_unmanaged` for clarity. This framebuffer is defined similarly to the G-buffer, except we don't want to set any clear flags:

```json5
  {
    name: "main_unmanaged",
    depthAttachment: {image: "main_depth"},
    colorAttachments: [{image: "main_color"}]
  }
```

With this added framebuffer, the **solid terrain** layer will have the following components to it:

1. `main_color` color image
2. `main_depth` depth image
3. `main_gbuffer` framebuffer with `main_color` and `main_depth` as attachments, with clear flags set
4. `main_unmanaged` framebuffer with `main_color` and `main_depth` as attachments, without clear flags

Now we simply need to create all of this component for **all of the layers**, by replacing the `main_` prefix with the corresponding layer names:

1. `main` -> we already did this one
2. `translucent`
3. `entity`
4. `weather`
5. `clouds`
6. `particles`

Recall the process of creating images and framebuffers from chapter 1. This process is just a lot of copy, paste, and rename. This is all done in the `main.json` file by the way (You can also make separate files for them and then import them in the main pipeline file, if it's easier to manage for you.)

Once you've created them, it's time to set them as the correct render targets. Remember that we've previously set `drawTargets` and `defaultFramebuffer` in our main pipeline file (`tutorial_pipeline.json`). We want them to look like this now:

```json5
  drawTargets: {
    solidTerrain: "main_gbuffer",
    translucentTerrain: "translucent_gbuffer",
    translucentEntity: "entity_gbuffer",
    weather: "weather_gbuffer",
    clouds: "clouds_gbuffer",
    translucentParticles: "particles_gbuffer"
  },

  fabulousTargets: {
    translucent: "translucent_unmanaged",
    entity: "entity_unmanaged",
    weather: "weather_unmanaged",
    clouds: "clouds_unmanaged",
    particles: "particles_unmanaged"
  },
  
  defaultFramebuffer: "main_unmanaged"
  ```

Can you see how it all comes together?

> **Quick tip:** By adding `fabulousTargets`, your pipeline is now *fabulous*. That means mods will see as if fabulous graphics is enabled when your pipeline is active. This also means `fabulous` frame passes will be available to us! More on that in the next section.

Oh, last but not least, don't forget to clear the new G-buffers at the beginning of each frame as well. This is specified in the `beforeWorldRender` object:

```json5
  // Replace the existing `beforeWorldRender` with this one
  beforeWorldRender: {
    passes: [
      // clears the gbuffers at the start of each frames
      {
        name: "clear_main_gbuffer",
        framebuffer: "main_gbuffer",
        program: "frex_clear",
      },
      {
        name: "clear_translucent_gbuffer",
        framebuffer: "translucent_gbuffer",
        program: "frex_clear"
      },
      {
        name: "clear_entity_gbuffer",
        framebuffer: "entity_gbuffer",
        program: "frex_clear"
      },
      {
        name: "clear_weather_gbuffer",
        framebuffer: "weather_gbuffer",
        program: "frex_clear"
      },
      {
        name: "clear_clouds_gbuffer",
        framebuffer: "clouds_gbuffer",
        program: "frex_clear"
      },
      {
        name: "clear_particles_gbuffer",
        framebuffer: "particles_gbuffer",
        program: "frex_clear"
      },
    ]
  }
```

## Setting up the composite pass

Our pipeline renders the geometry to separate layers now. The next step is to combine them all together again in a composite pass.

The composite pass counts as a **frame pass**. A frame pass processes **frame data** to create various beautiful effects. This frame data can contain results from other frame passes, but it all starts with the G-buffer. This is what I meant earlier when I said that the G-buffer is the meat and potatoes of configurable pipeline. The G-buffer is actually just the meat, and frame passes are the potatoes. Does that make sense?

And yes, I count advanced translucency as a beautiful effect.

**Pretty sure you said bread and peanut butter or something.**

That is besides the point. Anyway, moving on...

While we're on the topic of frame passes, there are actually three stages where they can execute:
1. `beforeWorldRender`
2. `fabulous`
3. `afterRenderHand`

Most post-effects will happen in `fabulous` stage, unless you want to apply it to the hand as well. Keep one thing in mind however: the hand rendering overwrites the depth buffer, so if a post-effect requires it, it needs to be copied into another image in the `fabulous` stage.

Another thing to note is that hand rendering will render to the solid layer, which is treated as the default render target. That means if you were to apply effects in the `fabulous` pass, it needs to write back to the solid layer eventually.

So, we want our composite pass to sample the G-buffer, which includes the solid layer. At the same time, we want to write into the solid layer. We actually can't do that, or shouldn't. That is why we will structure our passes like this:

1. Composite pass
2. Copy pass (copies composite result to the solid layer)

> **Pro-tip:** You don't need the copy pass when you have **even** number of `fabulous` passes. However using the copy pass anyway makes it easier to debug and reorganize when necessary.

### Creating the shader program configurations

We need to create new shader programs for our frame passes, namely the composite program and the copy program.

A program requires a framebuffer to write into, and a framebuffer requires image attachments. This might get complicated, so let's create our configurations in a new file in `pipeline_files` called `composite.json`.

In this file, let's create arrays to store our images, framebuffers, and programs:

```json5
{
  images: [
    // Images go here
  ],

  framebuffers: [
    // Framebuffers go here
  ],

  programs: [
    // Programs go here
  ]
}
```

At this point you should know how to create images and framebuffers. Create a color image called `composite_result` and a framebuffer called `composite` with `composite_result` attached as a color attachment. We don't need a depth attachment here. As a matter of fact, frame passes can't write into depth attachment anyway (I tried...)

We also don't want the copy program to render to the G-buffer directly. Therefore, let's make a framebuffer called `copy_to_main` and set the color attachment to `main_color`.

Next, we will create the composite and copy programs. The copy program isn't necessarily composite-related, so you might move it out into a `utility.json` file if you want.

Either way, our programs look like this:

```json5
// The composite program
{
  name: "composite",
  vertexSource: "tutorialpack:shaders/post/basic_frame.vert",
  fragmentSource: "tutorialpack:shaders/post/composite.frag",
  samplers: [
    "u_main_color",
    "u_main_depth",
    "u_translucent_color",
    "u_translucent_depth",
    "u_entity_color",
    "u_entity_depth",
    "u_weather_color",
    "u_weather_depth",
    "u_clouds_color",
    "u_clouds_depth",
    "u_particles_color",
    "u_particles_depth"
  ]
},

// The copy program
{
  name: "copy",
  vertexSource: "tutorialpack:shaders/post/basic_frame.vert",
  fragmentSource: "tutorialpack:shaders/post/copy.frag",
  samplers: ["u_source"]
}
```
The program definition should be self explanatory. One thing you may notice is that it points to shader files that don't yet exist. We will create them later.

Another thing to notice is the `samplers` array. These serves as entry point for the renderer to put textures (images) to be sampled during execution. The names of the samplers should be self-explanatory as well. (The `u_` means uniform. It's not necessary but it makes it easier to separate uniform names from image names).

Finally, we will import the `composite.json` file (and optionally `utility.json` if you made that) into our `tutorial_pipeline.json` file and we're done with the program configurations.

### Adding the passes

This part should logically go last, but as it's pretty simple, let's get this out of the way first before we get into writing the shader codes.

Let's create a file called `passes.json` in `pipeline_files`. We will store post-effect passes here to prevent making the main pipeline file too bloated as we keep adding post-effect passes later on.

This will be the content of this file:

```json5
{
  fabulous: {
    passes: [
      // The composite pass
      {
        name: "composite",
        program: "composite",
        framebuffer: "composite",
        samplerImages: [
          "main_color",
          "main_depth",
          "translucent_color",
          "translucent_depth",
          "entity_color",
          "entity_depth",
          "weather_color",
          "weather_depth",
          "clouds_color",
          "clouds_depth",
          "particles_color",
          "particles_depth"
        ]
      },

      // The copy pass
      {
        name: "copy",
        program: "copy",
        framebuffer: "copy_to_main",
        samplerImages: ["composite_result"]
      }
    ]
  }
}
```

This code defines and adds the composite and copy passes to the `fabulous` stage. Take a long hard look at this code and try to discern what each part means. It should all come together without explanation necessary.

Don't forget to import everything into the `tutorial_pipeline.json` file. At the end of this section, your `include` object should look like this (unless you decided to split more files):

```json5
  include: [
    "tutorialpack:pipeline_files/main.json",
    "tutorialpack:pipeline_files/skyshadow.json",
    "tutorialpack:pipeline_files/composite.json",
    "tutorialpack:pipeline_files/passes.json"
  ]
``` 

> **Quick tip:** the ordering of inclusion usually doesn't matter, except for files with passes as it affects the ordering of the passes.

## Coding the vertex and fragment shaders

Let's create a new folder called `post` in our `shaders` folder. This will contain shader files for frame passes and separate them from the G-buffer pass shaders.

One thing to note before writing our frame shaders is that, unlike world render or shadow render pass shaders, frame shaders are not interfaced. That means what we write will be the final shader code and what we doesn't `#include` will not be part of our shader code at all.

Previously, our shaders have been silently including the necessary GL headers. This time, we will manually write that header to be included in our frame shaders.

### Creating the header file

Create a file called `header.glsl` in the `post` folder. The content of this file looks like this:

```glsl
#include frex:shaders/api/header.glsl

uniform ivec2 frxu_size; // size of viewport
uniform int frxu_lod; // lod value of this pass
```

The first line imports Canvas's OpenGL header so we don't need to handle it manually.

The last two lines are uniforms special to frame passes. We won't be using the lod part just yet but we'll include it anyway for completeness.

Now that we've created our header file, we can move on to the next step. Note that this header is **not** imported automatically. We will import it when creating our vertex and fragment shaders.

### Creating the vertex shader

Create a file named `basic_frame.vert` inside the `post` folder. This vertex shader will be the vertex source for most frame pass programs. As the name implies, it does basic things without any special operation for specific needs. This vertex shader is used in both our composite and copy programs (as well as volumetric light program in chapter 6.)

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

Notice that since the frame shaders shaders aren't interfaced, our shader code directly goes in OpenGL's `void main()` function.

Essentially, what this shader does is placing the vertexes on the corners of the screen and then outputting the texture coordinates.

### Creating the copy fragment shader

Let's create the copy fragment shader because it's easier. As a matter of fact, we just need to create a file named `copy.frag` in the `post` folder, and put the following:

```glsl
#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_source;

in vec2 v_texcoord;

void main()
{
  gl_FragData[0] = texture2D(u_source, v_texcoord);
}
```

All this shader does is sample the source texture using the texture coordinates input from the vertex shader and then writing it into the color attachment. Simple!

### Coding the composite fragment shader

Finally, we got to the closing event of this whole chapter: the composite shader itself.

We already know that the composite shader combines the different layers into one image, but how exactly are we doing that?

Recall that we are sampling the six G-buffers, each containing color and depth images. In fact, let's get that part of the code out of the way.

Create `composite.frag` in the `post` folder and add the following code:

```glsl
#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_main_color;
uniform sampler2D u_main_depth;
uniform sampler2D u_translucent_color;
uniform sampler2D u_translucent_depth;
uniform sampler2D u_entity_color;
uniform sampler2D u_entity_depth;
uniform sampler2D u_weather_color;
uniform sampler2D u_weather_depth;
uniform sampler2D u_clouds_color;
uniform sampler2D u_clouds_depth;
uniform sampler2D u_particles_color;
uniform sampler2D u_particles_depth;

in vec2 v_texcoord;

void main()
{
  vec4  main_color        = texture2D(u_main_color       , v_texcoord);
  float main_depth        = texture2D(u_main_depth       , v_texcoord).r;
  vec4  translucent_color = texture2D(u_translucent_color, v_texcoord);
  float translucent_depth = texture2D(u_translucent_depth, v_texcoord).r;
  vec4  entity_color      = texture2D(u_entity_color     , v_texcoord);
  float entity_depth      = texture2D(u_entity_depth     , v_texcoord).r;
  vec4  weather_color     = texture2D(u_weather_color    , v_texcoord);
  float weather_depth     = texture2D(u_weather_depth    , v_texcoord).r;
  vec4  clouds_color      = texture2D(u_clouds_color     , v_texcoord);
  float clouds_depth      = texture2D(u_clouds_depth     , v_texcoord).r;
  vec4  particles_color   = texture2D(u_particles_color  , v_texcoord);
  float particles_depth   = texture2D(u_particles_depth  , v_texcoord).r;

  // Composite logic goes here
}
```

This samples the images at the right texture coordinates and put the colors and depth in neatly named variables. Notice how the depth components uses the `.r` swizzle* and are stored as `float`s. That is because depth components are single float values stored in the `red` component of the image.

> *) **Quick tidbit:** Swizzle masks. They are used to take the value of components of a vector. There are 3 sets of swizzle masks:
> * `.rgba` -> conveys color
> * `.xyzw` -> conveys position or direction
> * `.stpq` -> conveys texture coordinate
>
> Any swizzle mask can be used on any vector, as long as you don't mix them together. For example you can do `color.rgb` or `color.xyz`, but not `color.rgz`. You can also sample the components in arbitrary order, such as `color.bgr`, or `color.yy`. The result of swizzling is a vector with the same length as the swizzle mask.

Now that we've sampled them, the next step is to **sort them by depth**. The way depth works is that things with **lower** depth value are **closer** to the viewer. That means we want to sort the depth from **highest to lowest** before blending the colors together (think of blending as stacking colored transparent sheets. The "first" sheet will be at the bottom of the stack, therefore the farthest from the viewer and its color will be the least visible). By the way, the depth values go from 0.0 to 1.0.

For two layers sorting is pretty trivial with a simple if-branch. For six however, it gets complicated. We need a sorting algorithm to do the job. There are many sorting algorithm to pick for, and if you're a programmer chances are you've learned some of them. For this tutorial, we will simply use **insertion sort**, the same one used by mojang themselves in their fabulous graphics shader.

Let's create an array to contain our layers so we can sort them. We declare it outside, and specifically before, the `main()` function so that the content may be altered by our sorting function.

```glsl
const int array_length = 6; // GLSL arrays must be fixed-length

int current_length = 0; // The actual length of array

vec4[array_length] color_values;
float[array_length] depth_values;
```

Next, we will create the insertion sort function. There is nothing particularly interesting about this function, so I will put the explanation in the comments for those interested:

```glsl
// ... array definition goes here ...

void insert_sort(vec4 color, float depth)
{
  // Filter out fully transparent pixel
  if (color.a == 0.0) {
    return;
  }

  // Set the value at the next empty index
  color_values[current_length] = color;
  depth_values[current_length] = depth;

  // Store the index of the current item
  int current = current_length;
  // Store the index of the item before it
  int before = current_length - 1;

  // Only loop if there are items before current, and if the 
  // depth of the item before current is lower (closer)
  // because we want to short it from highest to lowest depth.
  while (current > 0 && depth_values[current] > depth_values[before]) {

    // Inside the loop, the item before is guaranteed to have
    // higher depth. Let's switch its place with the current item.
    vec4 temp_color = color_values[current];
    float temp_depth = depth_values[current];
    
    color_values[current] = color_values[before];
    depth_values[current] = depth_values[before];

    color_values[before] = temp_color;
    depth_values[before] = temp_depth;
    
    // We move to lower index
    current --;
    before --;
  }

  // Increment the length of the array
  current_length ++;
}

// ... void main() goes here ...
```

And now we sort the layers in `main()`. Note that the solid layer is special because we always want it to be in the array regardless of filtering:

```glsl
void main()
{
  // ... sampling code goes here ...

  // The solid layer is special. We don't want it to be
  // potentially rejected by the function.
  color_values[0] = main_color;
  depth_values[0] = main_depth;
  current_length = 1;

  insert_sort(translucent_color, translucent_depth);
  insert_sort(entity_color, entity_depth);
  insert_sort(weather_color, weather_depth);
  insert_sort(clouds_color, clouds_depth);
  insert_sort(particles_color, particles_depth);

}
```

And finally, now that the layers are sorted in the arrays, we blend them together. The blending function being used is "one, one minus source alpha." I don't actually know why and I can't explain why, but it's that way and it just works™️. It is again defined outside and before `main()`, and it looks like this:

```glsl
vec3 blend_colors(vec3 destination, vec4 source)
{
  return source.rgb + destination * (1.0 - source.a);
}
```

And then we blend the colors while iterating through the array in `main()`:

```glsl
void main()
{
  // ... sampling goes here ...
  
  // ... sorting goes here ...

  // Initialize color with the bottom layer
  vec3 composite_color = color_values[0].rgb;

  // Iterate through the array
  for(int i=1; i < current_length; i++){
    // Accumulate blended color
    composite_color = blend_colors(composite_color, color_values[i]);
  }

}
```

Finally, we write the composite color into the framebuffer:

```glsl
  // Alpha is mostly ignored, but we will set it to one
  // Some post-effects may require the alpha to be set to other value
  // For instance, FXAA3 expects the alpha to contain the luminance of this color
  gl_FragData[0] = vec4(composite_color, 1.0);
```

Your pipeline is now *fabulous*! Now test it and see if clouds and particles render behind stained glass and water.

If your pipeline fail to compile, check to see if you created the images and framebuffers for the layers properly. You can also obtain the source code of this tutorial up to this point by cloning this tutorial wiki (the wiki, not the main repo. You can get the `.git` url in the sidebar.) This will be our little secret :)
