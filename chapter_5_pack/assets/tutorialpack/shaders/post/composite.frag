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

in vec2 v_texcoord;

const int array_length = 6; // GLSL arrays must be fixed-length

int current_length = 0; // The actual length of array

vec4[array_length] color_values;
float[array_length] depth_values;

void insert_sort(vec4 color, float depth)
{
  // Filter out fully transparent pixel
  if (color.a == 0.0) {
    return;
  }

  // Set the value at the next empty index
  color_values[current_length] = color;
  depth_values[current_length] = depth;

  // Store the index of the current item
  int current = current_length;
  // Store the index of the item before it
  int before = current_length - 1;

  // Only loop if there are items before current, and if the 
  // depth of the item before current is lower (closer)
  // because we want to short it from highest to lowest depth.
  while (current > 0 && depth_values[current] > depth_values[before]) {

    // Inside the loop, the item before is guaranteed to have
    // higher depth. Let's switch its place with the current item.
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

  // Increment the length of the array
  current_length ++;
}

vec3 blend_colors(vec3 destination, vec4 source)
{
  return source.rgb + destination * (1.0 - source.a);
}

void main()
{
  vec4  main_color        = texture2D(u_main_color       , v_texcoord);
  float main_depth        = texture2D(u_main_depth       , v_texcoord).r;
  vec4  translucent_color = texture2D(u_translucent_color, v_texcoord);
  float translucent_depth = texture2D(u_translucent_depth, v_texcoord).r;
  vec4  entity_color      = texture2D(u_entity_color     , v_texcoord);
  float entity_depth      = texture2D(u_entity_depth     , v_texcoord).r;
  vec4  weather_color     = texture2D(u_weather_color    , v_texcoord);
  float weather_depth     = texture2D(u_weather_depth    , v_texcoord).r;
  vec4  clouds_color      = texture2D(u_clouds_color     , v_texcoord);
  float clouds_depth      = texture2D(u_clouds_depth     , v_texcoord).r;
  vec4  particles_color   = texture2D(u_particles_color  , v_texcoord);
  float particles_depth   = texture2D(u_particles_depth  , v_texcoord).r;

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
  
  // Initialize color with the bottom layer
  vec3 composite_color = color_values[0].rgb;

  // Iterate through the array
  for(int i=1; i < current_length; i++){
    // Accumulate blended color
    composite_color = blend_colors(composite_color, color_values[i]);
  }
  
  gl_FragData[0] = vec4(composite_color, 1.0);
}
