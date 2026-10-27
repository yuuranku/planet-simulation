/* One saved star position. Analytic sphere/annulus tests avoid six point-light shadow passes. */
export const solarLightingGLSL = `
uniform vec3 atlasStarPosition;
uniform float atlasSolarDiskRadius;
uniform float atlasSolarTangent;
float atlasSolarDiffuse(float cosine) {
  float width=max(0.00001,atlasSolarDiskRadius);
  if(cosine<=-width)return 0.0;
  if(cosine>=width)return cosine;
  // Integrate max(0,N.L) over a uniformly bright small solar disk.
  float x=cosine/width,edge=sqrt(max(0.0,1.0-x*x));
  return (cosine*(acos(-x)+x*edge)+(2.0*width/3.0)*edge*edge*edge)/3.141592653589793;
}
float atlasSphereVisibility(vec3 point,vec3 center,float radius,vec3 direction,float lightDistance) {
  vec3 toCenter=center-point;
  float along=dot(toCenter,direction);
  if(along<=0.0||along>=lightDistance)return 1.0;
  float separationSquared=max(0.0,dot(toCenter,toCenter)-along*along);
  float penumbra=max(radius*0.001,along*atlasSolarTangent);
  float lower=radius-penumbra,upper=radius+penumbra;
  if(lower>0.0&&separationSquared<=lower*lower)return 0.0;
  if(separationSquared>=upper*upper)return 1.0;
  return smoothstep(lower,upper,sqrt(separationSquared));
}`;

export const ringLightingGLSL = `
uniform sampler2D atlasRingTexture;
uniform float atlasRingTextureReady;
vec4 atlasRingSample(float radial) {
  if(atlasRingTextureReady<0.5)return vec4(0.0);
  return texture2D(atlasRingTexture,vec2(clamp(radial,0.0,1.0),0.5));
}`;

export const ringShadowGLSL = `
uniform float atlasRingEnabled;
uniform vec3 atlasRingCenter;
uniform vec3 atlasRingNormal;
uniform float atlasRingInner;
uniform float atlasRingOuter;
float atlasRingTransmission(vec3 point,vec3 ray,float lightDistance) {
  if(atlasRingEnabled<0.5)return 1.0;
  float incidence=dot(ray,atlasRingNormal);
  if(abs(incidence)<0.00001)return 1.0;
  float along=dot(atlasRingCenter-point,atlasRingNormal)/incidence;
  if(along<=0.001||along>=lightDistance)return 1.0;
  vec3 inPlane=point+along*ray-atlasRingCenter;
  float radius=length(inPlane);
  float radialStretch=sqrt(1.0+pow(dot(inPlane/max(radius,0.00001),ray)/incidence,2.0));
  // First-order cone/plane projection. Limit its singular, near-parallel
  // regime at the finite solar-disk scale instead of darkening the globe.
  radialStretch=min(radialStretch,1.0/max(2.0*atlasSolarDiskRadius,abs(incidence)));
  float penumbra=max(0.001,along*atlasSolarTangent*radialStretch);
  if(radius<=atlasRingInner-penumbra||radius>=atlasRingOuter+penumbra)return 1.0;
  float footprint=smoothstep(atlasRingInner-penumbra,atlasRingInner+penumbra,radius)
      *(1.0-smoothstep(atlasRingOuter-penumbra,atlasRingOuter+penumbra,radius));
  float radial=(radius-atlasRingInner)/(atlasRingOuter-atlasRingInner);
  float blur=penumbra/(atlasRingOuter-atlasRingInner);
  float density=0.25*atlasRingSample(radial-blur).a+0.5*atlasRingSample(radial).a+0.25*atlasRingSample(radial+blur).a;
  return 1.0-footprint*(1.0-pow(max(0.02,1.0-density),1.0/max(0.08,abs(incidence))));
}`;

export function solarAngularRadius(config,distanceKm){
  return Math.asin(Math.min(1,config.star.physicalRadiusKm/distanceKm));
}
