/* One clock; periods use saved world days, physical geometry uses kilometres. */
export function celestialScales(config,physical=false,focus='world'){
 const scale=body=>({radius:physical?body.physicalRadiusKm/config.radiusKm:body.radiusRatio,
   orbit:physical?body.physicalOrbitKm/config.radiusKm:body.orbitRadius});
 const satellites=config.satellites.map(scale),planets=config.planets.map(scale);
 const star={radius:physical?config.star.physicalRadiusKm/config.radiusKm:config.star.radiusRatio,
   orbit:physical?config.star.physicalMainOrbitKm/config.radiusKm:config.star.orbitRadius};
 const moonEnvelope=Math.max(config.mainRing.enabled?config.mainRing.outerRadiusRatio:1,...satellites.map(body=>body.orbit+body.radius));
 let layoutPadding=0;
 if(!physical){
   // Keep local moon geometry and established body sizes. Place system bands
   // individually, so automatic framing cannot cancel a uniform expansion.
   const orbits=[star.orbit,...planets.map(body=>body.orbit)];
   planets.forEach((body,index)=>{
     const clearance=Math.min(body.orbit,...orbits.filter((_,other)=>other!==index+1).map(orbit=>Math.abs(orbit-body.orbit)));
     body.radius=Math.min(Math.sqrt(config.planets[index].physicalRadiusKm/config.radiusKm),
       clearance*.25/(config.planets[index].ring?2:1));
   });
   const innerEnvelope=Math.min(star.orbit-moonEnvelope,...planets.map((body,index)=>body.orbit-body.radius*(config.planets[index].ring?2:1)));
   star.radius=Math.max(config.star.radiusRatio,Math.min(Math.sqrt(config.star.physicalRadiusKm/config.radiusKm),innerEnvelope*.6));
   if(planets.length||star.orbit-moonEnvelope<=star.radius){
     layoutPadding=Math.max(2,Math.min(6,moonEnvelope));
     const bands=[{body:star,extent:moonEnvelope},...planets.map((body,index)=>
       ({body,extent:body.radius*(config.planets[index].ring?2:1)}))].sort((a,b)=>a.body.orbit-b.body.orbit);
     let previousOuter=star.radius;
     for(const {body,extent} of bands){
       body.orbit=Math.max(body.orbit+layoutPadding,previousOuter+layoutPadding+extent);
       previousOuter=body.orbit+extent;
     }
   }
 }
 return{mode:physical?'physical-kilometres':'schematic',scope:focus,worldRadius:1,star,satellites,planets,moonEnvelope,layoutPadding,
   systemOrbits:[{id:'main-world',orbit:star.orbit,extent:moonEnvelope},...planets.map((body,index)=>
     ({id:config.planets[index].id,orbit:body.orbit,extent:body.radius*(config.planets[index].ring?2:1)}))]};
}
export function orbitPosition(config,body,phase,physical=false,origin=[0,0,0],displayRadius=null){
  const tilt=body.inclinationDeg*Math.PI/180;
 const radius=displayRadius??(physical?body.physicalOrbitKm/config.radiusKm:body.orbitRadius);
  return[origin[0]+radius*Math.cos(phase),origin[1]+radius*Math.sin(phase)*Math.sin(tilt),origin[2]-radius*Math.sin(phase)*Math.cos(tilt)];
}

// Reopening a scene uses its saved day, phase and direction without rerolling.
export function displaySpinAngle(body,hours){
  return body.spinPhaseRad+(body.rotationDirection==='retrograde'?-1:1)*
    (hours%body.rotationPeriodHours)/body.rotationPeriodHours*Math.PI*2;
}

// The schematic view compresses a long lunar day to three world days so its
// surface visibly turns. Physical mode retains the saved synchronous period.
export function satelliteSpinPeriod(config,body,physical=false){
  return config.rotationPeriodHours*(physical?body.periodDays:Math.min(body.periodDays,3));
}
export function satelliteSpinAngle(config,body,hours,physical=false){
  const period=satelliteSpinPeriod(config,body,physical);
  return body.phaseRad+(hours%period)/period*Math.PI*2;
}

export function motionAt(config,hours,physical=false,scale=celestialScales(config,physical)){
  const day=config.rotationPeriodHours,sign=config.rotationDirection==='retrograde'?-1:1;
  const yearAngle=hours/(day*config.orbitalPeriodDays)*Math.PI*2;
 const mainRadius=scale.star.orbit;
  const star=[mainRadius*Math.cos(yearAngle),0,-mainRadius*Math.sin(yearAngle)];
 const position=(body,origin,mapped)=>{
    const phase=body.phaseRad+hours/(day*body.periodDays)*Math.PI*2;
   return{id:body.id,phase,position:orbitPosition(config,body,phase,physical,origin,mapped.orbit)};
  };
  return{spin:sign*hours/day*Math.PI*2,yearAngle,sun:[Math.cos(yearAngle),0,-Math.sin(yearAngle)],star,
    day:Math.floor(hours/day)+1,hour:((hours%day)+day)%day,
 moons:config.satellites.map((body,index)=>position(body,[0,0,0],scale.satellites[index])),
 planets:config.planets.map((body,index)=>position(body,star,scale.planets[index]))};
}

export function simulationClock(initialHours=0){
  let hours=initialHours,last=null;
  return{get hours(){return hours;},suspend(){last=null;},
    tick(now,hoursPerSecond){if(last!==null)hours+=Math.max(0,Math.min(.25,(now-last)/1000))*hoursPerSecond;last=now;return hours;}};
}
