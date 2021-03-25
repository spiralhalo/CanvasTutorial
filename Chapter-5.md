# 5: Adding a volumetric lighting pass

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
