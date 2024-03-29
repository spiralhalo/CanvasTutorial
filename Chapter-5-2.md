
# 5-2: Writing the vertex and fragment shaders for the composite passes

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

in vec4 in_vertex;
in vec2 in_uv;

uniform mat4 frxu_frameProjectionMatrix;

out vec2 texcoord;

void main() {
    vec2 screen = (frxu_frameProjectionMatrix * vec4(in_vertex.xy * frxu_size, 0.0, 1.0)).xy;

    gl_Position = vec4(screen, 0.2, 1.0);
    texcoord = in_uv;
}
```

Notice that since the frame shaders shaders aren't interfaced, our shader code directly goes in OpenGL's `void main()` function.

Essentially, what this shader does is placing the vertexes on the corners of the screen and then outputting the texture coordinates.

> **IMPORTANT NOTE**: Sometimes your vertex input declaration (`in vec2 in_uv`) might fail due to conflict with Canvas's internal code. This happens when importing `frex:shaders/api/world.glsl`. This is likely a bug and not intended. If this happens you should remove your own input declaration.

### Creating the copy fragment shader

Let's create the copy fragment shader first because it's easier. As a matter of fact, we just need to create a file named `copy.frag` in the `post` folder, and put the following:

```glsl
#include tutorialpack:shaders/post/header.glsl

uniform sampler2D u_source;

in vec2 texcoord;

layout(location = 0) out vec4 fragColor;

void main() {
  fragColor = texture(u_source, texcoord);
}
```

All this shader does is sample the source texture using the texture coordinates input from the vertex shader and then writing it into the color attachment. Simple!

### Writing the composite fragment shader

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

in vec2 texcoord; // texture uv coordinate input

layout(location = 0) out vec4 fragColor; // fragment color output

void main()
{
  vec4  main_color        = texture(u_main_color       , texcoord);
  float main_depth        = texture(u_main_depth       , texcoord).r;
  vec4  translucent_color = texture(u_translucent_color, texcoord);
  float translucent_depth = texture(u_translucent_depth, texcoord).r;
  vec4  entity_color      = texture(u_entity_color     , texcoord);
  float entity_depth      = texture(u_entity_depth     , texcoord).r;
  vec4  weather_color     = texture(u_weather_color    , texcoord);
  float weather_depth     = texture(u_weather_depth    , texcoord).r;
  vec4  clouds_color      = texture(u_clouds_color     , texcoord);
  float clouds_depth      = texture(u_clouds_depth     , texcoord).r;
  vec4  particles_color   = texture(u_particles_color  , texcoord);
  float particles_depth   = texture(u_particles_depth  , texcoord).r;

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

Now that we've sampled them, the next step is to **sort them by depth**. Fragments have **lower** depth when they are **closer** to the viewer so we need to sort it from **highest to lowest** before blending the colors together.

Sorting is trivial for two layers using just a simple if-branch. For six, we need a sorting algorithm to do the job, one that is fast and able to run on the GPU. **Insertion sort** fits that role perfectly. It is also the algorithm used by Mojang in their fabulous graphics shader.

Let's create an array to contain our layers so we can sort them. We declare it outside and before the `main()` function so they are scoped globally:

```glsl
const int array_length = 6; // GLSL arrays must be fixed-length

int current_length = 0; // The actual length of array

vec4[array_length] color_values;
float[array_length] depth_values;
```

Next, we will create the insertion sort function. Explaining insertion sort is a bit out of topic for this tutorial, so I just put it in the comments for those who need it:

```glsl
// ... array definition goes here ...

void insert_sort(vec4 color, float depth) {
  // Filter out fully transparent pixel
  if (color.a == 0.0) {
    return;
  }

  // Store the values at the next empty index
  color_values[current_length] = color;
  depth_values[current_length] = depth;

  // Store the index of the current item
  int current = current_length;
  // Store the index of the item before it
  int before = current_length - 1;

  // Increment the length of the array
  current_length ++;

  // Loop while there is an item before the current one
  // and if that item, importantly, has a lower depth.
  while (current > 0 && depth_values[current] > depth_values[before]) {

    // Swap the current item with the item before it
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

And finally, now that the layers are sorted in the arrays, we blend them together. The blending function being used is "one, one minus source alpha." This is simply linear interpolation. If you wish, you can try more advanced types of blending than alpha blending such as multiplicative blending, but that is out of scope for this tutorial. It is again defined outside and before `main()`, and it looks like this:

```glsl
vec3 blend_colors(vec3 destination, vec4 source) {
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
  vec3 composite = color_values[0].rgb;

  // Iterate through the array
  for(int i=1; i < current_length; i++){
    // Accumulate blended color
    composite = blend_colors(composite, color_values[i]);
  }

}
```

Finally, we write the composite color into the framebuffer:

```glsl
  // Alpha is mostly ignored, but we will set it to one
  // Some post-effects may require the alpha to be set to other value
  // For instance, FXAA3 expects the alpha to contain the luminance of this color
  fragColor = vec4(composite, 1.0);
```

Your pipeline is now *fabulous*! Now test it and see if clouds and particles render behind stained glass and water.

If your pipeline fail to compile, check to see if you created the images and framebuffers for the layers properly.You can also obtain the source code of this tutorial up to this point by cloning this tutorial wiki (the wiki, not the main repo. You can get the `.git` url in the sidebar.) This will be our little secret.

TODO: update source code 

![winktater](winktater.png)
