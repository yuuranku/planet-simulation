// Linear-light surface response. The ocean's unresolved waves are represented
// by a rough microfacet distribution, rather than visible globe-sized ripples.
export const naturalSurfaceLightingGLSL=`
const float ATLAS_SURFACE_PI=3.141592653589793;
float atlasSurfaceFresnel(float cosine,float f0){
  return f0+(1.0-f0)*pow(1.0-clamp(cosine,0.0,1.0),5.0);
}
float atlasSurfaceGGX(float noL,float noV,float noH,float roughness){
  float alpha=roughness*roughness,alpha2=alpha*alpha;
  float denominator=noH*noH*(alpha2-1.0)+1.0;
  float distribution=alpha2/(ATLAS_SURFACE_PI*denominator*denominator);
  float lightMask=noV*sqrt(alpha2+(1.0-alpha2)*noL*noL);
  float viewMask=noL*sqrt(alpha2+(1.0-alpha2)*noV*noV);
  return distribution*.5/max(lightMask+viewMask,0.00001);
}
vec3 atlasSurfaceSky(vec3 radial,vec3 reflected,vec3 sun,vec2 uv){
  float altitude=max(0.0,dot(radial,reflected));
  float daylight=smoothstep(-.08,.3,dot(radial,sun));
  vec3 sky=mix(vec3(.12,.20,.30),vec3(.014,.040,.085),sqrt(altitude));
  // Reflection meets the moving world cloud layer, with a bounded offset.
  // It is deliberately soft at this orbital scale; individual waves are subpixel.
  vec3 east=cross(atlasReliefNorth,radial);east/=max(length(east),.00001);
  vec3 north=cross(radial,east);
  float latitude=(uv.y-.5)*ATLAS_SURFACE_PI;
  float travel=.003/max(.06,altitude);
  vec2 offset=vec2(dot(reflected,east)/(2.0*ATLAS_SURFACE_PI*max(.15,cos(latitude))),
    dot(reflected,north)/ATLAS_SURFACE_PI)*travel;
  float cloud=atlasCloudDensity(uv+offset);
  sky=mix(sky,vec3(.36,.37,.38),smoothstep(.12,.7,cloud)*.75);
  return sky*daylight;
}
vec3 atlasSurfaceLight(vec3 albedo,vec3 radial,vec3 view,vec3 sun,
    float starDistance,vec2 uv,float liquid){
  vec3 normal=normalize(mix(atlasReliefNormal(radial),radial,liquid));
  float noL=max(0.0,dot(normal,sun)),noV=max(.0001,dot(normal,view));
  float macroDay=dot(radial,sun);
  float diffuse=mix(atlasSolarDiffuse(macroDay),atlasSolarDiffuse(dot(normal,sun)),
    smoothstep(0.0,.06,macroDay));
  float visible=atlasRingTransmission(radial,sun,starDistance)*atlasCloudTransmission(uv);
  vec3 halfVector=sun+view;
  vec3 halfDirection=halfVector*inversesqrt(max(dot(halfVector,halfVector),.00000001));
  float noH=max(0.0,dot(normal,halfDirection)),voH=max(0.0,dot(view,halfDirection));
  float latitude=(uv.y-.5)*ATLAS_SURFACE_PI,longitude=uv.x*2.0*ATLAS_SURFACE_PI;
  vec3 local=vec3(cos(latitude)*cos(longitude),sin(latitude),cos(latitude)*sin(longitude));
  // Spatial wind variation controls statistical roughness, not painted waves.
  float wind=.5+.25*sin(local.x*11.0+local.z*7.0)+.25*sin(local.y*17.0-local.x*9.0);
  float roughness=mix(.86,mix(.28,.36,wind),liquid);
  float fresnel=atlasSurfaceFresnel(voH,mix(.035,.0204,liquid));
  float specular=atlasSurfaceGGX(noL,noV,noH,roughness)*fresnel*noL;
  specular*=smoothstep(-.005,.02,macroDay)*visible*ATLAS_SURFACE_PI;
  // The low Sun reaches the surface through a longer atmospheric path.
  // Warm the existing direct light rather than painting a fixed orange band.
  float twilight=1.0-smoothstep(.02,.20,abs(macroDay));
  vec3 sunColor=mix(vec3(1.0,.43,.20),vec3(1.0,.975,.94),smoothstep(0.0,.28,macroDay));
  float skyFill=.001+.055*smoothstep(-.12,.3,macroDay);
  vec3 skyTint=mix(vec3(.76,.86,1.0),vec3(1.0,.52,.32),twilight*.65);
  float terrainVisibility=liquid<.999?1.0-(1.0-liquid)*atlasReliefOcclusion():1.0;
  vec3 result=albedo*((1.0-fresnel)*diffuse*visible*sunColor+skyFill*skyTint*terrainVisibility);
  result+=sunColor*specular;
  float reflectedFresnel=atlasSurfaceFresnel(noV,.0204);
  result+=liquid*reflectedFresnel*atlasSurfaceSky(radial,reflect(-view,normal),sun,uv);
  return result;
}
vec3 atlasNaturalSurfaceLight(vec3 albedo,vec3 radial,vec3 view,vec3 sun,
    float starDistance,vec2 uv){
  return atlasSurfaceLight(albedo,radial,view,sun,starDistance,uv,
    clamp(texture2D(atlasWaterTexture,uv).r,0.0,1.0));
}`;
