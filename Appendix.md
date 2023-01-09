# Appendix: Revision history

The full edit history of this tutorial can be seen by cloning the git repo.

This page specifically list changes that are crucial to the tutorial content, in case earlier learners are interested in learning new things that might be added as Canvas or my understanding of shader changes without having to scan through the entire thing.

## March 25, 2021

Due to the update to 1.17 and subsequently Core OpenGL 3.2, the `varying` keyword will no longer be used in Canvas's codebase. References to varyings in this tutorial has been updated by the more modern concept of input and output.

## April 10, 2021

Late update with the same reason as above. `gl_FragData` is also removed from core OpenGL. Instead, use output variables to output fragment color into the framebuffer color attachments. Here is how:

```glsl
// Add this next to the inputs on the top of fragment shaders

out vec4 fragColor; // This is for single output

// out vec4[2] fragColor; // Use this if you have 2 outputs
// out vec4[3] fragColor; // Use this if you have 3 outputs, etc...


// ...



// Finally, replace gl_FragData[0] with fragColor

// gl_FragData[0] = color; // <- the old version
fragColor = color; // <- the new version

// if your framebuffer has multiple color attachments, do this instead:
// fragColor[0] = color1;
// fragColor[1] = color2;
// fragColor[2] = color3; // etc...

```

## January 9, 2023

My (Ambrosia) attempt to update this to the latest Canvas specifications, specifically FREX 6 and Canvas 1.18+.