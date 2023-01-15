# 5: Compositing and advanced translucency

**..is just a fancy way to say fabulous graphics mode.**

You may have heard of it; fabulous graphics is a new graphics mode introduced in 1.16 that allows particles and cloud to be rendered behind water and stained glass, or more generally translucent object. It is also called "advanced translucency" in Canvas's codebase for that reason.

Basically, fabulous graphics mode let us render translucent objects to separate layers and composite them into a single frame image. The "rendering into separate layers" part is just pipeline specifications, but the compositing part will be done in shaders.

This is quite an elaborate process, so for the first time, we will divide the content of this chapter into subchapters:

1. Setting up fabulous graphics and composite passes
2. Writing the vertex and fragment shaders for the composite passes

# 5-1: Setting up fabulous graphics and composite passes

## Setting up the pipeline to render to multiple layers

### Creating the framebuffers

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
5. `clouds`    -> these two are plural for
6. `particles` -> some reason, remember it!

Due to how verbose this part is, we will actually create an entire folder just for it!

In the `pipeline_files` folder, create a new folder called `fabulous`. What you want to do now is copy the file `main.json` into it five times and rename the copies into the names of the corresponding layers. Since the solid terrain is special somehow (it's also the main render target for uncategorized stuff) we will keep it called `main.json` and keep it outside of the `fabulous` folder.

Once you have done that, we will group the files together. Create a file called `fabulous_layers.json` in `pipeline_files`. The content of this file is simply importing the contents of the layer configuration files like this:

```json5
{
  include: [
    "tutorialpack:pipeline_files/fabulous/translucent.json",
    "tutorialpack:pipeline_files/fabulous/entity.json",
    "tutorialpack:pipeline_files/fabulous/weather.json",
    "tutorialpack:pipeline_files/fabulous/clouds.json",
    "tutorialpack:pipeline_files/fabulous/particles.json"
  ]
}

```

And finally we import the `fabulous_layers.json` file itself in our main pipeline configuration file (`tutorial_pipeline.json`). At the end of this section, your pipeline file tree structure should look like this:

```json5
pipeline_files
|_ fabulous_layers.json // ... NEW!
   main.json
   skyshadow.json
   fabulous // ............... NEW!
   |_ translucent.json // .... NEW!
   |_ entity.json // ......... NEW!
   |_ weather.json // ........ NEW!
   |_ clouds.json // ......... NEW!
   |_ particles.json // ...... NEW!

pipeline
|_ tutorial_pipeline.json
```

### Setting the framebuffers as the render targets

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

### Clearing the new framebuffers before each frame

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

> **Pro-tip:** You don't need the copy pass when you have **even** number of `fabulous` passes. However using the copy pass anyway makes it easier to debug and reorganize when necessary. The copy pass is used to avoid the dreadful situation where you read from and write to the same texture, which causes many nightmareish side effects.

### Creating the shader program configurations

We need to create new shader programs for our frame passes, namely the composite program and the copy program.

A program requires a framebuffer to write into, and a framebuffer requires image attachments. This might get complicated, so let's create our configurations in a new file in `pipeline_files` called `composite.json`.

The contents of this file should feel a bit familiar with how much work we've been doing with Canvas so far. In this file, we'll create arrays to store our images, framebuffers, and programs:

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

Next, we will create the composite and copy programs. The copy program isn't necessarily composite-related, so you might move it out later but for the length of this tutorial we will leave it here for simplicity.

In any case, our programs look like this:

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

Finally, we will import the `composite.json` file into our `tutorial_pipeline.json` file and we're done with the program configurations.

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
    "tutorialpack:pipeline_files/fabulous_layers.json",
    "tutorialpack:pipeline_files/composite.json",
    "tutorialpack:pipeline_files/passes.json"
  ]
``` 

> **Quick tip:** the order of inclusion usually doesn't matter, except for files with passes (like `passes.json` in this case) as it affects the ordering of the passes.

And your pipeline file tree structure should look like this:

```json5
pipeline_files
|_ composite.json // ... NEW!
   fabulous_layers.json
   main.json
   passes.json // ...... NEW!
   skyshadow.json
   fabulous
   |_ translucent.json
   |_ entity.json
   |_ weather.json
   |_ clouds.json
   |_ particles.json

pipeline
|_ tutorial_pipeline.json
```

In the next sub-chapter we will finally be writing some shaders for copy and composite passes. For now, take a break!
