# A pipeline? No, I wanted to make a shader pack!

It's the same thing! Shader packs are called **Pipelines** in Canvas. Although there are also material shaders pack, which is a different type of shader pack. In other words, there are actually two types of "shader packs" in Canvas:
* A set of material shaders.
* A pipeline - consisting of pipeline configuration(s) and pipeline shaders.

Both of these are loaded as minecraft resources contained in a resource pack. A resource pack isn't limited to one type of resource, that means a resource pack can contain both material shaders and pipelines! (That is right, pipelines with an "s".) Confused? You might want to refresh your knowledge on resource packs, but for the sake of this tutorial we're going to focus on **a single resource pack containing a single pipeline** (aka a "shader pack").

Specifically, we're going to make a **shadow-enabled pipeline** with **volumetric lights** and **translucency compositing**.

# First stop - the G-buffer

The G-buffer is the bread and butter of configurable pipelines. Think of all the cool effects you want in a shader pack: ssao, godrays, volumetric light, screen space reflection, and so on. All of these start with building the G-buffer. So what is the G-buffer?

The G-buffer ("graphics buffer") is a buffer that describes screen data represented as a texture. The G-buffer can contain as much information as the designer desires, but typically some essential components of the G-buffer are:
* Color
* Depth
* Normal
* Light / AO
* Material (Specular, Emissive, etc.)

For this tutorial we only need the **color** and **depth** informations in our G-buffer.

## Setting up a basic pipeline

## Defining the G-buffer

# Volumetric lights

# Compositing pass

# Fog pass

# Conclusion