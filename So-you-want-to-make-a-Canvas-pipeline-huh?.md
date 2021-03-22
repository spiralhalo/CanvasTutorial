# A pipeline? No, I want to make a shader pack!

It's the same thing! Shader packs are called **Pipelines** in Canvas. Although there are also material shaders pack, which is a different type of shader pack. In other words, there are actually two types of "shader packs" in Canvas:
* A set of material shaders.
* A Pipeline - consisting of pipeline configuration(s) and pipeline shaders.

Both of these are loaded as minecraft resources contained in a resource pack. A resource pack isn't limited to one type of resource, that means a resource pack can contain both material shaders and pipelines! (That is right, pipelines with an "s".) Confused? You might want to refresh your knowledge on resource packs, but for the sake of this tutorial we're going to focus on **a single resource pack containing a single pipeline** (aka a "shader pack").

Specifically, we're going to make a **shadow-enabled pipeline** with **volumetric lights** and **translucency compositing** from scratch. That is right, from scratch! Well, almost from scratch due to the code examples, but we won't be using Canvas's default pipeline because the goal of this tutorial is to teach basic understanding of how the entire pipeline is built from start to finish.

# Table of Contents

### [1: First stop: the G buffer](https://github.com/spiralhalo/CanvasTutorial/wiki/1:-First-stop:-the-G-buffer)
### [2: Making the pipeline shader](https://github.com/spiralhalo/CanvasTutorial/wiki/2:-Making-the-pipeline-shader)
### 3: Shading: using vanilla lighting data
### 4: Adding sky shadows
### 5: Adding a volumetric lights pass
### 6: Compositing pass and fabulousness
### 7: Fog pass
### Conclusion