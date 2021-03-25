# 3-α: Miscellaneous vanilla effects

We've implemented vanilla lighting and make our pipeline playable with, but we still need to apply certain minecraft effects in shader, namely:
* TNT / thunder Flash
* Hurt flash
* Enchantment glint

For the last item we want to apply the glint texture, but unfortunately Canvas doesn't support it at the moment. Instead we will use the Lumi Lights shader implementation of glint.

Let's create a folder called `lib` in our `shaders` folder to store our library files.

Create a file called `glintify.glsl` in the `lib` folder. Copy the content of [Lumi Lights glintify.glsl file](https://github.com/spiralhalo/LumiLights/blob/wip/assets/lumi/shaders/lib/glintify.glsl) into this file.

Import this file into our fragment shader by adding the following right after the other `#include` statements:
```glsl
#include tutorialpack:shaders/lib/glintify.glsl
```

Now we add the following code to just before writing into the G-buffer:

```glsl
  // Apply flash and hurt effect
  if (frx_matFlash()) {
    color.rgb = color.rgb * 0.25 + 0.75;
  } else if (frx_matHurt()) {
    color.rgb = vec3(0.25, 0.0, 0.0) + color.rgb * 0.75;
  }

  // Apply glint shader
  color.rgb += noise_glint(frx_normalizeMappedUV(frx_texcoord), frx_matGlint());

  // ... writing to the G-buffer goes here ...
```

And that's it. Feel free to modify these operations to obtain different customized result if you want. You can event write your own glint shader if you feel adventurous.
