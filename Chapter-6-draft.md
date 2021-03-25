**UNDER CONSTRUCTION**

**OUT OF DATE INFORMATION**

**USED TO BE CHAPTER 5 BUT I DECIDED TO MOVE IT TO CHAPTER 6**

**GO BACK TO CHAPTER 5 FOR NOW**

One great thing about having a shadow map is that we could now implement volumetric lighting in addition to shadows.

It's also the part where we will add a post-effect pass into our pipeline. Also known as a **full-frame pass**, because in this pass we will no longer be working with raw world geometry; we only have the **frame data** that has been written to the G-buffer to work with. It is where the G-buffer shines!

Adding a separate full-frame pass for the first time in addition to implementing volumetric lighting is no trivial matter. A lot of brand new topic will be covered in this chapter so be advised that it will be the most jam-packed and complex chapter so far. Here are the things that we will be learning in this chapter:

* Setting up fabulous graphics mode
* Setting up a full frame pass and add it to the pipeline
* What volumetric lighting is and how it might work
* What raymarching is and how to implement it in fragment shader
* What coordinate spaces are and how to transform positions between them
* Implementing volumetric lighting in our full frame pass

Whew, that's a lot! I will separate this chapter into 3 sub-chapters in order to avoid information overload:

1. Setting up the full-frame pass
2. Writing a volumetric light fragment shader
3. Testing and finalizing the volumetric lighting pass

Feel free to take breaks between sub-chapters. You will need it!

Move on to chapter 5.1 when you're ready to learn!

# 5.1: Setting up the full-frame pass
## Setting up fabulous graphics mode



Why fabulous graphics mode is relevant right now is because the fabulous graphics pass happens before hand rendering. Hand rendering completely overwrites the depth buffer and we need that for our full frame pass. To put it simply, we can't have volumetric lighting without fabulous graphics mode enabled.



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
