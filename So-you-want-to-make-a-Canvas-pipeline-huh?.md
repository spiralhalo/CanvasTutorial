# A pipeline? No, I wanted to make a shader pack!

It's the same thing! Shader packs are called **Pipelines** in Canvas. Although there are also material shaders pack, which is a different type of shader pack. In other words, there are actually two types of "shader packs" in Canvas:
* A set of material shaders.
* A Pipeline - consisting of pipeline configuration(s) and pipeline shaders.

Both of these are loaded as minecraft resources contained in a resource pack. A resource pack isn't limited to one type of resource, that means a resource pack can contain both material shaders and pipelines! (That is right, pipelines with an "s".) Confused? You might want to refresh your knowledge on resource packs, but for the sake of this tutorial we're going to focus on **a single resource pack containing a single pipeline** (aka a "shader pack").

Specifically, we're going to make a **shadow-enabled pipeline** with **volumetric lights** and **translucency compositing**.

# First stop - the G-buffer

The G-buffer is the bread and butter of configurable pipelines. Think of all the cool effects you want in a shader pack: ssao, godrays, volumetric light, screen space reflection, and so on. All of these start with building the G-buffer. So what is the G-buffer?

The G-buffer ("graphics buffer") is a buffer that describes screen data represented as textures. The G-buffer can contain as much information as the designer desires, but typically some essential components of the G-buffer are:
* Color
* Depth
* Normal
* Light / AO
* Material (Specular, Emissive, etc.)

For this tutorial we only need the **color** and **depth** informations in our G-buffer.

## Setting up your project

Since a Canvas pipeline lives in a resource pack, begin by making a folder containing your resource pack. It's recommended to do it in the resourcepacks folder of the minecraft instance with Canvas installed so you may test your pipeline immediately.

Your project folder should have the following structure:

```
pack.mcmeta
pack.png (optional)
assets/
|_ tutorialpack/
  |_ pipeline_files/
     pipelines/
     shaders/
```

