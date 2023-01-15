# 3-α: Miscellaneous vanilla effects

We've implemented vanilla lighting and make our pipeline playable with, but we still need to apply certain minecraft effects in shader, namely:
* TNT / thunder Flash
* Hurt flash
* Enchantment glint

For the last item we want to apply the glint texture, so we need to make the glint texture accessible to our shader somehow. Luckily, Canvas provides us a way to access any texture we want to without limits.

When a shader has access to a texture, it is bound as a **sampler**. A texture sampler is a type in GLSL that refers to the entire mip chain of an image, but we don't need to worry about that right now. For now, all we need to know is that samplers let us access any texture we want.

To begin with, navigate to `assets/tutorialpack/pipelines/tutorialpack.json5`. Recall what we originally wrote: 

```json5
  materialProgram: {
    vertexSource: "tutorialpack:shaders/gbuffer/main.vert",
    fragmentSource: "tutorialpack:shaders/gbuffer/main.frag",
    samplers: [],
    samplerImages: []
  },
```

You might notice that the `samplers` and `samplerImages` array are empty. Well, we're about to fit that.

In any program, the `samplers` array refers to the sampler name to bind the texture to. In the shader, this is just the name of the sampler you declare. The `samplerImages` array refers to the actual images or textures that you are sampling. These arrays are order-sensitive, the order in `samplers` must correspond with `samplerImages` so Canvas knows what images to give you.

In the `samplers` array, add a new item `"u_glint"`; in the `samplerImages`, add a new item `"minecraft:textures/misc/enchanted_item_glint.png"`. This makes sure that sampling `u_glint` will sample minecraft's enchantment glint.

> **Pro tip**: You might have guessed that you can make that file path point to any texture you want, and you would be right! This is useful for getting custom noise textures and other textures you'd want to precompte.

Now, navigate to `main.frag`. Samplers can be accessed from both the vertex and the fragment shader, but for now we only need it in the fragment shader.

As a preface, we will want to add an extra include that contains a useful function we will use for applying enchantment glint. Navigate to where you included the pipeline fragment utilities, and add two new include:
```glsl
#include frex:shaders/api/world.glsl
#include frex:shaders/api/sampler.glsl
```

Now, we will add the glint itself. You can declare your samplers anywhere you want in the global scope, but I prefer to put them directly after the includes. The sampler is declared as follows:

```glsl
// ... includes go here ...

uniform sampler2D u_glint;

// ... out variables go here ...
```

Note that the name of the sampler is the same as the name we decided upon in our pipeline JSON. You must make sure the names match, or you might sample a wrong texture or none at all!

Now that we have access to the enchantment glint texture, we need to apply it. For this, we add the following code to just before writing into the G-buffer:

```glsl
  // Apply glint effect if the material is specified to have glint
  if(frx_matGlint == 1) {
    // Sample the glint texture and animate it
    vec3 glint = texture(u_glint, fract(frx_normalizeMappedUV(frx_texcoord) * 0.5 + frx_renderSeconds * 0.1)).rgb;

    // Apply the glint to the color
    glint = pow(glint, vec3(4.0));
    color.rgb += glint;
  }

  // ... writing to the G-buffer goes here ...
```

With that out of the way, let's deal with the easier effects: hurt effect and flash effect. 

```glsl
  // ... applying glint goes here ...

  // Apply hurt effect if the material is specified to have hurt
  if(frx_matHurt == 1) {
    color.gb *= 0.1;
  }

  // Apply flash effect if the material is specified to be flashing
  if(frx_matFlash == 1) {
    color.rgb = vec3(1.0);
  }

  // ... writing to the G-buffer goes here ...
```

And that's it! Note that this code can be optimized and changed up; feel free to modify these operations to obtain different customized result if you want. You can event write your own glint shader if you feel adventurous.
