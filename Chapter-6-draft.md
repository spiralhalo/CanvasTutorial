since we're setting the G-buffer as the fabulous target, we want to create a separate framebuffer for the default target.

Create a new framebuffer called `default_fb` in the `main.json` pipeline file. The attachments of this framebuffer is the same as the G-buffer, except we don't want to set any clear flags:

```json5
  {
    name: "default_fb",
    depthAttachment: {image: "main_depth"},
    colorAttachments: [{image: "main_color"}]
  }
```

And finally, we replace the default framebuffer as well as the default draw targets with the new `default_fb` framebuffer:

```json5
  drawTargets: {
    solidTerrain: "default_fb",
    translucentTerrain: "default_fb",
    translucentEntity: "default_fb",
    weather: "default_fb",
    clouds: "default_fb",
    translucentParticles: "default_fb"
  },

  // ...

  defaultFramebuffer: "default_fb",
```