The `pack.mcmeta` file is the resource pack metadata. Consult the [minecraft wiki](https://minecraft.fandom.com/wiki/Tutorials/Creating_a_resource_pack#Creating_a_.MCMETA_file) on how it works.

You may name the folder `tutorialpack` with any pack name you want as long as it's likely to be unique and only contains alphanumeric characters and underscores. Note that for the rest of this tutorial this folder will be referred to as `tutorialpack` so keep that in mind if you decide to work with a unique folder name.

Another thing to note, the folders `pipeline_files` and `shaders` also don't have naming constraints. These are however the names that are used in Canvas's default pack so using the same naming system would make it easier to look things up inside Canvas's source code. (NB: Canvas actually use `pipeline` instead of `pipeline_files` but this is confusing due to the mandatory `pipelines` folder. Hence we will use `pipeline_files` for this tutorial.)

## Defining the G-buffer

Remember that our G-buffer consists of color and depth information. In the pipeline configuration, these will be defined as **Images** which are pipeline objects that represent textures in the back end.

First, make a json file called `main.json` inside your `pipeline_files` folder. The content of this file is a root object with an `images` **array** object inside it like this:

```json5
{
  images: [
     // content of images array goes here
  ]
}
```

NB: Canvas pipeline files uses Json5 so we don't need to put quotes around object names and we can use comments as well as trailing commas in our json files.

Next we will create our color information image inside our `images` array. This image will be a standard 24-bit RGBA format image (8-bit for each color + alpha). We will name our color image `main_color`, so the image object will look like this:

```json5
{
  name: "main_color",
  lod: 0,
  internalFormat: "RGBA8",
  pixelFormat: "RGBA",
  pixelDataType: "UNSIGNED_BYTE",
  target: "TEXTURE_2D",
  texParams: [
    {name: "TEXTURE_MIN_FILTER", val: "NEAREST"}, {name: "TEXTURE_MAG_FILTER", val: "NEAREST"},
    {name: "TEXTURE_WRAP_S", val: "CLAMP"}, {name: "TEXTURE_WRAP_T", val: "CLAMP"}
  ]
}
```

You don't need to worry about the specifics of these formats for now. Their purpose is to define a complete texture in OpenGL. You will learn more about them as you continue your OpenGL adventures!

Next we'll add the depth image into our `images` array. In case you are unfamiliar with json, items inside an array are separated by a comma (`,`). Anyhow, unlike the color image, the depth only contains one depth value represented in 32-bit float. The depth image object will look like this:

```json5
{
  name: "main_depth",
  lod: 0,
  internalFormat: "DEPTH_COMPONENT",
  pixelFormat: "DEPTH_COMPONENT",
  pixelDataType: "FLOAT",
  target: "TEXTURE_2D",
  texParams: [ 
    {name: "TEXTURE_MIN_FILTER", val: "NEAREST"}, {name: "TEXTURE_MAG_FILTER", val: "NEAREST"},
    {name: "TEXTURE_WRAP_S", val: "CLAMP"}, {name: "TEXTURE_WRAP_T", val: "CLAMP"},
    {name: "TEXTURE_COMPARE_MODE", val: "NONE"}
  ]
}
```

Note that the depth image has one more `texParams` component called `TEXTURE_COMPARE_MODE`. This is mostly used for shadowmaps. Since we're making a regular depth image, we want to set this to `NONE`.

Finally, we will add these images into our G-buffer. The G-buffer itself is defined as a **Framebuffer** object. The color and depth images that we've created will be attached to the G-buffer framebuffer object.

Just like with the images, we first need to create a `framebuffers` array inside our `main.json` file. The order doesn't matter but we will create it under our images array like this:


```json5
{
  images: [
     // content of images array goes here
  ],

  framebuffers: [
     // content of framebuffers array goes here
  ]
}
```

Now we will define the G-buffer object inside the `framebuffers` array and attach the color and depth images. The color Image will be attached as a color attachment while the depth Image will be attached as a depth attachment. Note that depth attachments are special; you may attach as many color attachments as you want, but a framebuffer may only have one depth attachment. Our G-buffer object will look like this:

```json5
{
  name: "main_gbuffer",
  depthAttachment: {image: "main_depth", clearDepth: 1.0},
  colorAttachments: [
    {image: "main_color", clearColor: 0x00000000}
  ]
}
```

And we're finally done with our g-buffer! The final content of your main.json file should look like this:

```json5
{
  images: [
    {
      name: "main_color",
      lod: 0,
      internalFormat: "RGBA8",
      pixelFormat: "RGBA",
      pixelDataType: "UNSIGNED_BYTE",
      target: "TEXTURE_2D",
      texParams: [
        {name: "TEXTURE_MIN_FILTER", val: "NEAREST"}, {name: "TEXTURE_MAG_FILTER", val: "NEAREST"},
        {name: "TEXTURE_WRAP_S", val: "CLAMP"}, {name: "TEXTURE_WRAP_T", val: "CLAMP"}
      ]
    },

    {
      name: "main_depth",
      lod: 0,
      internalFormat: "DEPTH_COMPONENT",
      pixelFormat: "DEPTH_COMPONENT",
      pixelDataType: "FLOAT",
      target: "TEXTURE_2D",
      texParams: [ 
        {name: "TEXTURE_MIN_FILTER", val: "NEAREST"}, {name: "TEXTURE_MAG_FILTER", val: "NEAREST"},
        {name: "TEXTURE_WRAP_S", val: "CLAMP"}, {name: "TEXTURE_WRAP_T", val: "CLAMP"},
        {name: "TEXTURE_COMPARE_MODE", val: "NONE"}
      ]
    }
  ],

  framebuffers: [
    {
      name: "main_gbuffer",
      depthAttachment: {image: "main_depth", clearDepth: 1.0},
      colorAttachments: [
        {image: "main_color", clearColor: 0x00000000}
      ]
    }
  ]
}
```

# Making the pipeline shader program

## Testing your first render

# Adding sky shadows

# Adding a volumetric lights pass

# Compositing pass

# Fog pass

# Conclusion