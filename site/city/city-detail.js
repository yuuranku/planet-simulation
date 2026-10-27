/* Pure city planning and detached SVG drawing for World Atlas recipes. */
(function (global) {
  "use strict";

  const SVG_NS = "http://www.w3.org/2000/svg";
  const VALID_ERAS = new Set(["tribal", "ancient", "medieval", "early-modern", "preindustrial", "industrial", "contemporary"]);

  /* Return detached geometry for the selected city on the atlas. */
  function render(recipe, { grid, clipPrefix = "city-detail", cityPlan, origin = {column:0,row:0} } = {}) {
    return cityNode(recipe, normalizeGrid(grid), clipPrefix, cityPlan, origin);
  }

  function cityRequest(recipe, options = {}) {
    validateRecipe(recipe);
    const grid = normalizeGrid(options.grid);
    if (grid) recipe = recipeInLocalLongitude(recipe, grid.width);
    let character = global.WorldAtlasCityCharacter.profile(recipe);
    const local=recipe.localSite;
    if(character.small&&!character.mobile&&recipe.citySettings?.streetPattern!=='grid'
      &&local?.surface&&local.form&&!local.settlementCapacity){
      const capacity=global.WorldAtlasCitySite.inhabitedExtent({...recipe,urban:{...recipe.urban,radiusKm:character.settlementRadiusKm}},
        local.surface,local.channels||[],local.form,recipe.urban.gridCellKilometres,character);
      character={...character,settlementRadiusKm:capacity.radiusKm};
      recipe={...recipe,localSite:{...local,settlementCapacity:capacity}};
    }
    if (character.settlementRadiusKm) {
      const ratio = character.settlementRadiusKm / recipe.urban.radiusKm;
      recipe = {...recipe, urban: {...recipe.urban, radiusKm: character.settlementRadiusKm,
        radiusRows: recipe.urban.radiusRows * ratio, radiusColumns: recipe.urban.radiusColumns * ratio,
        coreZones: (recipe.urban.coreZones || []).map(zone => ({...zone,
          row: recipe.location.row + (zone.row - recipe.location.row) * ratio,
          column: recipe.location.column + (zone.column - recipe.location.column) * ratio,
          radiusKm: zone.radiusKm * ratio}))}};
    }
    const urban = recipe.urban || {};
    const morphology = recipe.morphology || {};
    const terrain = recipe.terrain || {};
    const water = recipe.water || {};
    const center = recipe.location;
    const radiusRows = Math.max(1e-7, finiteOr(urban.radiusRows, 0.05));
    const radiusColumns = Math.max(1e-7, finiteOr(urban.radiusColumns, 0.05));
    const seed = unsigned(recipe.seed);
    const bearing = Number.isFinite(water.waterBearingDegrees) ? normalizeAngle(water.waterBearingDegrees) : null;
    const request = {
      recipe,
      center,
      radiusRows,
      radiusColumns,
      seed,
      bearing,
      morphology: morphology.kind || "plain-organic",
      streetPattern: morphology.streetPattern || "organic",
      slopeClass: terrain.slopeClass || "flat",
      orientation: finiteOr(morphology.orientationDegrees, 0),
      buildingPattern: morphology.buildingPattern || "perimeter-blocks",
      blockAspect: finiteOr(morphology.blockAspect, 1),
      streetIrregularity: finiteOr(morphology.streetIrregularity, 0.35),
      population: Math.max(0, finiteOr(recipe.population && recipe.population.estimate, 0)),
      era: recipe.era,
      culturalStyle: character.style,
      tier: recipe.tier || "site",
      areaKm2: Math.max(0, finiteOr(urban.targetFootprintKm2, 0)),
      character,
    };
    return request;
  }

  function streetNetwork(recipe) {
    const request={...cityRequest(recipe),streetsOnly:true},fabric=urbanFabric(request);
    nameStreets(fabric.streets,request);
    return fabric;
  }

  /* Pure planner; pass options.grid to unwrap canonical world cells at the longitude seam. */
  function plan(recipe, options = {}) {
    const request = cityRequest(recipe, options);
    recipe = request.recipe;
    const urban = recipe.urban || {}, terrain = recipe.terrain || {};
    const {center, radiusRows, radiusColumns} = request;
    const fabric = urbanFabric(request);
    const buildable = normalizeBuildable(terrain.buildable);
    const annotations=namePlaces(featureAnnotations(recipe,fabric,request.character).concat(recipe.localSite?.annotations||[]),request);
    const placeNames=new Map(annotations.map(item=>[item.id,item.name]));
    for(const landmark of fabric.landmarks)if(placeNames.has(landmark.compoundId))landmark.name=placeNames.get(landmark.compoundId);
    for(const [index,plaza] of fabric.plazas.entries()){
      const id=plaza.market?'square-'+index:plaza.compoundId;if(placeNames.has(id))plaza.name=placeNames.get(id);
    }
    for(const [index,gate] of fabric.gates.entries())if(placeNames.has('gate-'+index))gate.name=placeNames.get('gate-'+index);
    for(const [index,court] of fabric.barbicans.entries())if(placeNames.has('barbican-'+index))court.name=placeNames.get('barbican-'+index);
    const cores = Array.isArray(urban.coreZones) && urban.coreZones.length
      ? urban.coreZones.map((zone) => ({
          id: String(zone.id),
          role: String(zone.role || "central-core"),
          row: finiteOr(zone.row, center.row),
          column: finiteOr(zone.column, center.column),
          radiusKm: Math.max(0.1, finiteOr(zone.radiusKm, 0.25)),
        }))
      : [{ id: recipe.id + "-core-1", role: "central-core", row: center.row, column: center.column, radiusKm: 0.25 }];
    return {
      era: recipe.era,
      footprint: fabric.footprint,
      blocks: fabric.blocks,
      landUse: fabric.landUse,
      districts: fabric.districts,
      streets: fabric.streets,
      railwayStations: fabric.railwayStations,
      buildings: fabric.buildings,
      housingCapacity:fabric.housingCapacity,
      walls: fabric.walls,
      innerWalls: fabric.innerWalls,
      wallSpans:fabric.wallSpans,
      innerWallSpans:fabric.innerWallSpans,
      enclosures:fabric.enclosures,
      innerEnclosures:fabric.innerEnclosures,
      gateStreets:fabric.gateStreets,
      towers: fabric.towers,
      plazas: fabric.plazas,
      wards: fabric.wards,
      trees:fabric.trees,
      landmarks: fabric.landmarks,
      countryside: fabric.countryside,
      farmland: fabric.farmland,
      fortress: fabric.fortress,
      gates: fabric.gates,
      barbicans: fabric.barbicans,
      moats:fabric.moats,
      countryLanes: fabric.countryLanes,
      hamlets: fabric.hamlets,
      character: request.character,
      annotations,
      streetWidths: streetWidthsInGrid(recipe, radiusRows, radiusColumns),
      footprintRadiusRows: radiusRows,
      footprintRadiusColumns: radiusColumns,
      gridCellKilometres: gridCellKilometres(recipe, radiusRows, radiusColumns),
      cores,
      buildable,
    };
  }

  function namePlaces(items,request) {
    const manual=request.recipe.localNames||{};
    return items.map(item=>{
      if(manual[item.id])return {...item,name:manual[item.id]};
      if(!item.nameType||!item.nameSuffix)return item;
      return {...item,name:item.nameType==='gate'?item.nameSuffix:request.recipe.name+item.nameSuffix};
    });
  }

  function nameStreets(streets,request) {
    const recipe=request.recipe,manual=recipe.localNames||{},
      used=new Set(Object.values(manual)),assigned=new Map(),roads=new Map();
    // Clipping creates multiple pieces of a logical road. Allocate once per ID.
    for(const street of streets){
      if(street.palacePerimeter||street.palaceAccess||street.service){street.name=null;continue;}
      if(street.kind==='rail'||!manual[street.id]&&(street.kind==='local'||street.alley))continue;
      const previous=roads.get(street.id);
      if(!previous||['arterial','collector','local'].indexOf(street.kind)<['arterial','collector','local'].indexOf(previous.kind))roads.set(street.id,street);
    }
    const hash=id=>{let value=2166136261;for(const c of id)value=Math.imul(value^c.charCodeAt(0),16777619);return value>>>0;};
    const ordered=Array.from(roads.values()).sort((a,b)=>hash(a.id)-hash(b.id)||a.id.localeCompare(b.id));
    for(const street of ordered){
      if(manual[street.id]){assigned.set(street.id,manual[street.id]);continue;}
      assigned.set(street.id,global.WorldAtlasCitySite.nameFromPool(recipe.namePool,'streets',
        {seed:request.seed,salt:hash(street.id),used,libraryId:recipe.naming?.libraryId}));
    }
    for(const street of streets)if(assigned.has(street.id))street.name=assigned.get(street.id);
  }

  function recipeInLocalLongitude(recipe, width) {
    const centre = recipe.location.column;
    const columnNearCity = column => column + Math.round((centre - column) / width) * width;
    const pointNearCity = point => ({...point,column:columnNearCity(point.column)});
    const cellsNearCity = cells => cells.map(([row, column]) => [row, columnNearCity(column + 0.5) - 0.5]);
    const buildable = recipe.terrain.buildable;
    return {
      ...recipe,
      urban: {...recipe.urban, coreZones: (recipe.urban.coreZones || []).map(core => ({...core, column: columnNearCity(core.column)}))},
      terrain: {...recipe.terrain, buildable: {...buildable,
        allowedCells: cellsNearCity(buildable.allowedCells),
        blockedCells: cellsNearCity(buildable.blockedCells || []),
      }},
      transport: {...recipe.transport, corridors: (recipe.transport?.corridors || []).map(corridor => ({...corridor,
        points: corridor.points.map(point => ({...point, column: columnNearCity(point.column)})),
      }))},
      localSite: recipe.localSite ? {...recipe.localSite,
        gateStreets:(recipe.localSite.gateStreets||[]).map(gate=>({...gate,points:gate.points.map(pointNearCity),gateCenter:pointNearCity(gate.gateCenter),wallSpan:gate.wallSpan.map(pointNearCity)})),
        gates:(recipe.localSite.gates||[]).map(gate=>({...gate,center:pointNearCity(gate.center),passage:gate.passage.map(pointNearCity),
          towers:gate.towers.map(tower=>tower.map(pointNearCity)),wallSpan:gate.wallSpan.map(pointNearCity)})),
        wallSpans:(recipe.localSite.wallSpans||[]).map(span=>span.map(pointNearCity)),
        innerWallSpans:(recipe.localSite.innerWallSpans||[]).map(span=>span.map(pointNearCity)),
        enclosures:(recipe.localSite.enclosures||[]).map(polygon=>polygon.map(pointNearCity)),
        innerEnclosures:(recipe.localSite.innerEnclosures||[]).map(polygon=>polygon.map(pointNearCity)),
        bounds: recipe.localSite.bounds ? {...recipe.localSite.bounds, west: columnNearCity(recipe.localSite.bounds.west), east: columnNearCity(recipe.localSite.bounds.east)} : undefined,
        surface: recipe.localSite.surface ? {...recipe.localSite.surface, bounds: {...recipe.localSite.surface.bounds,
          west: columnNearCity(recipe.localSite.surface.bounds.west), east: columnNearCity(recipe.localSite.surface.bounds.east)}} : undefined,
        channels: (recipe.localSite.channels || []).map(channel => ({...channel, points: channel.points.map(point => ({...point, column: columnNearCity(point.column)}))})),
        railwayStations: (recipe.localSite.railwayStations || []).map(station=>({...station,
          points:station.points.map(pointNearCity),platforms:station.platforms.map(points=>points.map(pointNearCity)),
          building:station.building.map(pointNearCity),freightShed:station.freightShed.map(pointNearCity),
          railPoint:pointNearCity(station.railPoint),entrance:pointNearCity(station.entrance),access:station.access.map(pointNearCity)})),
        reservedCompounds: (recipe.localSite.reservedCompounds || []).map(compound=>({...compound,
          points:compound.points.map(point=>({...point,column:columnNearCity(point.column)})),
          gate:compound.gate?{...compound.gate,column:columnNearCity(compound.gate.column)}:undefined})),
        ruralSettlements:(recipe.localSite.ruralSettlements||[]).map(site=>({...site,center:pointNearCity(site.center),
          entrance:pointNearCity(site.entrance),common:site.common.map(pointNearCity),
          localLanes:site.localLanes.map(lane=>({...lane,points:lane.points.map(pointNearCity)})),access:site.access.map(pointNearCity)})),
        farmland: (recipe.localSite.farmland || []).map(field => ({...field, points: field.points.map(pointNearCity),
          center:pointNearCity(field.center),access:field.access.map(pointNearCity),
          headlands:field.headlands.map(polygon=>polygon.map(pointNearCity)),banks:field.banks.map(line=>line.map(pointNearCity)),
          lines:field.lines.map(line=>line.map(pointNearCity))})),
      } : undefined,
    };
  }

  // Keep SVG path coordinates near zero. Browser path storage uses floats,
  // so world coordinates can otherwise quantize small houses by several metres.
  function drawingPlan(plan,origin,scale={column:1,row:1}){
    if(origin.column===0&&origin.row===0&&scale.column===1&&scale.row===1)return plan;
    const move=value=>{
      if(Array.isArray(value))return value.map(move);
      if(!value||typeof value!=='object')return value;
      if(Number.isFinite(value.column)&&Number.isFinite(value.row))return {...value,column:(value.column-origin.column)*scale.column,row:(value.row-origin.row)*scale.row};
      return Object.fromEntries(Object.entries(value).map(([key,item])=>[key,move(item)]));
    };
    return move(plan);
  }

  function cityNode(recipe, grid, clipPrefix, preparedPlan, origin) {
    const city = svg("g", {
      "data-city-detail-id": recipe.id,
      "data-city-era": recipe.era,
      "data-city-morphology": (recipe.morphology && recipe.morphology.kind) || "plain-organic",
      class: "city-detail city-detail-" + (recipe.tier || "site"),
      "pointer-events": "none",
    });
    // Draw in one physical metric. Applying unequal map-cell axes directly
    // to SVG strokes made horizontal and vertical walls different thicknesses.
    const sourcePlan=preparedPlan||plan(recipe,{grid}),m=recipe.urban.gridCellKilometres,
      scalar=sourcePlan.gridCellKilometres,drawScale={column:m.column/scalar,row:m.row/scalar},
      project=p=>({column:(p.column-origin.column)*drawScale.column,row:(p.row-origin.row)*drawScale.row}),
      cityPlan=drawingPlan(sourcePlan,origin,drawScale),
      drawing=svg('g',{class:'city-physical-drawing',transform:`scale(${1/drawScale.column} ${1/drawScale.row})`});
    const historical=['tribal','ancient','medieval','early-modern','preindustrial'].includes(recipe.era);
    const palette=global.WorldAtlasCityCharacter.mapPalette;
    city.setAttribute('data-geometry-origin-column',origin.column);city.setAttribute('data-geometry-origin-row',origin.row);
    const clipId = clipIdentifier(recipe, clipPrefix);
    const definitions = svg("defs", {});
    const pavingId=clipId+'-paving',unit=.001/cityPlan.gridCellKilometres,
      paving=svg('pattern',{id:pavingId,patternUnits:'userSpaceOnUse',width:unit*2.4,height:unit*1.6});
    paving.appendChild(svg('rect',{width:unit*2.4,height:unit*1.6,fill:palette.court}));
    paving.appendChild(svg('path',{d:`M0 0H${unit*2.4} M0 ${unit*.8}H${unit*2.4} M${unit*.6} 0V${unit*.8} M${unit*1.8} ${unit*.8}V${unit*1.6}`,
      fill:'none',stroke:'#bfc0b5','stroke-width':unit*.09,'stroke-opacity':.18}));
    definitions.appendChild(paving);
    const clip = svg("clipPath", { id: clipId, clipPathUnits: "userSpaceOnUse" });
    if(recipe.localSite){
      const b=recipe.localSite.bounds;
      const a=project({column:b.west,row:b.north});
      clip.appendChild(svg('rect',{x:a.column,y:a.row,width:(b.east-b.west)*drawScale.column,height:(b.south-b.north)*drawScale.row}));
    }else cityPlan.buildable.allowedCells.forEach((cell) => {
      clip.appendChild(svg("rect", {
        x: (cell[1]-origin.column)*drawScale.column, y: (cell[0]-origin.row)*drawScale.row, width: drawScale.column, height: drawScale.row,
      }));
    });
    definitions.appendChild(clip);
    const urbanClipId = clipId + "-urban";
    const urbanClip = svg("clipPath", { id: urbanClipId, clipPathUnits: "userSpaceOnUse" });
    cityPlan.districts.forEach((points) => urbanClip.appendChild(svg("path", { d: pathData(points, true) })));
    definitions.appendChild(urbanClip);
    city.appendChild(definitions);
    const landGeometry = svg("g", {
      id: clipId + "-geometry",
      class: "city-land-geometry",
      "clip-path": "url(#" + clipId + ")",
    });
    const geometry = svg("g", {
      class: "city-geometry",
      "clip-path": "url(#" + urbanClipId + ")",
    });
    appendCountryside(landGeometry, cityPlan, {column:scalar,row:scalar},
      (recipe.localSite?.ruralRoads||[]).filter(route=>route.fieldTrack)
        .map(route=>({...route,points:route.points.map(project)})));
    geometry.appendChild(svg('path',{class:'city-street-ground',d:cityPlan.districts.map(points=>pathData(points,true)).join(' '),
      fill:palette.ground,'fill-opacity':cityPlan.character.small?.18:.92}));
    const blocks = svg("g", { class: "city-blocks" });
    cityPlan.blocks.forEach((block) => blocks.appendChild(svg("path", {
      d: pathData(block.points, true),
      class: "city-block city-block-" + block.kind,
      fill:block.kind==='park'?palette.woodland:block.kind==='civic'?palette.court:block.kind==='court'?'#ebe6d6':block.kind==='garden'?'#dfe7cf':palette.parcel,
      "fill-opacity": block.opacity,
      stroke: "none",
    })));
    geometry.appendChild(blocks);
    geometry.appendChild(svg('path',{class:'city-house-courts',d:cityPlan.buildings.filter(b=>b.courtyard)
      .map(b=>pathData(b.courtyard,true)).join(' '),fill:palette.court}));
    geometry.appendChild(svg('path',{class:'city-domestic-gardens',d:cityPlan.buildings.filter(b=>b.gardenPoints?.length)
      .map(b=>pathData(b.gardenPoints,true)).join(' '),fill:palette.woodland,'fill-opacity':.66,
      stroke:'#a6b18c','stroke-opacity':.30,'stroke-width':.00025/scalar}));
    appendEraGrounds(geometry,cityPlan);
    geometry.appendChild(svg("path", {class: "city-plazas",
      d: cityPlan.plazas.filter(plaza=>!plaza.lawn).map(plaza => pathData(plaza.points, true)).join(" "),
      fill: 'url(#'+pavingId+')', stroke: "#b1ab9a", "stroke-width": 0.45,
      "vector-effect": "non-scaling-stroke"}));
    appendWallPaint(geometry,(cityPlan.wards||[]).flatMap(ward=>ward.walls),cityPlan,
      .0012/cityPlan.gridCellKilometres,'city-ward-walls');
    geometry.appendChild(svg('path',{class:'city-industrial-yards',
      d:cityPlan.buildings.filter(b=>b.yardPoints).map(b=>pathData(b.yardPoints,true)).join(' '),
      fill:'#ded8c7',stroke:'#c2baa8','stroke-width':.0007/cityPlan.gridCellKilometres}));
    const buildings = svg("g", { class: "city-buildings" });
    if(cityPlan.buildings.some(building=>building.access))geometry.appendChild(svg('path',{class:'city-household-access',
      d:cityPlan.buildings.filter(building=>building.access).map(building=>pathData(building.access,false)).join(' '),
      fill:'none',stroke:'#efedde','stroke-width':.001/cityPlan.gridCellKilometres,'stroke-linecap':'round','stroke-linejoin':'round'}));
    geometry.appendChild(svg('path',{class:'city-building-shadows',d:cityPlan.buildings.map(building=>pathData(building.points,true)).join(' '),
      fill:'#57645b',opacity:.12,transform:`translate(${.0014/cityPlan.gridCellKilometres} ${.0019/cityPlan.gridCellKilometres})`}));
    for (const key of new Set(cityPlan.buildings.map(building => building.kind + ":" + building.fill))) {
      const members = cityPlan.buildings.filter(building => building.kind + ":" + building.fill === key);
      const kind = members[0].kind;
      buildings.appendChild(svg("path", {
        d: members.map(building => pathData(building.points, true) + (building.courtyard ? " " + pathData(building.courtyard, true) : "")).join(" "),
        class: "city-building city-building-" + kind,
        "data-building-count": members.length,
        'data-wall-material':cityPlan.character.material.wallName,
        fill: members[0].fill, stroke: cityPlan.character.material.wall.edge, "stroke-width": .00045 / cityPlan.gridCellKilometres,
        "stroke-opacity": .72, "stroke-linejoin": "round", "fill-rule": "evenodd",
      }));
    }
    geometry.appendChild(buildings);
    appendRoofPaint(geometry,cityPlan.buildings,'city-roof-faces',cityPlan.gridCellKilometres,cityPlan.character.material.name);
    appendBuildingWallTexture(geometry,cityPlan.buildings,cityPlan,'city-building-wall-texture');
    geometry.appendChild(svg("path", {class: "city-roof-ridges",
      d: cityPlan.buildings.flatMap(building => building.roofLines || []).map(points => pathData(points, false)).join(" "),
      fill: "none", stroke: "#eee7cf", "stroke-width": .00028 / cityPlan.gridCellKilometres,
      "stroke-linecap": "round", opacity: 0.48}));
    const factories=cityPlan.buildings.filter(building=>building.kind==='factory');
    geometry.appendChild(svg('path',{class:'city-factory-skylights',
      d:factories.filter(b=>b.roof==='sawtooth').flatMap(building=>building.roofLines).map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#c3d8d9','stroke-width':.0011/cityPlan.gridCellKilometres}));
    const chimneys=svg('g',{class:'city-factory-chimneys'});
    for(const factory of factories.filter(b=>b.chimney)){
      const [a,b,,d]=factory.points,center={column:a.column*.6+b.column*.2+d.column*.2,row:a.row*.6+b.row*.2+d.row*.2},
        radius=.0018/cityPlan.gridCellKilometres;
      chimneys.appendChild(svg('circle',{cx:center.column+.003/cityPlan.gridCellKilometres,cy:center.row+.004/cityPlan.gridCellKilometres,
        r:radius*1.35,fill:'#36413d',opacity:.3}));
      chimneys.appendChild(svg('circle',{cx:center.column,cy:center.row,r:radius,fill:'#9a6550',stroke:'#4c4841',
        'stroke-width':.0007/cityPlan.gridCellKilometres}));
    }geometry.appendChild(chimneys);
    const roadEdges = svg("g", {class: "city-street-edges", fill: "none", stroke:palette.roadEdge,
      "stroke-linecap": "round", "stroke-linejoin": "round", opacity: 0.75});
    const minorRoads = svg("g", {
      class: "city-streets city-streets-minor",
      fill: "none",
      stroke:palette.road,
      "stroke-width": cityPlan.streetWidths.local,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    const majorRoads = svg("g", {
      class: "city-streets city-streets-major",
      fill: "none",
      stroke:palette.road,
      "stroke-width": cityPlan.streetWidths.arterial,
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    });
    cityPlan.streets.forEach((street) => {
      if (street.kind === "rail") return;
      const width = cityPlan.streetWidths[street.kind] || cityPlan.streetWidths.local;
      roadEdges.appendChild(svg("path", {
        d: pathData(street.points, false), "stroke-width": width * 1.2,
      }));
      (street.kind === "arterial" ? majorRoads : minorRoads).appendChild(svg("path", {
        d: pathData(street.points, false),
        "stroke-width": street.kind === "collector" ? cityPlan.streetWidths.collector : undefined,
      }));
    });
    // Validated street paths include gate passages and edge junctions. Their
    // strokes must remain whole when they cross the urban parcel boundary.
    if(recipe.localSite){
      const shoreClipId=clipId+'-road-shore',shoreClip=svg('clipPath',{id:shoreClipId,clipPathUnits:'userSpaceOnUse'}),
        m=recipe.urban.gridCellKilometres,
        roadHalfWidth=Math.max(...Object.values(cityPlan.streetWidths))*.6*scalar,
        dryPath=recipe.localSite.dryArea.replace(/([ML])\s*([-+\d.e]+)[\s,]+([-+\d.e]+)/gi,(_all,command,x,y)=>
          command+((Number(x)-origin.column)*drawScale.column).toFixed(9)+' '+((Number(y)-origin.row)*drawScale.row).toFixed(9));
      shoreClip.appendChild(svg('path',{d:dryPath,'fill-rule':'nonzero'}));
      // Only validated bridges may extend this dry-road surface into water.
      // Their full width and land portals keep bridge strokes continuous.
      for(const bridge of recipe.localSite.bridges){
        const halfWidth=Math.max(roadHalfWidth,bridge.widthMetres/2000);
        for(let i=1;i<bridge.points.length;i++){
          const a=bridge.points[i-1],b=bridge.points[i],dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,
            length=Math.hypot(dx,dy);if(length<1e-9)continue;
          const x=dx/length,y=dy/length,
            polygon=[[-1,1],[1,1],[1,-1],[-1,-1]].map(([end,side])=>{
              const p=end<0?a:b;
              return {column:(p.column-origin.column+(x*halfWidth*end-y*halfWidth*side)/m.column)*drawScale.column,
                row:(p.row-origin.row+(y*halfWidth*end+x*halfWidth*side)/m.row)*drawScale.row};
            });
          shoreClip.appendChild(svg('path',{d:pathData(polygon,true)}));
        }
      }
      definitions.appendChild(shoreClip);
      for(const roads of [roadEdges,minorRoads,majorRoads])roads.setAttribute('clip-path','url(#'+shoreClipId+')');
    }
    const civicGeometry=svg('g',{class:'city-civic-geometry','clip-path':'url(#'+urbanClipId+')'});
    appendLandmarks(civicGeometry, cityPlan);
    appendEraDecor(civicGeometry, cityPlan);
    if (cityPlan.fortress) appendFortress(civicGeometry, cityPlan);
    const railways=svg('g',{class:'city-railways'});
    for(const bridge of (recipe.localSite?.bridges||[]).filter(bridge=>bridge.kind==='rail')){
      const points=bridge.points.map(p=>project({row:p.row,
        column:p.column+(grid?Math.round((recipe.location.column-p.column)/grid.width)*grid.width:0)})),
        width=(bridge.widthMetres+3)/1000/cityPlan.gridCellKilometres;
      railways.appendChild(svg('path',{class:'city-railway-bridge-edge',d:pathData(points,false),fill:'none',stroke:'#797a70',
        'stroke-width':width*1.2}));
      railways.appendChild(svg('path',{class:'city-railway-bridge',d:pathData(points,false),fill:'none',stroke:'#ebe4cf',
        'stroke-width':width,'data-route-id':bridge.routeId}));
    }
    for(const station of cityPlan.railwayStations||[]){
      railways.appendChild(svg('path',{class:'city-station-yard',d:pathData(station.points,true),fill:'#d2d0c0',stroke:'#9b9e91','stroke-width':.0005/cityPlan.gridCellKilometres}));
      railways.appendChild(svg('path',{class:'city-station-platform',d:station.platforms.map(points=>pathData(points,true)).join(' '),fill:'#eee8d5',stroke:'#7c8179','stroke-width':.0006/cityPlan.gridCellKilometres}));
      railways.appendChild(svg('path',{class:'city-station-building',d:pathData(station.building,true),fill:'#b17d67',stroke:'#655e54','stroke-width':.0007/cityPlan.gridCellKilometres}));
      railways.appendChild(svg('path',{class:'city-station-freight-shed',d:pathData(station.freightShed,true),fill:'#8a918b',stroke:'#655e54','stroke-width':.0007/cityPlan.gridCellKilometres}));
      railways.appendChild(svg('path',{class:'city-station-roofs',d:[station.building,station.freightShed].flatMap(points=>roofLines(points)).map(points=>pathData(points,false)).join(' '),fill:'none',stroke:'#eadcc1','stroke-width':.0005/cityPlan.gridCellKilometres}));
    }
    const rail = cityPlan.streets.filter(street => street.kind === "rail").map(street => pathData(street.points, false)).join(" ");
    if (rail) {
      const width = cityPlan.streetWidths.arterial * 0.65;
      railways.appendChild(svg("path", {class:'city-railway-bed',d: rail, fill: "none", stroke: "#d6d1c2", "stroke-width": width*1.45,'stroke-linecap':'butt'}));
      railways.appendChild(svg("path", {class:'city-railway-tracks',d: rail, fill: "none", stroke: "#3b3c38", "stroke-width": width}));
      railways.appendChild(svg("path", {d: rail, fill: "none", stroke: "#fffdf4", "stroke-width": width * 0.55, "stroke-dasharray": `${width * 3} ${width * 2}`}));
    }
    landGeometry.appendChild(geometry);
    // Ditches remain visible over district ground; crossing roads and bridges
    // are drawn above them.
    appendMoats(landGeometry,cityPlan);
    landGeometry.appendChild(roadEdges);landGeometry.appendChild(minorRoads);landGeometry.appendChild(majorRoads);
    appendAvenueTrees(landGeometry,cityPlan);
    landGeometry.appendChild(civicGeometry);
    landGeometry.appendChild(railways);
    appendWalls(landGeometry, cityPlan);
    drawing.appendChild(landGeometry);city.appendChild(drawing);
    appendLabels(city,drawingPlan(sourcePlan,origin),origin);
    // Plan once in continuous local longitude, then reuse the clipped geometry
    // at the opposite edge of the rectangular atlas.
    if (grid) {
      const bounds = recipe.urban.bounds;
      if (bounds.west < 0) drawing.appendChild(svg("use", {href: "#" + clipId + "-geometry", transform: `translate(${grid.width*drawScale.column} 0)`}));
      if (bounds.east > grid.width) drawing.appendChild(svg("use", {href: "#" + clipId + "-geometry", transform: `translate(${-grid.width*drawScale.column} 0)`}));
    }
    return city;
  }

  // Era grounds: lawns of parks and cemeteries, with planted trees.
  function appendEraGrounds(parent,cityPlan){
    const lawns=cityPlan.plazas.filter(plaza=>plaza.lawn);if(!lawns.length)return;
    const unit=.001/cityPlan.gridCellKilometres;
    parent.appendChild(svg('path',{class:'city-era-lawns',d:lawns.map(p=>pathData(p.points,true)).join(' '),
      fill:'#cfdcbc',stroke:'#a9b88f','stroke-width':unit*.6}));
    const trees=lawns.flatMap(p=>p.trees||[]);
    if(trees.length){
      const dot=(p,r)=>`M${p.column-r} ${p.row}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`;
      parent.appendChild(svg('path',{class:'city-era-tree-shadows',d:trees.map(t=>dot({column:t.column+unit*1.2,row:t.row+unit*1.6},unit*(t.r||3))).join(''),fill:'#6f846a',opacity:.25}));
      parent.appendChild(svg('path',{class:'city-era-trees',d:trees.map(t=>dot(t,unit*(t.r||3))).join(''),fill:'#a3bf92',stroke:'#7f9a73','stroke-width':unit*.3}));
    }
  }

  // Fine line work of era monuments: colonnades, cavea steps, graves, paths.
  function appendEraDecor(parent,cityPlan){
    const lines=cityPlan.plazas.flatMap(plaza=>plaza.decor||[]);if(!lines.length)return;
    const unit=.001/cityPlan.gridCellKilometres;
    parent.appendChild(svg('path',{class:'city-monument-decor',d:lines.map(line=>pathData(line,false)).join(' '),
      fill:'none',stroke:'#6d6656','stroke-width':unit*.32,'stroke-opacity':.55,'stroke-linecap':'round','stroke-linejoin':'round'}));
  }

  // Tree-lined boulevards of the industrial city.
  function appendAvenueTrees(parent,cityPlan){
    const avenues=cityPlan.streets.filter(street=>street.boulevard&&street.kind!=='rail');if(!avenues.length)return;
    const unit=.001/cityPlan.gridCellKilometres,width=cityPlan.streetWidths.arterial,offset=width*.5-unit*1.6,
      spacing=unit*11,r=unit*2.1,parts=[];
    for(const street of avenues)for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],dx=b.column-a.column,dy=b.row-a.row,len=Math.hypot(dx,dy);if(len<spacing)continue;
      const ux=dx/len,uy=dy/len;
      for(let t=spacing*.5;t<len-spacing*.3;t+=spacing)for(const side of [-1,1]){
        const x=a.column+ux*t-uy*offset*side,y=a.row+uy*t+ux*offset*side;
        parts.push(`M${x-r} ${y}a${r} ${r} 0 1 0 ${2*r} 0a${r} ${r} 0 1 0 ${-2*r} 0`);
      }
    }
    parent.appendChild(svg('path',{class:'city-avenue-trees',d:parts.join(''),fill:'#a9c497',stroke:'#7f9a73','stroke-width':unit*.25,opacity:.92}));
  }

  function appendLandmarks(city, cityPlan) {
    const group = svg("g", {class: "city-landmarks"});
    group.appendChild(svg('path',{class:'city-civic-courts',d:cityPlan.plazas.filter(plaza=>!plaza.market&&!plaza.lawn)
      .map(plaza=>pathData(plaza.points,true)).join(' '),fill:global.WorldAtlasCityCharacter.mapPalette.court,'fill-opacity':.68,
      stroke:'#c4c4b8','stroke-width':.00055/cityPlan.gridCellKilometres}));
    group.appendChild(svg('path',{class:'city-landmark-shadows',
      d:cityPlan.landmarks.filter(landmark=>!landmark.ground).map(landmark=>pathData(landmark.points,true)).join(' '),
      fill:'#56665c',opacity:.14,transform:`translate(${.003/cityPlan.gridCellKilometres} ${.004/cityPlan.gridCellKilometres})`}));
    for (const landmark of cityPlan.landmarks) group.appendChild(svg("path", {
      d: pathData(landmark.points, true), class: "city-landmark city-landmark-" + landmark.kind,
      'data-feature':landmark.feature||undefined,
      'data-wall-material':landmark.wallMaterial,
      fill: landmark.fill, stroke:wallForMaterial(cityPlan,landmark.wallMaterial).edge, "stroke-width": .0007 / cityPlan.gridCellKilometres,
      "stroke-linejoin": "round",
    }));
    group.appendChild(svg("path", {d: cityPlan.landmarks.flatMap(landmark => landmark.roofLines || [])
      .map(points => pathData(points, false)).join(" "), fill: "none", stroke: "#f8e3b9",
      "stroke-width": .0004 / cityPlan.gridCellKilometres}));
    appendRoofPaint(group,cityPlan.landmarks,'city-landmark-faces',cityPlan.gridCellKilometres,cityPlan.character.material.name);
    appendBuildingWallTexture(group,cityPlan.landmarks,cityPlan,'city-landmark-wall-texture');
    city.appendChild(group);
  }

  function appendRoofPaint(parent,buildings,className,metric,material){
    const groups=new Map();
    for(const building of buildings){const name=building.material||material;
      if(!groups.has(name))groups.set(name,[]);groups.get(name).push(building);}
    for(const [name,members]of groups)appendMaterialRoofPaint(parent,members,className,metric,name);
  }

  function appendMaterialRoofPaint(parent,buildings,className,metric,material){
    const dark=[],light=[],hipLines=[],flat=[],courses=[],joints=[];
    for(const building of buildings){
      const polygon=building.points.map(p=>({x:p.column,y:p.row})),c=polygonCentre(polygon);
      const flatRoof=['flat','terrace'].includes(building.roof);
      if(flatRoof){const inside=insetPolygon(polygon,Math.sqrt(polygonArea(polygon))*.10);
        flat.push(pathData(inside.map(p=>({column:p.x,row:p.y})),true));if(building.roof==='terrace'||building.courtyard)continue;}
      if(building.courtyard){
        const inner=building.courtyard;
        for(let i=0;i<building.points.length;i++){
          const a=building.points[i],b=building.points[(i+1)%building.points.length],
            near=p=>inner.reduce((best,q)=>Math.hypot(p.column-q.column,p.row-q.row)<Math.hypot(p.column-best.column,p.row-best.row)?q:best,inner[0]);
          const ring=[a,b,near(b),near(a)],value=(b.column-a.column)-(b.row-a.row);
          (value>0?light:dark).push(pathData(ring,true));
        }continue;
      }
      const ridge=flatRoof?[building.points[0],building.points[1]]:building.roofLines?.find(line=>line.length===2);
      if(!ridge){
        for(let i=0;i<polygon.length;i++){
          const a=polygon[i],b=polygon[(i+1)%polygon.length],value=b.x-a.x-(b.y-a.y);
          (value>0?light:dark).push(pathData([a,b,c].map(p=>({column:p.x,row:p.y})),true));
        }continue;
      }
      const [a,b]=ridge,nx=b.row-a.row,ny=a.column-b.column,d=nx*a.column+ny*a.row;
      for(const sign of flatRoof?[]:[-1,1]){
        const face=clipHalfPlane(polygon,nx*sign,ny*sign,d*sign);
        if(face.length>=3)(sign*(nx+ny)>0?light:dark).push(pathData(face.map(p=>({column:p.x,row:p.y})),true));
      }
      if(building.roof==='hip'||building.roof==='gate')for(const tip of [a,b]){
        const corners=building.points.slice().sort((p,q)=>Math.hypot(p.column-tip.column,p.row-tip.row)-Math.hypot(q.column-tip.column,q.row-tip.row)).slice(0,2);
        hipLines.push(...corners.map(p=>pathData([p,tip],false)));
      }
      if(!['felt','lime','concrete'].includes(material)&&!['dome','tent'].includes(building.roof)){
        const length=Math.hypot(b.column-a.column,b.row-a.row);
        if(length>0){
          const u={x:(b.column-a.column)/length,y:(b.row-a.row)/length},v={x:-u.y,y:u.x},
            projection=polygon.map(p=>({u:p.x*u.x+p.y*u.y,v:p.x*v.x+p.y*v.y})),
            lo=Math.min(...projection.map(p=>p.v)),hi=Math.max(...projection.map(p=>p.v)),
            step=Math.max((material==='timber'?.0011:.00075)/metric,(hi-lo)/16),margin=.00035/metric;
          // Courses follow the roof construction. They are clipped to its
          // footprint, so no screen-space grain spills into lanes or courts.
          for(let h=lo+step;h<hi-margin;h+=step){
            const cuts=[];
            for(let i=0;i<projection.length;i++){
              const p=projection[i],q=projection[(i+1)%projection.length];
              if((p.v<=h&&q.v>h)||(q.v<=h&&p.v>h))cuts.push(p.u+(q.u-p.u)*(h-p.v)/(q.v-p.v));
            }
            cuts.sort((p,q)=>p-q);
            const at=t=>({column:u.x*t+v.x*h,row:u.y*t+v.y*h});
            for(let i=1;i<cuts.length;i+=2){
              const start=cuts[i-1]+margin,end=cuts[i]-margin;
              if(end<=start)continue;
              courses.push(pathData([at(start),at(end)],false));
              if(material==='metal')continue;
              const spacing=Math.max(.0016/metric,(end-start)/5),offset=(Math.round((h-lo)/step)%2)*spacing/2;
              for(let t=start+spacing/2+offset;t<end-margin;t+=spacing){
                const p=at(t),depth=Math.min(step*.45,(hi-h)*.5),endPoint={column:p.column-v.x*depth,row:p.row-v.y*depth};
                if(containsPoint(polygon,{x:endPoint.column,y:endPoint.row}))joints.push(pathData([p,endPoint],false));
              }
            }
          }
        }
      }
    }
    const group=svg('g',{class:className});
    group.appendChild(svg('path',{d:dark.join(' '),fill:'#344c4c',opacity:.10}));
    group.appendChild(svg('path',{d:light.join(' '),fill:'#fff9e6',opacity:.14}));
    group.appendChild(svg('path',{d:flat.join(' '),fill:'none',stroke:'#f3e8cd',opacity:.55,'stroke-width':.0003/metric}));
    group.appendChild(svg('path',{d:hipLines.join(' '),fill:'none',stroke:'#f3e8cd',opacity:.5,'stroke-width':.0003/metric}));
    const surface=svg('g',{class:'city-roof-material','data-roof-material':material,fill:'none','stroke-linecap':'butt'});
    surface.appendChild(svg('path',{class:'city-roof-courses',d:courses.join(' '),stroke:'#e8d9b9',opacity:.27,'stroke-width':.00014/metric}));
    surface.appendChild(svg('path',{class:'city-roof-joints',d:joints.join(' '),stroke:'#3f4037',opacity:.19,'stroke-width':.00012/metric}));
    group.appendChild(surface);
    parent.appendChild(group);
  }

  const wallMiterLimit=Math.SQRT2;

  function defenceWallWidth(widths,layer='outer'){
    return widths.collector*(layer==='inner'?3.1:2.6);
  }

  // A span subdivision is not a new wall end. Keep original coordinates and
  // join only shared vertices; finite gate openings remain separate runs.
  function joinedWallLines(lines){
    const nodes=new Map(),edges=[];
    const node=p=>{const key=p.column+','+p.row;
      if(!nodes.has(key))nodes.set(key,{point:p,edges:[]});return nodes.get(key);};
    for(const line of lines)for(let i=1;i<line.length;i++){
      const a=node(line[i-1]),b=node(line[i]);if(a===b)continue;
      const edge={a,b,used:false};edges.push(edge);a.edges.push(edge);b.edges.push(edge);
    }
    const result=[],other=(edge,vertex)=>edge.a===vertex?edge.b:edge.a;
    const walk=(start,first)=>{const points=[start.point];let vertex=start,edge=first;
      while(edge&&!edge.used){edge.used=true;vertex=other(edge,vertex);points.push(vertex.point);
        if(vertex===start||vertex.edges.length!==2)break;edge=vertex.edges.find(next=>!next.used);}
      result.push(points);
    };
    for(const vertex of nodes.values())if(vertex.edges.length!==2)for(const edge of vertex.edges)if(!edge.used)walk(vertex,edge);
    for(const edge of edges)if(!edge.used)walk(edge.a,edge);
    return result;
  }

  function wallPaintPath(lines){
    return joinedWallLines(lines).map(points=>pathData(points,points[0]===points.at(-1))).join(' ');
  }

  function appendWallPaint(parent,lines,plan,width,className){
    const {wall,wallName}=plan.character.material,metric=plan.gridCellKilometres,d=wallPaintPath(lines),
      group=svg('g',{class:className+'-material','data-wall-material':wallName,fill:'none',
        'stroke-linecap':'butt','stroke-linejoin':'miter','stroke-miterlimit':wallMiterLimit});
    group.appendChild(svg('path',{d,class:className,stroke:wall.edge,'stroke-width':width}));
    group.appendChild(svg('path',{d,stroke:wall.base,'stroke-width':width*.72}));
    group.appendChild(svg('path',{d,class:'city-wall-material-joints',stroke:wall.joint,'stroke-width':width*.66,
      'stroke-dasharray':`${wall.jointMetres/1000/metric} ${wall.spacingMetres/1000/metric}`,opacity:wallName==='plaster'?.25:.62}));
    parent.appendChild(group);
  }

  function appendBuildingWallTexture(parent,buildings,plan,className){
    const groups=new Map();
    for(const building of buildings){const name=building.wallMaterial||plan.character.material.wallName;
      if(!groups.has(name))groups.set(name,[]);groups.get(name).push(building);}
    for(const [wallName,members]of groups){const wall=wallForMaterial(plan,wallName),metric=plan.gridCellKilometres,
      lines=members.flatMap(building=>[building.points,...(building.courtyard?[building.courtyard]:[])])
        .map(points=>points.concat(points[0]));
    parent.appendChild(svg('path',{class:className,'data-wall-material':wallName,
      d:lines.map(points=>pathData(points,false)).join(' '),fill:'none',stroke:wall.highlight,
      'stroke-width':.00036/metric,'stroke-dasharray':`${wall.jointMetres/1000/metric} ${wall.spacingMetres/1000/metric}`,
      opacity:wallName==='plaster'?.26:.64}));
    }
  }

  function wallForMaterial(plan,name){
    const material=[plan.character.material,plan.character.fixedMaterial,plan.character.portableMaterial]
      .find(material=>material.wallName===name);
    if(!material)throw new TypeError('Unknown painted wall material: '+name);
    return material.wall;
  }

  function appendMoats(city,plan){
    const group=svg('g',{class:'city-defensive-ditches','data-moat-count':plan.moats.length,fill:'none','stroke-linejoin':'round'});
    for(const moat of plan.moats){const d=pathData(moat.points,true),width=moat.widthMetres/1000/plan.gridCellKilometres;
      group.appendChild(svg('path',{d,stroke:'#a6b39a','stroke-width':width*1.5}));
      group.appendChild(svg('path',{d,stroke:moat.wet?'#91d5e9':'#b1a082','stroke-width':width}));
      for(const crossing of moat.crossings)group.appendChild(svg('path',{d:pathData(crossing.points,false),stroke:global.WorldAtlasCityCharacter.mapPalette.road,'stroke-width':crossing.widthMetres/1000/plan.gridCellKilometres}));
    }city.appendChild(group);
  }

  function appendWalls(city, cityPlan) {
    const group = svg("g", {class: "city-fortifications", "stroke-linejoin": "miter", "stroke-linecap": "butt",
      'stroke-miterlimit':wallMiterLimit});
    for (const [name, walls] of [["outer", cityPlan.walls], ["inner", cityPlan.innerWalls]]) {
      const d = wallPaintPath(walls),width=defenceWallWidth(cityPlan.streetWidths,name);
      group.appendChild(svg('path',{d,class:'city-wall-shadow',fill:'none',stroke:'#3d4639',opacity:.22,
        'stroke-width':width,
        transform:`translate(${.0025/cityPlan.gridCellKilometres} ${.0035/cityPlan.gridCellKilometres})`}));
      appendWallPaint(group,walls,cityPlan,width,'city-'+name+'-walls');
    }
    for(const plaza of cityPlan.plazas.filter(p=>p.precinct)){
      const d=plaza.walls.map(p=>pathData(p,false)).join(' ');
      appendWallPaint(group,plaza.walls,cityPlan,cityPlan.streetWidths.collector*1.9,'city-palace-precinct');
    }
    group.appendChild(svg("path", {class: "city-wall-towers", "data-wall-tower-count": cityPlan.towers.length,
      d: cityPlan.towers.map(tower => pathData(tower.points, true)).join(" "), fill: cityPlan.character.material.wall.base,
      stroke: cityPlan.character.material.wall.edge, "stroke-width": .00065/cityPlan.gridCellKilometres}));
    group.appendChild(svg("path", {class: "city-tower-roofs",
      d: cityPlan.towers.flatMap(tower => tower.roofLines || []).map(points => pathData(points, false)).join(" "),
      fill: "none", stroke: "#f7efd9", "stroke-width": .00045/cityPlan.gridCellKilometres}));
    const gates=svg('g',{class:'city-gatehouses','data-gate-count':cityPlan.gates.length});
    for(const gate of cityPlan.gates){
      gates.appendChild(svg('path',{d:gate.towers.map(points=>pathData(points,true)).join(' '),fill:cityPlan.character.material.wall.base,stroke:cityPlan.character.material.wall.edge,
        'stroke-width':.00065/cityPlan.gridCellKilometres}));
      gates.appendChild(svg('path',{d:pathData(gate.passage,false),fill:'none',stroke:'#fff9eb','stroke-width':cityPlan.streetWidths.arterial,'stroke-linecap':'round'}));
      gates.appendChild(svg('path',{d:gate.towers.flatMap(points=>roofLines(points)).map(points=>pathData(points,false)).join(' '),
        fill:'none',stroke:'#f4ead4','stroke-width':.00045/cityPlan.gridCellKilometres}));
    }
    const barbicans=svg('g',{class:'city-barbicans','data-barbican-count':cityPlan.barbicans.length});
    for(const court of cityPlan.barbicans){
      barbicans.appendChild(svg('path',{d:pathData(court.points,true),fill:'#e9e1cb',stroke:'none'}));
      appendWallPaint(barbicans,court.walls,cityPlan,cityPlan.streetWidths.collector*2.8,'city-barbican-walls');
      barbicans.appendChild(svg('path',{d:pathData(court.access,false),fill:'none',stroke:'#fff8e9','stroke-width':cityPlan.streetWidths.arterial,'stroke-linecap':'round'}));
    }group.appendChild(barbicans);
    group.appendChild(gates);
    city.appendChild(group);
  }

  function appendAgriculturalPaint(group,fields,fieldTracks,metric,scale){
    const headlands=fields.flatMap(field=>field.headlands||[]),banks=fields.flatMap(field=>field.banks||[]),
      furrows=[],highlights=[],grass=[],orchards=[],holdings=new Set(fields.map(field=>field.holdingId)),
      distance=(a,b)=>Math.hypot((a.column-b.column)*metric.column,(a.row-b.row)*metric.row),
      mix=(a,b,t)=>({column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t});
    const head=svg('path',{class:'city-field-headlands',d:headlands.map(points=>pathData(points,true)).join(' '),
      fill:'#bdaf88','fill-opacity':.25,stroke:'none'});group.appendChild(head);
    for(const [index,field]of fields.entries()){
      if(field.kind==='meadow'){
        const box=polygonBounds(field.points),inside=p=>{let yes=false;for(let i=0,j=field.points.length-1;i<field.points.length;j=i++){
          const a=field.points[i],b=field.points[j];if((a.row>p.row)!==(b.row>p.row)&&p.column<(b.column-a.column)*(p.row-a.row)/(b.row-a.row)+a.column)yes=!yes;}return yes;};
        let count=0;
        for(let y=box.north+.006/metric.row;y<box.south;y+=.011/metric.row)
          for(let x=box.west+.006/metric.column;x<box.east;x+=.012/metric.column){
            const p={column:x+(random(index,count+3)-.5)*.007/metric.column,row:y+(random(index,count+17)-.5)*.006/metric.row};
            count++;if(!inside(p))continue;
            grass.push([{column:p.column-.0009/metric.column,row:p.row+.0008/metric.row},p,
              {column:p.column+.001/metric.column,row:p.row+.0005/metric.row}]);
          }
        continue;
      }
      if(field.kind==='orchard'){
        for(const line of field.lines||[])for(let i=1;i<line.length;i++){
          const a=line[i-1],b=line[i],length=distance(a,b),count=Math.floor(length/.008);
          for(let k=0;k<count;k++)orchards.push(mix(a,b,(k+.5)/count));
        }continue;
      }
      const rows=(field.lines||[]).slice();
      for(let i=1;i<(field.lines||[]).length;i++){
        const a=field.lines[i-1],b=field.lines[i];
        if(a.length===b.length)rows.push(a.map((p,j)=>mix(p,b[j],.5)));
      }
      for(const line of rows){furrows.push(line);
        highlights.push(line.map((p,i)=>{const a=line[Math.max(0,i-1)],b=line[Math.min(line.length-1,i+1)],length=distance(a,b)||1;
          return {column:p.column-(b.row-a.row)*metric.row/length*.00045/metric.column,
            row:p.row+(b.column-a.column)*metric.column/length*.00045/metric.row};}));
      }
    }
    const tracks=fieldTracks.filter(route=>holdings.has(route.holdingId)).map(route=>route.points);
    group.appendChild(svg('path',{class:'city-field-tracks',d:tracks.map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#b6a986','stroke-width':.0018/scale,'stroke-opacity':.55,'stroke-linecap':'round','stroke-linejoin':'round'}));
    group.appendChild(svg('path',{class:'city-field-banks',d:banks.map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#87936a','stroke-width':.0011/scale,'stroke-opacity':.6,'stroke-linejoin':'round'}));
    const texture=svg('g',{class:'city-field-texture'});group.appendChild(texture);
    texture.appendChild(svg('path',{class:'city-field-furrows',d:furrows.map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#93875f','stroke-width':.0006/scale,'stroke-opacity':.5,'stroke-linecap':'round'}));
    texture.appendChild(svg('path',{class:'city-field-ridge-light',d:highlights.map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#e5d8ab','stroke-width':.00035/scale,'stroke-opacity':.45}));
    texture.appendChild(svg('path',{class:'city-meadow-grass',d:grass.map(points=>pathData(points,false)).join(' '),
      fill:'none',stroke:'#8e9f75','stroke-width':.00045/scale,'stroke-opacity':.55,'stroke-linecap':'round'}));
    const crowns=orchards.map(p=>Array.from({length:8},(_,i)=>({column:p.column+Math.cos(i*Math.PI/4)*.0022/metric.column,
      row:p.row+Math.sin(i*Math.PI/4)*.0022/metric.row})));
    group.appendChild(svg('path',{class:'city-orchard-crowns',d:crowns.map(points=>pathData(points,true)).join(' '),
      fill:'#91a477','fill-opacity':.75,stroke:'#74865f','stroke-width':.00035/scale}));
  }

  function appendCountryside(city, cityPlan, metric,fieldTracks) {
    const group = svg("g", {class: "city-countryside"});
    const agriculture = svg("g", {class: "city-agricultural-ground"});
    for(const fill of new Set(cityPlan.farmland.map(field=>field.fill))){
      const fields=cityPlan.farmland.filter(field=>field.fill===fill);
      agriculture.appendChild(svg("path", {class: "city-farmland", "data-farmland-count": fields.length,
        d: fields.map(field => pathData(field.points, true)).join(" "), fill, "fill-opacity": 0.46,
        stroke: "#939a72", "stroke-opacity":.38,"stroke-width": .00045/cityPlan.gridCellKilometres}));
    }
    appendAgriculturalPaint(agriculture,cityPlan.farmland,fieldTracks,metric,cityPlan.gridCellKilometres);
    group.appendChild(agriculture);
    group.appendChild(svg('path',{class:'city-village-commons',d:cityPlan.hamlets.map(hamlet=>pathData(hamlet.common,true)).join(' '),
      fill:'#cad2ab','fill-opacity':.45,stroke:'#a3ae82','stroke-opacity':.38,'stroke-width':.00045/cityPlan.gridCellKilometres}));
    for(const fill of new Set(cityPlan.countryside.map(house=>house.yardFill)))group.appendChild(svg('path',{
      class:'city-country-yards','data-yard-count':cityPlan.countryside.filter(house=>house.yardFill===fill).length,
      d:cityPlan.countryside.filter(house=>house.yardFill===fill).map(house=>pathData(house.yard,true)).join(' '),
      fill,'fill-opacity':.72,stroke:'#aab8a0','stroke-opacity':.55,'stroke-width':.00025/cityPlan.gridCellKilometres}));
    group.appendChild(svg('path',{class:'city-country-gardens',d:cityPlan.countryside.flatMap(house=>house.gardenLines||[])
      .map(points=>pathData(points,false)).join(' '),fill:'none',stroke:'#92a477','stroke-width':.0012/cityPlan.gridCellKilometres,'stroke-opacity':.6}));
    group.appendChild(svg('path',{class:'city-country-lanes',d:cityPlan.countryside.map(house=>pathData(house.access,false)).join(' '),
      fill:'none',stroke:'#f1f3e8','stroke-width':Math.min(cityPlan.streetWidths.local,.0018/cityPlan.gridCellKilometres),
      'stroke-linejoin':'round','stroke-linecap':'round'}));
    for(const fill of new Set(cityPlan.countryside.map(house=>house.fill)))group.appendChild(svg("path", {
      class: "city-country-houses", d: cityPlan.countryside.filter(house=>house.fill===fill).map(house => pathData(house.points, true)).join(" "),
      fill,stroke:cityPlan.character.fixedMaterial.wall.edge,'data-wall-material':cityPlan.character.fixedMaterial.wallName,
      "stroke-width": .00045 / cityPlan.gridCellKilometres, "stroke-opacity": .72}));
    appendRoofPaint(group,cityPlan.countryside,'city-country-roof-faces',cityPlan.gridCellKilometres,cityPlan.character.material.name);
    appendBuildingWallTexture(group,cityPlan.countryside,cityPlan,'city-country-wall-texture');
    group.appendChild(svg("path", {d: cityPlan.countryside.flatMap(house => house.roofLines || []).map(points => pathData(points, false)).join(" "),
      fill: "none", stroke: "#f0d6ac", "stroke-width": .0003 / cityPlan.gridCellKilometres}));
    const doors=cityPlan.countryside.map(house=>{
      const edge=house.points.map((a,i)=>({a,b:house.points[(i+1)%house.points.length],q:nearestPoint(house.entrance,a,house.points[(i+1)%house.points.length])}))
        .sort((a,b)=>Math.hypot(a.q.column-house.entrance.column,a.q.row-house.entrance.row)-Math.hypot(b.q.column-house.entrance.column,b.q.row-house.entrance.row))[0];
      const dx=edge.b.column-edge.a.column,dy=edge.b.row-edge.a.row,length=Math.hypot(dx,dy),half=.0006/cityPlan.gridCellKilometres;
      return pathData([-1,1].map(side=>({column:house.entrance.column+dx/length*half*side,row:house.entrance.row+dy/length*half*side})),false);
    });
    group.appendChild(svg('path',{class:'city-country-doorways',d:doors.join(' '),fill:'none',stroke:'#64786c','stroke-width':.00065/cityPlan.gridCellKilometres}));
    city.appendChild(group);
  }

  function appendLabels(city, cityPlan,origin) {
    const group=svg('g',{class:'city-place-labels','pointer-events':'none',fill:'#495247',stroke:'#fffdf5',
      'paint-order':'stroke fill','stroke-linejoin':'round','font-family':'Microsoft YaHei, sans-serif',
      'text-anchor':'middle','dominant-baseline':'middle'});
    for(const feature of cityPlan.annotations){
      const node=svg('text',{x:0,y:0,'data-anchor-column':feature.anchor.column+origin.column,'data-anchor-row':feature.anchor.row+origin.row,
        transform:`translate(${feature.anchor.column} ${feature.anchor.row})`,'data-city-screen-label':feature.name,
        'data-feature-kind':feature.kind,'data-feature-id':feature.id,'data-priority':feature.priority,
        'data-detail-level':feature.detailLevel,'data-length-km':feature.lengthKm||0,
        'data-angle':feature.angle||0,'font-size':cityPlan.footprintRadiusRows*.04,
        'stroke-width':cityPlan.streetWidths.local,'pointer-events':feature.kind==='elevation'?'none':'visiblePainted',fill:feature.kind==='road'?'#7b7569':'#3f635b'});
      node.textContent=feature.name;group.appendChild(node);
    }
    city.appendChild(group);
  }

  function featureAnnotations(recipe,fabric,character) {
    const result=[],prefix=recipe.name,center=points=>{
      const p=polygonCentre(points.map(p=>({x:p.column,y:p.row})));return {row:p.y,column:p.x};
    };
    const point=(id,name,kind,points,priority=3,detailLevel=1,naming={})=>result.push({id,name,kind,anchor:center(points),priority,detailLevel,...naming});
    for(const [index,plaza] of fabric.plazas.entries())if(plaza.market)point('square-'+index,plaza.name,'square',plaza.points,2,0,
      {nameType:'market-square',nameSuffix:plaza.nameSuffix});
    const seen=new Set();
    for(const landmark of fabric.landmarks)if(landmark.name&&!seen.has(landmark.compoundId)){
      const principal=['royal-palace','imperial-palace','council-house','holy-tomb','water-sanctuary','observatory-sanctuary','pilgrimage-monastery','harbor-shrine','great-sanctuary'].includes(landmark.kind);
      seen.add(landmark.compoundId);point(landmark.compoundId,landmark.name,'landmark',landmark.compoundPoints,principal?0:2,0,
        {nameType:landmark.nameType,nameSuffix:landmark.nameSuffix});
    }
    if(fabric.fortress)point('citadel',prefix+(recipe.siteType==='pass'?'关堡':'卫城'),'landmark',fabric.fortress.points,1,0,
      {nameType:'citadel',nameSuffix:recipe.siteType==='pass'?'关堡':'卫城'});
    for(const [index,gate] of fabric.gates.entries())point('gate-'+index,gate.name,'gate',[gate.center],2,1,
      {nameType:'gate',nameSuffix:gate.name});
    for(const [index,court] of fabric.barbicans.entries())point('barbican-'+index,court.name,'gate',court.points,3,2,
      {nameType:'barbican',nameSuffix:'瓮城'});
    for(const [index,moat] of fabric.moats.entries())point('moat-'+index,moat.name,'water',moat.points.slice(0,2),4,1);
    for(const [index,hamlet] of fabric.hamlets.entries())point('hamlet-'+index,hamlet.name,'hamlet',hamlet.points,5,0);
    for(const station of fabric.railwayStations)point(station.id,station.name,'landmark',station.building,1,0);
    for(const [kind,label] of [['factory','工厂'],['warehouse','货仓'],['workers-housing','工人街区']]){
      const largest=fabric.buildings.filter(building=>building.kind===kind).sort((a,b)=>
        polygonArea(b.points.map(p=>({x:p.column,y:p.row})))-polygonArea(a.points.map(p=>({x:p.column,y:p.row}))))[0];
      if(largest)point('industrial-'+kind,prefix+label,'landmark',largest.points,3,1);
    }
    const longest=new Map(),metric=recipe.urban.gridCellKilometres;
    for(const street of fabric.streets)if(street.name){
      if(street.palacePerimeter||street.palaceAccess)continue;
      const a=street.points[0],b=street.points.at(-1),dx=(b.column-a.column)*metric.column,dy=(b.row-a.row)*metric.row,lengthKm=Math.hypot(dx,dy);
      if(lengthKm<.06||longest.get(street.name)?.lengthKm>=lengthKm)continue;
      let angle=Math.atan2(dy,dx)*180/Math.PI;if(angle>90)angle-=180;if(angle< -90)angle+=180;
      longest.set(street.name,{id:street.id,name:street.name,kind:'road',anchor:{row:(a.row+b.row)/2,column:(a.column+b.column)/2},
        priority:street.kind==='arterial'?3:6,detailLevel:street.kind==='arterial'?1:2,lengthKm,angle});
    }
    return result.concat(Array.from(longest.values()));
  }

  // A convex partition creates streets and blocks from the same cuts.  Every
  // cut terminates on an existing boundary; buildings are subdivided afterwards.
  // No Watabou source is used: organic districts use bounded BSP parcels.
  // Planned cities share one survey frame for walls, streets and civic ground.
  function regularCityFabric(request,along,cross,target,toWorld,angle){
    const aspect=request.recipe.citySettings?request.blockAspect:request.character.mechanisms.waterfront?
      Math.max(2.4,request.character.morphology.blockAspect):request.character.morphology.blockAspect,
      columns=Math.max(4,Math.round(Math.sqrt(target*along/cross/aspect)/2)*2),
      rows=Math.max(4,Math.round(target/columns/2)*2),dx=2*along/columns,dy=2*cross/rows,
      xs=Array.from({length:columns+1},(_,i)=>-along+i*dx),
      ys=Array.from({length:rows+1},(_,i)=>-cross+i*dy),
      axial=request.character.mechanisms.ceremonial
        &&!['fortress','border-pass'].includes(request.character.kind),
      firstColumn=columns/2-1,civicRows=rows===4?1:2,firstRow=Math.max(1,Math.floor(rows*.25)-1),
      civic=axial?[{x:xs[firstColumn],y:ys[firstRow]},{x:xs[firstColumn+2],y:ys[firstRow]},
        {x:xs[firstColumn+2],y:ys[firstRow+civicRows]},{x:xs[firstColumn],y:ys[firstRow+civicRows]}]:null,
      civicWorld=civic?.map(toWorld),parcels=[],streets=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns;x++){
      if(civic&&x>=firstColumn&&x<firstColumn+2&&y>=firstRow&&y<firstRow+civicRows)continue;
      parcels.push({channel:3100+y*columns+x,polygon:[{x:xs[x],y:ys[y]},{x:xs[x+1],y:ys[y]},
        {x:xs[x+1],y:ys[y+1]},{x:xs[x],y:ys[y+1]}]});
    }
    if(civic)parcels.push({channel:3099,polygon:civic,civic:true});
    for(const axis of ['x','y']){
      const coordinates=axis==='x'?xs:ys;
      for(let i=1;i<coordinates.length-1;i++){
        const value=coordinates[i],main=Math.abs(value)<1e-9,
          points=(axis==='x'?[{x:value,y:-cross},{x:value,y:cross}]:[{x:-along,y:value},{x:along,y:value}]).map(toWorld),
          street={id:`planned-${axis}-${i}`,kind:main?'arterial':'collector',points,plannedAxis:main};
        streets.push(...(civicWorld?streetOutsidePolygon(street,civicWorld):[street]));
      }
    }
    return ancientGridReservations({parcels,streets,angle,governmentCenter:civic?toWorld(polygonCentre(civic)):null,
      gateTargets:[{x:0,y:cross*2},{x:0,y:-cross*2},{x:-along*2,y:0},{x:along*2,y:0}].map(toWorld)},request,toWorld,columns,rows,xs,ys);
  }

  // Ward walls occupy the reserved street setback. An interior service circuit
  // receives household entrances; four actual passages connect it to the city
  // streets. The same geometry is used for paint and building clearance.
  function wardFabric(parcels,request,toWorld,radiusKm){
    const widths=request.recipe.urban.streetWidthsMetres,wallHalf=.0006,verge=.001,
      boundaryInset=(widths.arterial/2000+wallHalf+verge)/radiusKm,
      serviceInset=boundaryInset+(wallHalf+widths.local/2000+verge)/radiusKm,
      wards=[],streets=[],gateHalf=Math.max(.004,widths.local/1000)/radiusKm;
    for(const parcel of parcels){
      if(parcel.civic||parcel.polygon.length!==4)continue;
      const boundary=insetPolygon(parcel.polygon,boundaryInset),inside=insetPolygon(parcel.polygon,serviceInset);
      if(boundary.length!==4||inside.length!==4||polygonArea(inside)<.0008/(radiusKm*radiusKm))continue;
      const walls=[],gates=[];
      for(let i=0;i<4;i++){
        const a=boundary[i],b=boundary[(i+1)%4],length=Math.hypot(b.x-a.x,b.y-a.y),t=Math.min(.18,gateHalf/length),
          at=v=>({x:a.x+(b.x-a.x)*v,y:a.y+(b.y-a.y)*v}),mid=at(.5),
          p=inside[i],q=inside[(i+1)%4],inner={x:(p.x+q.x)/2,y:(p.y+q.y)/2},
          u=parcel.polygon[i],v=parcel.polygon[(i+1)%4],outer={x:(u.x+v.x)/2,y:(u.y+v.y)/2};
        walls.push([a,at(.5-t)].map(toWorld),[at(.5+t),b].map(toWorld));gates.push(toWorld(mid));
        streets.push({id:`ward-${parcel.channel}-service-${i}`,kind:'local',points:[p,q].map(toWorld),ward:true},
          {id:`ward-${parcel.channel}-gate-${i}`,kind:'local',points:[outer,inner].map(toWorld),ward:true,access:true});
      }
      wards.push({id:'ward-'+parcel.channel,points:boundary.map(toWorld),walls,gates});
    }
    return {wards,streets};
  }

  // Engineered approaches can cross a ward after the block fabric is laid
  // out. Give their complete carriageways real openings in the thin masonry;
  // private household paths still have to use the existing ward entrances.
  function fitWardOpenings(wards,routes,request){
    if(!wards.length||!routes.length)return;
    const metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      passages=routes.filter(route=>route.points?.length>1)
        .map(route=>({points:route.points,halfWidthKm:route.halfWidthKm+.001}));
    for(const ward of wards){
      const fitted=fitWallOpenings(ward.walls,passages,.0012/metric,request);
      ward.walls.splice(0,ward.walls.length,...fitted);
    }
  }

  // The enclosure follows a reachable expansion of complete street blocks.
  // The population supplies an area budget; it does not supply a circular wall.
  // A convex defensive envelope joins the developed block corners with useful
  // masonry faces instead of copying every stair step in the parcel union.
  function grownCityEnvelope(parcels,request,segments,toWorld,toLocal,areaBudget,bridges){
    if(!parcels.length)return [];
    const centres=parcels.map(parcel=>polygonCentre(parcel.polygon)),
      core=toLocal(request.plannedCity?.governmentCenter||(request.recipe.urban.coreZones||[])
        .find(zone=>zone.role==='government-core')||request.center),
      distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y),
      routeDistance=(p,routes)=>routes.length?Math.min(...routes.flatMap(route=>route.slice(1).map((b,i)=>{
        const a=route[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));
        return distance(p,{x:a.x+t*dx,y:a.y+t*dy});
      }))):0,
      major=segments.filter(street=>street.kind==='arterial').map(street=>street.points.map(toLocal)),
      regional=(request.recipe.transport?.corridors||[]).filter(road=>road.kind==='road'&&!road.fieldTrack&&road.points?.length>1)
        .map(road=>road.points.map(toLocal)),
      surface=request.recipe.localSite?.surface,
      elevations=centres.map(point=>surface?global.WorldAtlasCitySite.elevationAt(surface,toWorld(point)):0),
      adjacent=parcelAdjacency(parcels,bridges),
      neighbours=parcels.map(()=>[]),cost=parcels.map(()=>Infinity),visited=new Set(),grown=[];
    for(let i=0;i<parcels.length;i++)for(const j of adjacent[i]){
      if(j<=i)continue;
      const length=distance(centres[i],centres[j]),mid={x:(centres[i].x+centres[j].x)/2,y:(centres[i].y+centres[j].y)/2},
        grade=Math.abs(elevations[i]-elevations[j])/Math.max(1,length*request.recipe.urban.radiusKm*1000),
        walking=length*(1+Math.min(3,grade*20))*(.6+.4*Math.min(1,routeDistance(mid,major)/.4))
          *(.6+.4*Math.min(1,routeDistance(mid,regional)/.75));
      neighbours[i].push([j,walking]);neighbours[j].push([i,walking]);
    }
    let first=0;for(let i=1;i<centres.length;i++)if(distance(centres[i],core)<distance(centres[first],core))first=i;
    cost[first]=0;let area=0;
    while(visited.size<parcels.length&&area<areaBudget){
      let next=-1;for(let i=0;i<parcels.length;i++)if(!visited.has(i)&&Number.isFinite(cost[i])&&(next<0||cost[i]<cost[next]))next=i;
      if(next<0)break;visited.add(next);grown.push(parcels[next]);area+=polygonArea(parcels[next].polygon);
      for(const [index,walking]of neighbours[next])cost[index]=Math.min(cost[index],cost[next]+walking);
    }
    return cityEnvelope(grown.flatMap(parcel=>parcel.polygon));
  }

  function cityEnvelope(vertices){
    const points=vertices.slice().sort((a,b)=>a.x-b.x||a.y-b.y),lower=[],upper=[],
      cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
    for(const p of points){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=1e-10)lower.pop();lower.push(p);}
    for(const p of points.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=1e-10)upper.pop();upper.push(p);}
    return lower.slice(0,-1).concat(upper.slice(0,-1));
  }

  // Industrial-age growth: the walled or organic old core is kept, its former
  // edge becomes a ring boulevard, and a surveyed extension of uniform street
  // blocks spreads over the open land. Variants follow real nineteenth-century
  // models: a chamfered ensanche grid, radial boulevards cut through a grid,
  // or long by-law terraces for mill workers.
  function industrialCityFabric(request,along,cross,toWorld){
    const plan=request.character.eraPlan,variant=plan.id,R=Math.max(.2,request.recipe.urban.radiusKm),
      rnd=salt=>random(request.seed,salt),
      basePopulation=request.recipe.population.estimate/2.2,
      coreKm=Math.sqrt(Math.max(1500,basePopulation)/11000/Math.PI),
      coreR=Math.max(.2,Math.min(.46,coreKm/R)),
      coreAlong=coreR*(1.04+rnd(8801)*.12),coreCross=coreR*(.86+rnd(8802)*.12),
      coreShift={x:(rnd(8803)-.5)*coreR*.3,y:(rnd(8804)-.5)*coreR*.3},
      // 老城轮廓：不是圆，而是旧城墙留下的不规则多边形（随机半径点集的凸包，6–9 条边、长短不一）
      count=10+Math.floor(rnd(8809)*5),core=(()=>{
        const tilt=rnd(8808)*Math.PI,pts=Array.from({length:count},(_,i)=>{
          const theta=(i+(rnd(8810+i)-.5)*.7)*Math.PI*2/count-Math.PI,r=.72+rnd(8830+i)*.5,
            x=Math.cos(theta)*coreAlong*r,y=Math.sin(theta)*coreCross*r;
          return {x:coreShift.x+x*Math.cos(tilt)-y*Math.sin(tilt)*.35,y:coreShift.y+y+x*Math.sin(tilt)*.12};
        }).sort((a,b)=>a.x-b.x||a.y-b.y);
        const cr=(o,a,b)=>(a.x-o.x)*(b.y-o.y)-(a.y-o.y)*(b.x-o.x),lo=[],up=[];
        for(const p of pts){while(lo.length>=2&&cr(lo[lo.length-2],lo[lo.length-1],p)<=0)lo.pop();lo.push(p);}
        for(const p of pts.slice().reverse()){while(up.length>=2&&cr(up[up.length-2],up[up.length-1],p)<=0)up.pop();up.push(p);}
        const hull=lo.slice(0,-1).concat(up.slice(0,-1));
        // 凸包按逆时针返回；原代码的 planes 需要与原顺序一致（theta 递增 = 逆时针），保持即可
        return hull;
      })(),
      planes=core.map((a,i)=>{const b=core[(i+1)%core.length],nx=b.y-a.y,ny=a.x-b.x;return [nx,ny,a.x*nx+a.y*ny];}),
      inCore=p=>planes.every(([nx,ny,d])=>p.x*nx+p.y*ny<=d+1e-12);
    // Street block dimensions in kilometres.
    const block=variant==='ensanche'?{w:.118,h:.118}:variant==='mill-town'?{w:.165,h:.058}:{w:.135,h:.095},
      skew=variant==='mill-town'&&rnd(8820)<.5,bw=(skew?block.h:block.w)/R,bh=(skew?block.w:block.h)/R,
      ox=(rnd(8821)-.5)*bw,oy=(rnd(8822)-.5)*bh,parcels=[],streets=[],cells=new Map();
    const reach=Math.max(along,cross)*1.02;
    for(let i=Math.floor((-along-ox)/bw)-1;i<=Math.ceil((along-ox)/bw)+1;i++)for(let j=Math.floor((-cross-oy)/bh)-1;j<=Math.ceil((cross-oy)/bh)+1;j++){
      const x0=ox+i*bw,y0=oy+j*bh,c={x:x0+bw/2,y:y0+bh/2},radial=Math.hypot(c.x/along,c.y/cross);
      if(Math.abs(c.x)>along||Math.abs(c.y)>cross)continue;
      // A ragged suburban edge: development thins out irregularly.
      if(radial>.8+rnd(9000+i*131+j*17)*.32)continue;
      const cell=[{x:x0,y:y0},{x:x0+bw,y:y0},{x:x0+bw,y:y0+bh},{x:x0,y:y0+bh}];
      if(cell.every(inCore))continue;
      cells.set(i+','+j,{i,j,cell,radial});
    }
    // Radial avenues (boulevard variant) or a single diagonal (ensanche).
    const avenues=[];
    const groupOf=new Map(),groups=[];
    if(variant==='boulevard'){
      const n=4+Math.floor(rnd(8830)*3),start=rnd(8831)*Math.PI*2;
      for(let k=0;k<n;k++)avenues.push(start+k*Math.PI*2/n+(rnd(8832+k)-.5)*.35);
    }else if(variant==='ensanche'){
      const a=Math.PI/4+(rnd(8840)<.5?0:Math.PI/2)+(rnd(8841)-.5)*.2;avenues.push(a,a+Math.PI);
    }
    const avenueHalf=(request.recipe.urban.streetWidthsMetres.arterial/2000)/R;
    // Large public grounds (gasworks, parks, hospitals) occupy merged blocks.
    const clearOfAvenues=cell=>avenues.every(angle=>{
      const d={x:Math.cos(angle),y:Math.sin(angle)},n={x:-d.y,y:d.x},sv=cell.map(p=>p.x*n.x+p.y*n.y);
      return Math.min(...sv)>avenueHalf*2||Math.max(...sv)< -avenueHalf*2||cell.every(p=>p.x*d.x+p.y*d.y<0);
    });
    const shape=variant==='mill-town'?(skew?[3,2]:[2,3]):[2,2],wanted=[[.45,.7],[.5,.8],[.55,.85],[.7,.95],[.6,.9],[.35,.6]];
    for(const [g,[r0,r1]] of wanted.entries()){
      const options=[];
      for(const {i,j} of cells.values()){
        const members=[];
        for(let a=0;a<shape[0];a++)for(let b=0;b<shape[1];b++)members.push(cells.get((i+a)+','+(j+b)));
        if(members.some(c=>!c||groupOf.has(c)||c.cell.some(inCore)||!clearOfAvenues(c.cell)))continue;
        const cx=ox+(i+shape[0]/2)*bw,cy=oy+(j+shape[1]/2)*bh,r=Math.hypot(cx/along,cy/cross);
        options.push({members,i,j,score:rnd(8900+g*977+i*31+j*7)+(r<r0||r>r1?10+Math.abs(r-(r0+r1)/2):0)});
      }
      if(!options.length)continue;
      options.sort((a,b)=>a.score-b.score);
      if(options[0].score>=10&&g<4&&groups.length>=3)continue;
      const {members,i,j}=options[0],group={id:groups.length,i,j};groups.push(group);
      for(const c of members)groupOf.set(c,group);
    }
    const sameGroup=(a,b)=>{const p=cells.get(a),q=cells.get(b);return p&&q&&groupOf.get(p)&&groupOf.get(p)===groupOf.get(q);};
    const pieces=[];
    for(const group of groups){
      const x0=ox+group.i*bw,y0=oy+group.j*bh,x1=x0+bw*shape[0],y1=y0+bh*shape[1];
      parcels.push({polygon:[{x:x0,y:y0},{x:x1,y:y0},{x:x1,y:y1},{x:x0,y:y1}],channel:51000+group.id,extension:true,reserve:'monument'});
    }
    for(const entry of cells.values()){
      if(groupOf.has(entry))continue;
      const {cell,radial,i,j}=entry;
      let parts=cell.some(inCore)?subtractPlanes(cell,planes):[cell];
      for(const angle of avenues){
        const d={x:Math.cos(angle),y:Math.sin(angle)},n={x:-d.y,y:d.x};
        parts=parts.flatMap(part=>{
          const c=polygonCentre(part);if(c.x*d.x+c.y*d.y<=0)return [part];
          const s=part.map(p=>p.x*n.x+p.y*n.y);
          if(Math.min(...s)>avenueHalf*0||Math.max(...s)<0)return [part];
          return [clipHalfPlane(part,n.x,n.y,0),clipHalfPlane(part,-n.x,-n.y,0)].filter(q=>q.length>=3&&polygonArea(q)*R*R>.0012);
        });
      }
      for(const part of parts)if(polygonArea(part)*R*R>.0014)pieces.push({polygon:part,radial,i,j,full:part.length===4&&parts.length===1&&!cell.some(inCore)});
    }
    for(const [index,piece] of pieces.entries())parcels.push({polygon:piece.polygon,channel:52000+index,
      extension:true,chamfer:variant==='ensanche'&&piece.full,gridCell:[piece.i,piece.j]});
    // Surveyed grid streets: merge collinear cell edges into long runs.
    const runs=new Map(),key=(axis,index)=>axis+':'+index,edge=(axis,index,from,to)=>{
      const k=key(axis,index);if(!runs.has(k))runs.set(k,[]);runs.get(k).push([from,to]);
    };
    for(const {i,j} of cells.values()){
      if(!sameGroup((i-1)+','+j,i+','+j))edge('x',i,j,j+1);
      if(!sameGroup(i+','+j,(i+1)+','+j))edge('x',i+1,j,j+1);
      if(!sameGroup(i+','+(j-1),i+','+j))edge('y',j,i,i+1);
      if(!sameGroup(i+','+j,i+','+(j+1)))edge('y',j+1,i,i+1);
    }
    const coreWorld=core.map(toWorld);
    let avenueCount=0;
    for(const [k,list] of runs){
      const [axis,raw]=k.split(':'),index=Number(raw);
      list.sort((a,b)=>a[0]-b[0]);const merged=[];
      for(const [a,b] of list){const last=merged.at(-1);if(last&&a<=last[1])last[1]=Math.max(last[1],b);else merged.push([a,b]);}
      // Every fourth survey line is a principal avenue.
      const principal=variant==='mill-town'?index%3===0:Math.abs(index)%4===0;
      if(principal)avenueCount++;
      for(const [a,b] of merged){
        const points=axis==='x'?[{x:ox+index*bw,y:oy+a*bh},{x:ox+index*bw,y:oy+b*bh}]:[{x:ox+a*bw,y:oy+index*bh},{x:ox+b*bw,y:oy+index*bh}];
        const street={id:`survey-${axis}-${index}`,kind:principal?'arterial':'collector',points:points.map(toWorld),
          phase:'industrial-extension',boulevard:principal,surveyed:true};
        streets.push(...streetOutsidePolygon(street,coreWorld));
      }
    }
    // Ring boulevard on the line of the demolished walls.
    // 环城大道只修在城墙外确有新街区的那几段：临水、临空地的一侧不再绕一整圈
    const builtNear=(p)=>{for(const {cell} of cells.values()){const c={x:(cell[0].x+cell[2].x)/2,y:(cell[0].y+cell[2].y)/2};if(Math.hypot(c.x-p.x,c.y-p.y)<Math.max(bw,bh)*.9)return true;}return false;};
    for(let k=0;k<core.length;k++){const a=core[k],b=core[(k+1)%core.length],m={x:(a.x+b.x)/2,y:(a.y+b.y)/2},len=Math.hypot(m.x-coreShift.x,m.y-coreShift.y)||1,
        out={x:m.x+(m.x-coreShift.x)/len*Math.max(bw,bh)*.8,y:m.y+(m.y-coreShift.y)/len*Math.max(bw,bh)*.8};
      if(!builtNear(out))continue;
      streets.push({id:'ring-boulevard',kind:'arterial',name:null,points:[a,b].map(toWorld),phase:'industrial-extension',boulevard:true,ring:true});}
    for(const [k,angle] of avenues.entries()){
      const d={x:Math.cos(angle),y:Math.sin(angle)};
      let t0=0;while(t0<reach&&inCore({x:d.x*t0,y:d.y*t0}))t0+=.005;
      streets.push({id:'avenue-'+k,kind:'arterial',points:[{x:d.x*t0,y:d.y*t0},{x:d.x*reach,y:d.y*reach}].map(toWorld),
        phase:'industrial-extension',boulevard:true,avenue:true});
    }
    return {parcels,streets,core,coreWorld,coreCentre:toWorld(coreShift),coreScale:Math.min(1,coreR/.5),angle:0};
  }

  // Ancient survey grids (Hippodamian / castrum) reserve a forum or agora
  // ground and a few large blocks for public buildings before houses exist.
  function ancientGridReservations(layout,request,toWorld,columns,rows,xs,ys){
    const plan=request.character.eraPlan;if(!plan||!['hippodamian','castrum'].includes(plan.id))return layout;
    let reservedCounter=0;
    const rnd=salt=>random(request.seed,salt),index=(x,y)=>y*columns+x,
      byChannel=new Map(layout.parcels.map(parcel=>[parcel.channel,parcel]));
    const take=(cellsList,reserve,label)=>{
      if(cellsList.some(([x,y])=>x<0||y<0||x>=columns||y>=rows||!byChannel.has(3100+index(x,y))))return null;
      for(const [x,y] of cellsList)byChannel.delete(3100+index(x,y));
      const x0=Math.min(...cellsList.map(c=>c[0])),x1=Math.max(...cellsList.map(c=>c[0]))+1,
        y0=Math.min(...cellsList.map(c=>c[1])),y1=Math.max(...cellsList.map(c=>c[1]))+1,
        polygon=[{x:xs[x0],y:ys[y0]},{x:xs[x1],y:ys[y0]},{x:xs[x1],y:ys[y1]},{x:xs[x0],y:ys[y1]}],
        parcel={channel:2900+(reservedCounter++),polygon,reserve,reserveLabel:label};
      byChannel.set('r'+reserve+x0+'-'+y0,parcel);return parcel;
    };
    const cx=Math.floor(columns/2),cy=Math.floor(rows/2);
    const forum=plan.id==='castrum'?take([[cx-1,cy-1],[cx,cy-1]],'forum'):
      take([[cx-1+(rnd(611)<.5?0:1),cy-1],[cx+(rnd(611)<.5?0:1),cy-1]],'forum')||take([[cx,cy]],'forum');
    // Large edge blocks for theatre / amphitheatre / gymnasium.
    const edgeCells=[];
    for(let y=0;y<rows;y++)for(let x=0;x<columns-1;x++){
      const r=Math.hypot((x+1-columns/2)/(columns/2),(y+.5-rows/2)/(rows/2));
      if(r>.45&&r<.95)edgeCells.push({x,y,r,score:rnd(700+x*31+y*7)});
    }
    edgeCells.sort((a,b)=>a.score-b.score);
    let reserved=0;
    for(const c of edgeCells){
      if(reserved>=2)break;
      const p=take([[c.x,c.y],[c.x+1,c.y]],'monument');if(p)reserved++;
    }
    const parcels=Array.from(byChannel.values()),reservations=parcels.filter(p=>p.reserve);
    let streets=layout.streets;
    for(const p of reservations){const world=p.polygon.map(toWorld);streets=streets.flatMap(street=>streetOutsidePolygon(street,world));}
    return {...layout,parcels,streets,forum:forum?forum.polygon.map(toWorld):null};
  }

  // Place era monuments (forum, theatres, baths, gasworks, parks …) as whole
  // compounds on complete street blocks. Footprints come from the era
  // material library in metres and are fitted into the block's own frame.
  function placeEraMonuments(request,parcels,assignments,toWorld,plazas,landmarks,streets,widths,taken){
    const character=request.character,plan=character.eraPlan,Era=global.WorldAtlasCityEra;
    if(!plan||!Era)return;
    const m=request.recipe.urban.gridCellKilometres,R=request.recipe.urban.radiusKm,
      program=Era.monumentProgram(plan,{population:request.population,capital:character.capital}),
      forumKind=plan.id==='castrum'?'forum':plan.id==='hippodamian'?'agora':null;
    if(forumKind)program.unshift({kind:forumKind,label:plan.id==='castrum'?'广场':'集会广场',zone:'forum',radial:[0,2],minMetres:40});
    const roadIndex=streetClearanceIndex(streets,widths,request.center,.075/gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns));
    const used=new Set();
    const centreOf=parcel=>toWorld(polygonCentre(parcel.polygon)),
      industrial=parcels.filter(parcel=>assignments.get(parcel)?.kind==='industrial').map(centreOf),
      industryCentre=industrial.length?{column:industrial.reduce((s,p)=>s+p.column,0)/industrial.length,row:industrial.reduce((s,p)=>s+p.row,0)/industrial.length}:null,
      distanceTo=parcel=>{const c=centreOf(parcel);return Math.min(...industrial.map(p=>Math.hypot((p.column-c.column)*m.column,(p.row-c.row)*m.row)));};
    const frameOf=parcel=>{
      const local=insetPolygon(parcel.polygon,(widths.arterial*.62)*gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns)/R+.006/R);
      if(local.length<3)return null;
      const world=local.map(toWorld),metres=world.map(p=>({x:(p.column-request.center.column)*m.column*1000,y:(p.row-request.center.row)*m.row*1000})),
        c=polygonCentre(metres);
      let best=null;
      for(let i=0;i<metres.length;i++){
        const a=metres[i],b=metres[(i+1)%metres.length],L=Math.hypot(b.x-a.x,b.y-a.y);if(L<1)continue;
        const ux=(b.x-a.x)/L,uy=(b.y-a.y)/L;
        const proj=metres.map(p=>({u:(p.x-c.x)*ux+(p.y-c.y)*uy,v:-(p.x-c.x)*uy+(p.y-c.y)*ux}));
        const w=Math.min(...proj.map(p=>Math.abs(p.u))),h=Math.min(...proj.map(p=>Math.abs(p.v)));
        if(!best||w*h>best.w*best.h)best={ux,uy,w,h};
      }
      if(!best)return null;
      const at=(x,y)=>({column:request.center.column+(c.x+best.ux*x-best.uy*y)/1000/m.column,row:request.center.row+(c.y+best.uy*x+best.ux*y)/1000/m.row});
      // The bounding fit above is conservative for convex blocks; shrink further until the footprint fits.
      return {at,w:best.w,h:best.h,world,metres,polygon:metres};
    };
    const inside=(frame,pts)=>pts.every(([x,y])=>{
      const p=frame.at(x,y);return containsPoint(frame.world.map(q=>({x:q.column,y:q.row})),{x:p.column,y:p.row});
    });
    for(const [order,item] of program.entries()){
      const candidates=parcels.filter(parcel=>{
        if(used.has(parcel)||taken.has(parcel))return false;
        const use=assignments.get(parcel);if(!use)return false;
        if(item.zone==='forum')return parcel.reserve==='forum'||!parcel.reserve&&!['civic','park','industrial','warehouse'].includes(use.kind)&&use.radial<.55;
        if(parcel.reserve==='forum')return false;
        if(item.zone==='industrial')return use.kind==='industrial'||parcel.reserve==='monument'&&industryCentre&&distanceTo(parcel)<1;
        if(['civic','park','warehouse','industrial'].includes(use.kind)&&!parcel.reserve)return false;
        if(parcel.oldCore&&item.zone!=='core')return false;
        const r=use.radial;return r>=item.radial[0]&&r<=item.radial[1]||parcel.reserve==='monument'&&r>=item.radial[0]*.8;
      }).map(parcel=>({parcel,frame:frameOf(parcel)})).filter(c=>c.frame&&Math.min(c.frame.w,c.frame.h)*2>=item.minMetres*.6)
        .sort((a,b)=>(item.zone==='industrial'&&industryCentre?distanceTo(a.parcel)-distanceTo(b.parcel):0)
          ||(item.zone==='forum'?(b.parcel.reserve==='forum')-(a.parcel.reserve==='forum'):0)
          ||(b.parcel.reserve==='monument')-(a.parcel.reserve==='monument')
          ||(item.zone==='ring'?(b.parcel.ringFront?1:0)-(a.parcel.ringFront?1:0):0)
          ||b.frame.w*b.frame.h-a.frame.w*a.frame.h);
      if(!candidates.length&&['industrial','edge','mid'].includes(item.zone)){
        // Relaxed siting: any large non-core block still free.
        candidates.push(...parcels.filter(parcel=>!used.has(parcel)&&!taken.has(parcel)&&!parcel.oldCore&&parcel.reserve!=='forum'
          &&!['civic','park'].includes(assignments.get(parcel)?.kind)&&assignments.get(parcel)?.radial>=item.radial[0]*.7)
          .map(parcel=>({parcel,frame:frameOf(parcel)})).filter(c=>c.frame&&Math.min(c.frame.w,c.frame.h)*2>=item.minMetres*.6)
          .sort((a,b)=>(item.zone==='industrial'&&industryCentre?distanceTo(a.parcel)-distanceTo(b.parcel):0)||b.frame.w*b.frame.h-a.frame.w*a.frame.h));
      }
      for(const {parcel,frame} of candidates.slice(0,8)){
        let w=frame.w*.94,h=frame.h*.94,shape=null,square=null;
        for(let k=0;k<7&&!shape;k++,w*=.88,h*=.88){
          const result=Era.monument(item.kind,w,h);
          const all=result.parts.flatMap(part=>part.points).concat([[-w,-h],[w,-h],[w,h],[-w,h]]);
          if(Math.min(w,h)*2<item.minMetres*.5)break;
          const box=[[-w,-h],[w,-h],[w,h],[-w,h]].map(([x,y])=>frame.at(x,y));
          if(!inside(frame,all)||roadIndex.intersects(box)
            ||plazas.some(p=>polygonsOverlap(box,p.points))||landmarks.some(l=>polygonsOverlap(box,l.points)))continue;
          shape=result;square=box;
          if(!['forum','agora','park','cemetery','gymnasium'].includes(item.kind)&&result.parts.length){
            const pts=result.parts.flatMap(part=>part.points),pad=5,
              x0=Math.max(-w,Math.min(...pts.map(p=>p[0]))-pad),x1=Math.min(w,Math.max(...pts.map(p=>p[0]))+pad),
              y0=Math.max(-h,Math.min(...pts.map(p=>p[1]))-pad),y1=Math.min(h,Math.max(...pts.map(p=>p[1]))+pad);
            square=[[x0,y0],[x1,y0],[x1,y1],[x0,y1]].map(([x,y])=>frame.at(x,y));
          }
        }
        if(!shape)continue;
        used.add(parcel);taken.add(parcel);
        const compoundId='era-'+item.kind+'-'+order,name=character.prefix+item.label;
        const trees=[];
        if(item.kind==='park'||item.kind==='cemetery'){
          const step=item.kind==='park'?13:17;
          for(let x=-w+6;x<=w-6;x+=step)for(let y=-h+6;y<=h-6;y+=step){
            const jx=x+(random(request.seed,order*997+Math.round(x*7+y*3))-.5)*step*.8,jy=y+(random(request.seed,order*991+Math.round(x*3+y*7))-.5)*step*.8;
            if(item.kind==='park'&&(Math.abs(jx)<5||Math.abs(jy)<5||Math.abs(Math.hypot(jx/(w*.62),jy/(h*.62))-1)<.09))continue;
            if(item.kind==='cemetery'&&Math.abs(jx)>5&&Math.abs(jy)>5&&random(request.seed,order*31+Math.round(jx*jy))>.25)continue;
            const q=frame.at(jx,jy);trees.push({column:q.column,row:q.row,r:2.4+random(request.seed,Math.round(jx*13+jy))*2.2});
          }
        }
        plazas.push({points:square,role:'era-monument',name,compoundId,nameType:item.kind,nameSuffix:item.label,trees,
          market:item.kind==='forum'||item.kind==='agora',lawn:!!shape.lawn,monument:item.kind,
          decor:shape.decor.map(line=>line.map(([x,y])=>frame.at(x,y))),walls:[]});
        for(const [index,part] of shape.parts.entries()){
          const points=part.points.map(([x,y])=>frame.at(x,y));
          landmarks.push({points,kind:index?item.kind+'-wing':item.kind,fill:part.fill||character.roof[index%character.roof.length],
            roof:part.roof,roofLines:roofLines(points,null,part.roof==='dome'?'flat':part.roof),feature:part.feature,
            ...(['pond','arena','orchestra','coal-yard','natatio','frigidarium-pool','xystos','turntable','altar','bandstand'].includes(part.feature)?{ground:true}:{}),
            material:character.material.name,wallMaterial:character.material.wallName,eraMonument:true,
            foundation:foundationAt(points,request.recipe),compoundId,compoundPoints:square,name,nameType:item.kind,nameSuffix:item.label});
        }
        for(const [x,y] of shape.chimneys||[])landmarks.push({points:Array.from({length:10},(_,i)=>frame.at(x+Math.cos(i/10*Math.PI*2)*2.2,y+Math.sin(i/10*Math.PI*2)*2.2)),
          kind:item.kind+'-wing',fill:'#8a5a48',roof:'flat',roofLines:[],feature:'chimney',material:character.material.name,wallMaterial:character.material.wallName,
          eraMonument:true,foundation:{elevationMetres:0,reliefMetres:0},compoundId,compoundPoints:square,name,nameType:item.kind,nameSuffix:item.label});
        break;
      }
    }
  }

  // Closed perimeter blocks of the industrial extension: continuous street
  // frontages around a private court, with chamfered corners in an ensanche.
  function perimeterBlock(polygon,streets,request,channel,{depthRange=[13,18],widthRange=[11,20],rearWings=0}={}){
    const recipe=request.recipe,m=recipe.urban.gridCellKilometres,origin=polygon[0],
      toM=p=>({x:(p.column-origin.column)*m.column*1000,y:(p.row-origin.row)*m.row*1000}),
      toW=p=>({column:origin.column+p.x/1000/m.column,row:origin.row+p.y/1000/m.row}),
      outer=polygon.map(toM),area=polygonArea(outer);
    if(area<400)return [];
    const depth=depthRange[0]+random(request.seed,channel+71)*(depthRange[1]-depthRange[0]),
      centre=polygonCentre(outer),edges=[];
    for(let i=0;i<outer.length;i++){
      const a=outer[i],b=outer[(i+1)%outer.length],len=Math.hypot(b.x-a.x,b.y-a.y);if(len<.5)continue;
      const t={x:(b.x-a.x)/len,y:(b.y-a.y)/len};let n={x:-t.y,y:t.x};
      if((centre.x-a.x)*n.x+(centre.y-a.y)*n.y<0)n={x:-n.x,y:-n.y};
      edges.push({a,b,len,t,n,c:a.x*n.x+a.y*n.y});
    }
    // Inner court: everything deeper than one house from every frontage.
    let court=outer;for(const e of edges)court=clipHalfPlane(court,-e.n.x,-e.n.y,-(e.c+depth));
    const homes=[],nearest=p=>{
      let best=null;
      for(const street of streets)if(street.kind!=='rail')for(let i=1;i<street.points.length;i++){
        const q=nearestPoint(p,street.points[i-1],street.points[i]),d=Math.hypot((q.column-p.column)*m.column,(q.row-p.row)*m.row);
        if(!best||d<best.d)best={d,q,street};
      }return best;
    };
    const lineCut=(poly,e,v)=>{ // ridge: intersections of poly with the line at inward distance v from edge e
      const xs=[];
      for(let i=0;i<poly.length;i++){
        const p=poly[i],q=poly[(i+1)%poly.length],dp=p.x*e.n.x+p.y*e.n.y-e.c-v,dq=q.x*e.n.x+q.y*e.n.y-e.c-v;
        if(dp*dq<0||dp===0)xs.push(dp===0?p:{x:p.x+(q.x-p.x)*dp/(dp-dq),y:p.y+(q.y-p.y)*dp/(dp-dq)});
      }
      if(xs.length<2)return null;
      xs.sort((u,w)=>(u.x*e.t.x+u.y*e.t.y)-(w.x*e.t.x+w.y*e.t.y));return [xs[0],xs.at(-1)];
    };
    for(const [k,e] of edges.entries()){
      // The strip of ground closest to this frontage, up to one house deep.
      let strip=clipHalfPlane(outer,e.n.x,e.n.y,e.c+depth);
      for(const o of edges)if(o!==e)strip=clipHalfPlane(strip,e.n.x-o.n.x,e.n.y-o.n.y,e.c-o.c);
      if(strip.length<3||polygonArea(strip)<30)continue;
      const proj=strip.map(p=>p.x*e.t.x+p.y*e.t.y),lo=Math.min(...proj),hi=Math.max(...proj),span=hi-lo;
      if(span<5)continue;
      const n=Math.max(1,Math.round(span/(widthRange[0]+random(request.seed,channel+k*13)*(widthRange[1]-widthRange[0])))),
        groupId=`perimeter-${channel}-${k}`;
      for(let j=0;j<n;j++){
        let lot=strip;
        if(j>0)lot=clipHalfPlane(lot,-e.t.x,-e.t.y,-(lo+span*j/n));
        if(j<n-1)lot=clipHalfPlane(lot,e.t.x,e.t.y,lo+span*(j+1)/n);
        if(lot.length<3||polygonArea(lot)<35)continue;
        const ridge=lineCut(lot,e,depth*.5),
          u=lo+span*(j+.5)/n,front={x:e.a.x+e.t.x*(u-(e.a.x*e.t.x+e.a.y*e.t.y)),y:e.a.y+e.t.y*(u-(e.a.x*e.t.x+e.a.y*e.t.y))},
          entrance=toW(front),target=nearest(entrance);
        if(!target||target.d>.04)continue;
        homes.push({points:lot.map(toW),entrance,access:[entrance,target.q],index:channel*100+k*10+j,rank:random(request.seed,channel+k*31+j),
          ridge:ridge?ridge.map(toW):null,
          frontage:{streetId:target.street.id||null,roadPoint:target.q,widthMetres:span/n,depthMetres:depth,groupId,position:j},
          placementRank:random(request.seed,channel+k*7)});
        // Rear wings (Hinterhaus) reach into the court of tenement blocks.
        if(rearWings&&court.length>=3&&random(request.seed,channel+k*17+j*3)<rearWings&&span/n>8){
          const wv=Math.min(4.5,span/n*.3),dl=7+random(request.seed,channel+j+k)*9,
            s0={x:front.x+e.n.x*(depth+.4),y:front.y+e.n.y*(depth+.4)},
            wing=[{x:s0.x-e.t.x*wv,y:s0.y-e.t.y*wv},{x:s0.x+e.t.x*wv,y:s0.y+e.t.y*wv},
              {x:s0.x+e.t.x*wv+e.n.x*dl,y:s0.y+e.t.y*wv+e.n.y*dl},{x:s0.x-e.t.x*wv+e.n.x*dl,y:s0.y-e.t.y*wv+e.n.y*dl}];
          if(wing.every(p=>containsPoint(court,p))&&polygonArea(court)>wv*dl*6)
            homes.push({points:wing.map(toW),entrance,access:[entrance,target.q],index:channel*100+k*10+j+5,rank:random(request.seed,channel+k*41+j),
              rearWing:true,ridge:[{x:s0.x,y:s0.y},{x:s0.x+e.n.x*dl,y:s0.y+e.n.y*dl}].map(toW),
              frontage:{streetId:target.street.id||null,roadPoint:target.q,widthMetres:wv*2,depthMetres:dl,groupId,position:j},placementRank:1});
        }
      }
    }
    const courtWorld=court.length>=3&&polygonArea(court)>60?court.map(toW):null;
    return homes.filter(home=>completeBuildingGround(home.points,recipe)&&foundationAt(home.points,recipe).reliefMetres<=4.5)
      .map(home=>({...home,courtPoints:courtWorld}));
  }

  function urbanFabric(request) {
    const modern = request.era === "industrial" || request.era === "contemporary";
    const character=request.character;
    const householdSettlement=character.small&&!character.mobile&&request.recipe.citySettings?.streetPattern!=='grid';
    const tribal = request.era === "tribal"||character.mobile;
    const defensiveEra = ["ancient", "medieval", "early-modern", "preindustrial"].includes(request.era);
    const fortifiedSite = ["fortress", "pass"].includes(request.recipe.siteType) || (request.recipe.landmarks || []).some(landmark => landmark === "citadel" || landmark === "government-seat");
    const courtyardStyle = character.court;
    const rowHouseStyle = ["terraced", "canal-side"].includes(request.culturalStyle) || request.buildingPattern === "terraced-compounds";
    const radiusKm = Math.max(0.05, finiteOr(request.recipe.urban.radiusKm, 1));
    const widths = streetWidthsInGrid(request.recipe, request.radiusRows, request.radiusColumns);
    request.defenceWidths=widths;
    const metric = gridCellKilometres(request.recipe, request.radiusRows, request.radiusColumns);
    const roadGap = widths.arterial * metric / radiusKm * 0.58;
    const targetBlocks = character.small?Math.max(8,Math.min(128,Math.round(character.buildingCount/6))):Math.max(25,Math.min(235,Math.round(character.buildingCount/character.morphology.householdsPerBlock)));
    const targetArea = Math.PI / (targetBlocks * (tribal ? 0.48 : 1));
    const groundForm=request.recipe.localSite?.form;
    const explicit=request.recipe.citySettings;
    const constrainedGround=groundForm&&groundForm.kind!=='plain';
    let angle = constrainedGround?groundForm.axisRadians:explicit?request.orientation*Math.PI/180:
      groundForm?groundForm.axisRadians:request.orientation*Math.PI/180;
    if(!explicit&&character.mechanisms.waterfront&&(!groundForm||groundForm.kind==='plain')){
      const m=request.recipe.urban.gridCellKilometres,channels=request.recipe.localSite?.channels||[],candidates=[];
      for(const channel of channels)for(let i=1;i<channel.points.length;i++){
        const a=channel.points[i-1],b=channel.points[i],near=nearestPoint(request.center,a,b),
          distance=Math.hypot((near.column-request.center.column)*m.column,(near.row-request.center.row)*m.row);
        if(channel.kind==='river')candidates.push({distance,angle:Math.atan2((b.row-a.row)*m.row,(b.column-a.column)*m.column)});
      }
      candidates.sort((a,b)=>a.distance-b.distance);if(candidates.length)angle=candidates[0].angle;
    }
    const planned=character.regular;
    const rectangular=character.rectangular;
    const industrialPlan=!!character.eraPlan?.industrial&&!householdSettlement;
    const elongated=['hill-town','border-pass','fortress','river-town','river-port','seaport','lake-port'].includes(character.kind),
      planAlong=groundForm?.alongScale||(planned?.94:elongated?1.02:.95),
      planCross=groundForm?.crossScale||(planned?.86:['steep','escarpment'].includes(request.slopeClass)?.30:elongated?.73:.92);
    if(!groundForm&&['hill-town','fortress','border-pass'].includes(character.kind)&&request.recipe.localSite?.surface){
      const field=request.recipe.localSite.surface,b=field.bounds,x=Math.max(1,Math.min(field.columns-2,Math.round((request.center.column-b.west)/(b.east-b.west)*(field.columns-1)))),
        y=Math.max(1,Math.min(field.rows-2,Math.round((request.center.row-b.north)/(b.south-b.north)*(field.rows-1)))),index=y*field.columns+x;
      const dx=field.elevationMetres[index+1]-field.elevationMetres[index-1],dy=field.elevationMetres[index+field.columns]-field.elevationMetres[index-field.columns];
      if(Math.hypot(dx,dy)>.1)angle=Math.atan2(dx,-dy);
    }
    const toWorld = point => ({
      column: request.center.column + (point.x * Math.cos(angle) - point.y * Math.sin(angle)) * request.radiusColumns,
      row: request.center.row + (point.x * Math.sin(angle) + point.y * Math.cos(angle)) * request.radiusRows,
    });
    const toLocal=p=>{const x=(p.column-request.center.column)/request.radiusColumns,y=(p.row-request.center.row)/request.radiusRows;
      return {x:x*Math.cos(angle)+y*Math.sin(angle),y:-x*Math.sin(angle)+y*Math.cos(angle)};};
    const outlineVertices=householdSettlement&&character.defence.layers>0?8:48;
    let outline = !householdSettlement?[{x:-planAlong,y:-planCross},{x:planAlong,y:-planCross},{x:planAlong,y:planCross},{x:-planAlong,y:planCross}]:Array.from({length:outlineVertices}, (_, index) => {
      const theta = (index + (random(request.seed, 2500 + index) - 0.5) * 0.5) * Math.PI * 2 / outlineVertices;
      // All vertices lie on one convex ellipse: subdivision cannot self-intersect.
      return {x:Math.cos(theta)*planAlong,y:Math.sin(theta)*planCross};
    });
    const segments = [];
    const parcels = [];
    const split = (polygon, depth, channel) => {
      const area = polygonArea(polygon);
      if (depth >= 11 || area < (request.coreTargetArea||targetArea) * (0.74 + random(request.seed, channel) * 0.65)) {
        parcels.push({polygon, channel}); return;
      }
      const centre = polygonCentre(polygon);
      const historicCore = request.forceHistoric || (character.mechanisms.multiPhase?Math.hypot(centre.x+.18,centre.y+.08)<.48:
        Math.hypot(centre.x, centre.y) < (modern ? 0.40 : request.era === "early-modern" ? 0.56 : 0.85));
      const ordered = planned||!historicCore && (modern || request.era === "early-modern"||character.mechanisms.multiPhase);
      const chaos = planned ? 0 : ordered ? (request.era === "industrial" ? 0.035 : 0.015) : (tribal ? 0.8 : character.morphology.streetVariation*(.65+request.streetIrregularity*.5));
      const result = bisectParcel(polygon, request.seed, channel, chaos, explicit?request.blockAspect:character.morphology.blockAspect);
      if (!result) { parcels.push({polygon, channel}); return; }
      const kind=depth<2?'arterial':depth<5?'collector':'local';
      const worldCut=result.cut.map(toWorld);
      segments.push({id:'street-'+channel,kind,name:kind==='local'?null:'街道',points:worldCut,
        phase:historicCore?'historic-core':'preindustrial-extension',inherited:character.mechanisms.multiPhase&&depth<3});
      split(result.first, depth + 1, channel * 2 + 1);
      split(result.second, depth + 1, channel * 2 + 2);
    };
    let garrisonParcel=null;
    if(householdSettlement){
      parcels.push({polygon:outline,channel:31});
      const village=villageStreets(request,outline,toWorld,radiusKm);
      segments.push(...village.streets);garrisonParcel=village.garrisonParcel;
      request.garrisonReservation=garrisonParcel?.polygon.map(toWorld)||null;
    }else if(industrialPlan){
      const layout=industrialCityFabric(request,planAlong,planCross,toWorld);
      parcels.push(...layout.parcels);
      const coreStart=parcels.length,R=Math.max(.2,radiusKm);
      request.forceHistoric=true;request.coreTargetArea=Math.pow(.075/R,2);
      split(layout.core,0,31);
      request.forceHistoric=false;request.coreTargetArea=null;
      for(let k=coreStart;k<parcels.length;k++)parcels[k].oldCore=true;
      segments.push(...layout.streets);request.industrialCity=layout;
    }else if(planned){
      const layout=regularCityFabric(request,planAlong,planCross,targetBlocks,toWorld,angle);
      parcels.push(...layout.parcels);
      segments.push(...layout.streets);request.plannedCity=layout;
      request.reservedWorld=layout.parcels.filter(parcel=>parcel.reserve).map(parcel=>parcel.polygon.map(toWorld));
    }else split(outline, 0, 31);
    const throughRiver=request.recipe.localSite?.riverMode==='through';
    let candidates = parcels.filter(parcel => {
      const centre = polygonCentre(parcel.polygon);
      return (!householdSettlement||Math.max(Math.abs(centre.x/planAlong),Math.abs(centre.y/planCross))<=.98)
        &&(request.recipe.localSite||parcel.polygon.map(toWorld).every(point=>segmentOnLand(request.center,point,request.recipe)));
    }).flatMap(parcel=>request.recipe.localSite?clipToLand(parcel.polygon.map(toWorld),request.recipe)
      .map(points=>({...parcel,servicePolygon:parcel.polygon,polygon:points.map(toLocal)})):[{...parcel,servicePolygon:parcel.polygon}]);
    const bridges=throughRiver?(request.recipe.localSite.bridges||[]).map(b=>b.points.map(toLocal)):[];
    if(!rectangular&&!householdSettlement&&!industrialPlan){
      // Site planning fixes the urban domain before its regional roads route
      // through the chosen gates. Rendering consumes that same domain; routed
      // approaches cannot start a second growth pass behind the saved walls.
      const domains=request.recipe.localSite?.gates?request.recipe.localSite.enclosures.map(points=>points.map(toLocal)):null;
      outline=domains?cityEnvelope(domains.flat()):grownCityEnvelope(candidates,request,segments,toWorld,toLocal,
        Math.PI*planAlong*planCross*(planned?1:.78**2),bridges);
      candidates=candidates.flatMap(parcel=>(domains||[outline]).flatMap(boundary=>{
        let polygon=parcel.polygon;
        for(let i=0;i<boundary.length&&polygon.length>=3;i++){
          const a=boundary[i],b=boundary[(i+1)%boundary.length],nx=b.y-a.y,ny=a.x-b.x;
          polygon=clipHalfPlane(polygon,nx,ny,a.x*nx+a.y*ny);
        }
        return polygon.length>=3&&polygonArea(polygon)>1e-12?[{...parcel,polygon}]:[];
      }));
    }
    // Keep the connected settlement around the centre. A road or bridge is
    // required before development can grow across a forbidden water corridor.
    // A surveyed ancient town is laid out on one bank; the far bank is not walled in.
    const selectedParcels = connectedParcels(candidates,['hippodamian','castrum','lifang'].includes(character.eraPlan?.id)?[]:bridges);
    let householdDensity=character.buildingCount/Math.max(1e-8,selectedParcels.reduce((area,parcel)=>area+polygonArea(parcel.polygon),0));
    const districtPolygons=selectedParcels.map(parcel=>parcel.polygon.map(toWorld));
    const footprint = outline.map(toWorld);
    const corridors = [...((request.recipe.transport || {}).corridors || []),...(request.recipe.localSite?.ruralRoads||[])].filter(corridor =>
      !corridor.fieldTrack && Array.isArray(corridor.points) && corridor.points.length > 1);
    const streets = segments.flatMap(street=>clipToDistricts(street,districtPolygons))
      .flatMap(street=>clipStreetToLand(street,request.recipe));
    const wardPlan=character.mechanisms.wards?wardFabric(selectedParcels,request,toWorld,radiusKm):{wards:[],streets:[]};
    for(const ward of wardPlan.wards)ward.walls=ward.walls.filter(span=>segmentOnLand(span[0],span[1],request.recipe));
    streets.push(...wardPlan.streets.flatMap(street=>clipToDistricts(street,districtPolygons)).flatMap(street=>clipStreetToLand(street,request.recipe)));
    // Public compounds and castles own their boundaries. A population-based
    // inner district would add arbitrary walls through ordinary urban land.
    const innerEnclosures=[];
    // The profile owns era/function eligibility, including industrial military
    // settlements. The historical fortress grammar below remains separate.
    const walled = character.defence.layers>0 && (request.tier !== "site" || fortifiedSite);
    let defenceGeometry=request.recipe.localSite?.gates?{
      wallSpans:request.recipe.localSite.wallSpans||[],innerWallSpans:request.recipe.localSite.innerWallSpans||[]
    }:{wallSpans:defenceSpans(walled?districtPolygons:[],request,[],'outer'),
      innerWallSpans:defenceSpans(walled?innerEnclosures:[],request,[],'inner')};
    if(walled&&defenceGeometry.wallSpans.length){
      // Touching terrain fragments are not necessarily a usable town. Keep
      // only land served by a continuous carriageway inside the real masonry;
      // an explicit bridge can connect the usable domains on opposite banks.
      const served=serviceableParcels(selectedParcels,defenceGeometry.wallSpans,request,widths,toWorld);
      if(served.length!==selectedParcels.length){
        const wardIds=new Set(served.map(parcel=>'ward-'+parcel.channel));
        wardPlan.wards=wardPlan.wards.filter(ward=>wardIds.has(ward.id));
        selectedParcels.splice(0,selectedParcels.length,...served);
        districtPolygons.splice(0,districtPolygons.length,...served.map(parcel=>parcel.polygon.map(toWorld)));
        defenceGeometry={wallSpans:defenceSpans(districtPolygons,request,[],'outer'),
          innerWallSpans:defenceSpans(innerEnclosures,request,[],'inner')};
        householdDensity=character.buildingCount/Math.max(1e-8,served.reduce((area,parcel)=>area+polygonArea(parcel.polygon),0));
        const retained=streets.flatMap(street=>clipToDistricts(street,districtPolygons));
        streets.splice(0,streets.length,...retained);
      }
    }
    // Reserve both defensive layers before the first wall lane is extracted.
    // Later gate cuts may remove a tower; they cannot introduce an unreserved
    // inner-city corner after civic compounds and households have claimed it.
    cornerTowerSites([...defenceGeometry.wallSpans,...defenceGeometry.innerWallSpans],request,metric);
    // Bank and quay setbacks belong outside the defended urban domain.
    // Ordinary block streets cannot survive there as detached urban stubs.
    if(walled&&defenceGeometry.wallSpans.length){
      const inside=streets.flatMap(street=>streetInsideWallDomain(street,defenceGeometry.wallSpans,request));
      streets.splice(0,streets.length,...inside);
    }
    // Reserve the wall service routes before public compounds claim ground.
    // A later shrine or court must not cut a continuous wall lane in two.
    streets.push(...wallServiceStreets(defenceGeometry.wallSpans,[],
      request,districtPolygons,widths,[]));
    const publicConstraints=publicBuildingConstraints(request,districtPolygons,innerEnclosures,defenceGeometry);
    if(request.garrisonReservation&&publicConstraints.fits(request.garrisonReservation,34))
      request.garrisonReservation=publicConstraints.padding(request.garrisonReservation,34);
    // Civic compounds reserve their ground before either urban or rural routes
    // attach, so the routing skeleton and the rendered palace share a boundary.
    const publicSpaces = createPublicSpaces(request, metric, streets,districtPolygons,publicConstraints);
    const {plazas, landmarks} = publicSpaces;
    request.masonryGroups=[...wardPlan.wards.map(ward=>({walls:ward.walls,width:.0012/metric})),
      ...plazas.filter(plaza=>plaza.precinct).map(plaza=>({walls:plaza.walls,width:widths.collector*1.9}))];
    const defence=request.recipe.localSite?.gates?request.recipe.localSite:
      planDefences(request,walled?districtPolygons:[],walled?innerEnclosures:[],streets,plazas,widths,metric,defenceGeometry);
    const wallSpans=defence.wallSpans||[],innerWallSpans=defence.innerWallSpans||[],gateStreets=defence.gateStreets||[],
      gates=(defence.gates||[]).map(gate=>{
        const approaches=transportSurfaceRoutes(request,widths)
            .filter(route=>route.points.some(p=>defenceMetric(request).distance(p,gate.center)<1e-6));
        const fitted={...gate};gateOpeningRoutes.set(fitted,[{points:gate.passage,halfWidthKm:gate.widthKm},
          ...approaches.map(route=>({points:route.points,halfWidthKm:route.halfWidthKm+.001}))]);
        fitted.towers=gateTowerSites(fitted,streets,plazas,request,widths);return fitted;
      });
    request.defenceGates=gates;
    fitWardOpenings(wardPlan.wards,transportSurfaceRoutes(request,widths).concat(
      streets.concat(gateStreets).filter(street=>street.access&&!street.ward).map(street=>({points:street.points,
        halfWidthKm:(widths[street.kind]||widths.local)*metric*.5})),
      gates.map(gate=>({points:gate.passage,halfWidthKm:widths.arterial*metric*.5}))),request);
    const walls=wallSpans.flatMap(span=>wallSegmentsWithGates(span[0],span[1],gates.filter(g=>g.layer==='outer'),request));
    const innerWalls=innerWallSpans.flatMap(span=>wallSegmentsWithGates(span[0],span[1],gates.filter(g=>g.layer==='inner'||g.sharedLayers?.includes('inner')),request));
    const protectedStreets=streetsClearOfWalls(streets,[...walls,...innerWalls],request,widths);
    streets.splice(0,streets.length,...protectedStreets,...gateStreets.map(gate=>({...gate,access:true})));
    streets.push(...wallServiceStreets([],innerWallSpans,request,districtPolygons,widths,plazas));
    joinStreetLanes(streets,request,widths,plazas,null,[],[...walls,...innerWalls]);
    developCivicPrecinct(selectedParcels.filter(parcel=>parcel.civic),request,toWorld,toLocal,
      streets,plazas,landmarks,publicConstraints,[...walls,...innerWalls],widths);
    if (request.streetsOnly) return {footprint,districts:districtPolygons,streets,gateStreets,gates,wards:wardPlan.wards,
      enclosures:districtPolygons,wallSpans,innerEnclosures:walled?innerEnclosures:[],innerWallSpans,
      masonryClearance:wallClearanceIndex([...walls,...innerWalls],request,widths),
      reservedCompounds:plazas.concat(request.garrisonReservation?[{points:request.garrisonReservation,garrison:true}]:[])};
    // Consume the site's engineered alignments, station pads and real bridges.
    // Rendering and parcel planning do not invent another transport geometry.
    const baseStreets = streets.slice();
    const railwayStations=request.recipe.localSite?.railwayStations||[];
    for (const corridor of corridors) {
      const a=corridor.points[0],b=corridor.points.at(-1),dx=b.column-a.column,dy=b.row-a.row;
      const direction=Math.abs(dx)>Math.abs(dy)?(dx>0?'东':'西'):(dy>0?'南':'北');
      if(corridor.kind==='rail'){
        const b=request.recipe.localSite?.bounds||request.recipe.urban.bounds,
          bounds=[[{column:b.west,row:b.north},{column:b.east,row:b.north},{column:b.east,row:b.south},{column:b.west,row:b.south}]];
        streets.push(...clipToDistricts({id:corridor.id,kind:'rail',points:corridor.points,authoritative:true},bounds));
        continue;
      }
      streets.push(...clipToDistricts({id:corridor.id,kind:corridor.local?'collector':'arterial',name:corridor.stationAccess?'站前路':corridor.local?direction+'庄道':direction+'驿路',points:corridor.points,authoritative:true,stationAccess:corridor.stationAccess},districtPolygons));
      // A local site's ruralNetwork already owns the engineered gate and
      // corridor approaches. Cell-only atlas cities connect here instead.
      if(!request.recipe.localSite){
        let closest = null;
        for (const point of [corridor.points[0], corridor.points.at(-1)]) for (const street of baseStreets) {
          for (let index = 1; index < street.points.length; index++) {
            const target = nearestPoint(point, street.points[index - 1], street.points[index]);
            const distance = Math.hypot(point.row - target.row, point.column - target.column);
            if ((!closest || distance < closest.distance) && segmentOnLand(point, target, request.recipe)&&publicConstraints.access([point,target])) closest = {point, target, distance};
          }
        }
        if (closest && closest.distance > 1e-10 && closest.distance < Math.max(request.radiusRows, request.radiusColumns) * 0.7) {
          streets.push({id:'corridor-access-'+corridor.id,kind: "collector", points: [closest.point, closest.target], access: true});
        }
      }
    }
    const fortressParcels=householdSettlement?(garrisonParcel?[garrisonParcel]:[]):selectedParcels;
    const fortress = defensiveEra && fortifiedSite && (!request.plannedCity?.governmentCenter||['fortress','pass'].includes(request.recipe.siteType))
      ? createFortress(fortressParcels, request, toWorld, radiusKm, streets, plazas,publicConstraints) : null;
    if(fortress){request.masonryGroups.push({walls:fortress.walls,width:widths.collector*2.3});
      request.masonryTowers=fortress.towers.map(points=>({points,border:widths.local*metric*.2}));}
    const barbicans=character.defence.barbicans?createBarbicans(gates,request,widths):[];
    request.masonryGroups.push(...barbicans.map(court=>({walls:court.walls,width:widths.collector*2.8})));
    fitWardOpenings(wardPlan.wards,barbicans.map(court=>({points:court.access,halfWidthKm:widths.arterial*metric*.5}))
      .concat(fortress?[{points:fortress.access,halfWidthKm:widths.collector*metric*.5}]:[]),request);
    if (fortress) streets.push({id:'fortress-access',kind: "collector", points: fortress.access, access: true,fortressAccess:true});
    joinStreetLanes(streets,request,widths,plazas,fortress,[],[...walls,...innerWalls]);
    const protectedRoutes = streets.filter(street => street.access || street.authoritative);
    const buildings = [];
    const blocks = [];
    const districts = districtPolygons.slice();
    const occupiedParcels = [];
    // Cutting a street block around forbidden terrain creates convex pieces,
    // not new public streets. Keep its original service boundary for setbacks
    // and household lots; the retained pieces still bound actual development.
    const serviceParcels=[],serviceByChannel=new Map();
    for(const parcel of selectedParcels){
      const key=householdSettlement?parcel:parcel.channel;
      let service=serviceByChannel.get(key);
      if(!service){service={...parcel,polygon:parcel.servicePolygon,landPieces:[]};serviceByChannel.set(key,service);serviceParcels.push(service);}
      service.landPieces.push(parcel.polygon);
    }
    const landUse = planUrbanLandUse(serviceParcels, request, toWorld, corridors),
      placementMasonry=wallClearanceIndex([...walls,...innerWalls],request,widths);
    const palette = character.roof, eraPalettes=global.WorldAtlasCityEra?.palettes, monumentParcels=new Set();
    placeEraMonuments(request,serviceParcels,landUse.assignments,toWorld,plazas,landmarks,streets,widths,monumentParcels);
    for (const parcel of serviceParcels) {
      const centre = polygonCentre(parcel.polygon);
        const radial = Math.hypot(centre.x/(groundForm?.alongScale||.95), centre.y/(groundForm?.crossScale||.92));
      const use = landUse.assignments.get(parcel), reserved = monumentParcels.has(parcel),
        kind = reserved ? 'civic' : use.kind, vacant = kind === 'park';
      const worldDistrict = parcel.polygon.map(toWorld);
      let occupied = insetPolygon(parcel.polygon, roadGap*(character.mechanisms.wards?2:1));
      if (occupied.length < 3) continue;
      const ancientGrid = ['hippodamian','castrum'].includes(character.eraPlan?.id);
      const perimeter = (industrialPlan && parcel.extension || ancientGrid) && !reserved && !['industrial','warehouse','park','civic'].includes(kind) && !use.employmentDistrictId;
      if (perimeter) occupied = insetPolygon(occupied, .002/radiusKm);
      if (perimeter && parcel.chamfer && occupied.length === 4) occupied = chamferPolygon(occupied, .12);
      if (occupied.length < 3) continue;
      occupiedParcels.push(parcel.polygon);
      const workerHousing = !!use.employmentDistrictId, industrial = kind === 'industrial', storage = kind === 'warehouse';
      const developed=householdSettlement?[]:parcel.landPieces.flatMap(piece=>{
        let clipped=occupied;
        for(let i=0;i<piece.length&&clipped.length>=3;i++){
          const a=piece[i],b=piece[(i+1)%piece.length],nx=b.y-a.y,ny=a.x-b.x;
          clipped=clipHalfPlane(clipped,nx,ny,a.x*nx+a.y*ny);
        }
        return clipped.length>=3&&polygonArea(clipped)>1e-12?[clipped.map(toWorld)]:[];
      });
      for (const points of developed) {
        blocks.push({points, kind, phase:use.phase, landUseId:use.landUseId,
          fill: kind === "park" ? "#c6d3b3" : "#ede5d4", opacity: character.small?"0.24":"0.90"});
      }
      if (vacant || parcel.civic || reserved || householdSettlement) continue;
      const lots = [];
      const density = radial < 0.46 ? 1.1 : 0.65 + (1 - radial) * 0.30;
      const perBlock=Math.max(2,Math.min(28,character.buildingCount/Math.max(1,selectedParcels.length)));
      const domesticNeighborhood = (!modern||parcel.oldCore)&&!tribal&&!industrial&&!storage;
      const lotTarget = industrial ? .012/(radiusKm*radiusKm) : storage ? .004/(radiusKm*radiusKm) : domesticNeighborhood ? .008/(radiusKm*radiusKm) :
        Math.max(polygonArea(occupied) / (perBlock * density), (modern ? 0.0007 : 0.00028) / (radiusKm * radiusKm));
      const subdivideLots = (polygon, depth, channel) => {
        // A residential service block contains several private plots. Existing
        // streets can serve both edges of a 90 m strip; its gardens and inner
        // courts need no additional public lane for each household.
        const serviceDepth = domesticNeighborhood ? Math.min(
          Math.max(...polygon.map(p=>p.x))-Math.min(...polygon.map(p=>p.x)),
          Math.max(...polygon.map(p=>p.y))-Math.min(...polygon.map(p=>p.y))) * radiusKm * .5 : Infinity;
        if (depth >= 5 || serviceDepth <= .045 || polygonArea(polygon) < lotTarget * (0.8 + random(request.seed, channel) * 0.65)) { lots.push({polygon, channel}); return; }
        const division = bisectParcel(polygon, request.seed, channel, planned?0:kind === "old-town" && !rowHouseStyle ? 0.20 : 0.025);
        if (!division) { lots.push({polygon, channel}); return; }
        // Residential alleys and freight service lanes share the same cuts as
        // the plots. An enterprise has usable interior yards and sheds rather
        // than a thin ring of roofs around an enormous empty street block.
        const alley = Math.max((industrial?.006:.0009) / radiusKm, roadGap * (industrial?.35:.15));
        streets.push({id:'lane-'+channel,kind:industrial?'collector':'local',points:division.cut.map(toWorld),alley:!industrial,service:industrial});
        const first = insetPolygon(division.first, alley), second = insetPolygon(division.second, alley);
        if (first.length >= 3) subdivideLots(first, depth + 1, channel * 2 + 1);
        if (second.length >= 3) subdivideLots(second, depth + 1, channel * 2 + 2);
      };
      if (perimeter) lots.push({polygon: occupied, channel: parcel.channel + 30000});
      else subdivideLots(occupied, 0, parcel.channel + 30000);
      const lotBounds={west:Math.min(...worldDistrict.map(p=>p.column))-widths.arterial*3,east:Math.max(...worldDistrict.map(p=>p.column))+widths.arterial*3,
        north:Math.min(...worldDistrict.map(p=>p.row))-widths.arterial*3,south:Math.max(...worldDistrict.map(p=>p.row))+widths.arterial*3};
      const parcelStreets=streets.filter(s=>s.points.some((p,i)=>i&&Math.max(p.column,s.points[i-1].column)>=lotBounds.west
        &&Math.min(p.column,s.points[i-1].column)<=lotBounds.east&&Math.max(p.row,s.points[i-1].row)>=lotBounds.north&&Math.min(p.row,s.points[i-1].row)<=lotBounds.south));
      const parcelRoadIndex=character.mobile?null:streetClearanceIndex(parcelStreets,widths,request.center,.05/metric),
        roadIndexLot=points=>parcelRoadIndex?.intersects(points);
      for (const lot of lots) {
        let homes;
        if(character.mobile){
          const inset=Math.sqrt(polygonArea(lot.polygon))*.50*(.7+random(request.seed,lot.channel)*.5),shape=insetPolygon(lot.polygon,inset);
          if(shape.length<3)continue;const c=polygonCentre(shape),r=Math.sqrt(polygonArea(shape))*.31,
            points=Array.from({length:12},(_,i)=>toWorld({x:c.x+Math.cos(i*Math.PI/6)*r,y:c.y+Math.sin(i*Math.PI/6)*r}));
          homes=completeBuildingGround(points,request.recipe)?[{points,index:0,rank:random(request.seed,lot.channel+9201)}]:[];
        }else if(industrial)homes=industrialCompound(lot.polygon.map(toWorld),parcelStreets,request.recipe,lot.channel,parcelRoadIndex,placementMasonry);
        else if(perimeter){
          homes=perimeterBlock(lot.polygon.map(toWorld),parcelStreets,request,lot.channel,
            ancientGrid?{depthRange:[18,25],widthRange:[10,15],rearWings:0}:
            {depthRange:character.eraPlan.id==='boulevard'?[14,19]:[12,17],widthRange:[12,21],rearWings:character.eraPlan.id==='mill-town'?.15:.35});
          if(homes[0]?.courtPoints)blocks.push({points:homes[0].courtPoints,kind:ancientGrid?'garden':'court',phase:use.phase,landUseId:use.landUseId,court:true,opacity:'0.9'});
          homes=homes.filter(home=>!roadIndexLot(home.points)).map(({courtPoints,...home})=>home);
        }
        else homes=frontageBuilding(lot.polygon.map(toWorld),parcelStreets,request.recipe,lot.channel,
          {courtyard:courtyardStyle&&!workerHousing&&!industrial&&!storage,rowHouse:!industrial&&!storage&&(rowHouseStyle||workerHousing),industrial:industrial||storage&&modern,modern:modern&&!parcel.oldCore,roadIndex:parcelRoadIndex,masonryIndex:placementMasonry,
            land:parcel.landPieces.map(piece=>piece.map(toWorld)),
            capacity:industrial||storage?Math.max(1,Math.min(12,Math.floor(polygonArea(lot.polygon)*radiusKm*radiusKm/(industrial?.0025:.0009)))):
              industrialPlan&&(workerHousing||parcel.extension||parcel.oldCore)?64:Math.max(1,Math.min(64,Math.ceil(polygonArea(lot.polygon)*householdDensity*2)))});
        for (const home of homes) {
          const {points}=home;
          if (fortress && polygonsOverlap(points, fortress.clearancePoints)) continue;
          if (protectedRoutes.some(route => polygonNearRoute(points, route.points, (route.kind === "collector" ? widths.collector : widths.arterial) * 0.75))) continue;
          if (plazas.some(plaza => polygonsOverlap(points, plaza.points))) continue;
          const foundation=completeBuildingFoundation(points,request.recipe);
          if(foundation.reliefMetres>3.5)continue;
          const harbor=request.recipe.harbor;
          if(harbor?.reservedLand&&polygonsOverlap(points,harbor.reservedLand))continue;
          const factory=industrial&&home.compoundRole!=='warehouse';
          const workshop = !tribal&&!industrial&&!storage&&!workerHousing&&random(request.seed,home.index+9321)<.16;
          const building = {...home,kind:industrial?factory?'factory':'warehouse':workerHousing?'workers-housing':kind,foundation,
            phase:use.phase,landUseId:use.landUseId,employmentDistrictId:use.employmentDistrictId,
            ...(industrial?{estateId:'enterprise-'+lot.channel}:{}),
            use:workshop?'mixed-workshop':storage||home.compoundRole==='warehouse'?'freight-storage':industrial?'manufacturing':'housing',
            material:character.material.name,wallMaterial:character.material.wallName,
            roof:industrial?(home.compoundRole==='shed'?'sawtooth':home.compoundRole==='boiler-house'?'flat':'gable'):
              perimeter||workerHousing||storage?'gable':character.mobile?'dome':character.dwellingRoof||
              (courtyardStyle?'hip':['arcaded','terraced'].includes(character.style)?'flat':'gable'),
            fill:(()=>{
              const set=industrialPlan&&eraPalettes?(industrial?eraPalettes.industrial.factory:workerHousing?eraPalettes.industrial.workers:
                perimeter?eraPalettes.industrial.bourgeois:palette):
                character.eraPlan&&['hippodamian','castrum'].includes(character.eraPlan.id)&&eraPalettes&&character.material.name==='tile'?eraPalettes.classical:palette;
              // Neighbouring houses share a roofing material; only some differ.
              const dominant=Math.floor(random(request.seed,lot.channel+9100)*set.length);
              return random(request.seed,lot.channel+9200+home.index*7)<.72?set[dominant]:set[Math.floor(random(request.seed,lot.channel+9300+home.index*7)*set.length)];
            })(),...(perimeter?{perimeter:true}:{})};
          if (perimeter) {
            delete building.ridge;
            if (ancientGrid && !home.rearWing) {
              // Greek and Roman town houses open onto an inner court or atrium.
              const polygon=points.map(point=>({x:point.column,y:point.row})),inner=insetPolygon(polygon,Math.sqrt(polygonArea(polygon))*.27);
              if(inner.length>=3&&polygonArea(inner)>polygonArea(polygon)*.08){
                building.courtyard=inner.map(point=>({column:point.x,row:point.y}));building.roof='hip';
                building.roofLines=roofLines(points,building.courtyard,'hip');buildings.push(building);continue;
              }
            }
            building.roofLines=home.ridge?[home.ridge]:roofLines(points,null,'gable');
            buildings.push(building);continue;
          }
          if (courtyardStyle && !tribal && !industrial && !storage && !workerHousing) {
            const polygon = points.map(point => ({x: point.column, y: point.row}));
            const inner = insetPolygon(polygon, Math.sqrt(polygonArea(polygon)) * (request.culturalStyle === "walled-compound" ? 0.16 : 0.23));
            if (inner.length >= 3) building.courtyard = inner.map(point => ({column: point.x, row: point.y}));
          }
          building.roofLines = roofLines(building.points, building.courtyard,building.roof);
          buildings.push(building);
        }
      }
    }
    if(householdSettlement)buildings.push(...settlementFrontageBuildings(request,streets,character.defence.layers>0?districtPolygons:[footprint],plazas,fortress,widths,metric));
    let safeStreets=streets.filter(street=>street.kind!=='rail');
    for(const plaza of plazas)safeStreets=safeStreets.flatMap(street=>streetOutsidePolygon(street,plaza.points));
    for(const station of railwayStations)safeStreets=safeStreets.flatMap(street=>streetOutsidePolygon(street,station.points));
    if(fortress)safeStreets=safeStreets.flatMap(street=>street.fortressAccess?[street]:streetOutsidePolygon(street,fortress.clearancePoints));
    if(walled&&!householdSettlement&&defenceGeometry.wallSpans.length)safeStreets=safeStreets.flatMap(street=>
      !street.authoritative&&/^(street|lane)-/.test(street.id||'')?streetInsideWallDomain(street,defenceGeometry.wallSpans,request):[street]);
    safeStreets=safeStreets.flatMap(street=>clipStreetToLand(street,request.recipe));
    safeStreets=streetsClearOfWalls(safeStreets,[...walls,...innerWalls],request,widths);
    joinStreetLanes(safeStreets,request,widths,plazas,fortress,buildings,[...walls,...innerWalls]);
    safeStreets.push(...streets.filter(street=>street.kind==='rail'));
    const towers = wallTowers([...walls, ...innerWalls], request, metric, safeStreets,gates);
    request.masonryTowers=[...(request.masonryTowers||[]),...towers.map(tower=>({points:tower.points,border:.000325}))];
    const rural=countryHouses(request,corridors,occupiedParcels.map(polygon=>polygon.map(toWorld)),metric,widths,[...walls,...innerWalls]);
    const reservations=gates.flatMap(gate=>gate.towers).concat(towers.map(t=>t.points),barbicans.map(b=>b.points));
    const roadIndex=streetClearanceIndex(safeStreets,widths,request.center,.075/metric);
    // A river setback can leave dry parcel fragments outside the actual outer
    // enclosure. They cannot host urban households or cover a future gate.
    const housingWallDomain=walled&&!householdSettlement?defenceGeometry.wallSpans:[],
      housingWalls=housingWallDomain.length?housingWallDomain:walls;
    let safeBuildings=buildings.filter(building=>!railwayStations.some(station=>polygonsOverlap(building.points,station.points))
      &&(!housingWallDomain.length||building.points.concat(building.points.map((point,i)=>({
        column:(point.column+building.points[(i+1)%building.points.length].column)*.5,
        row:(point.row+building.points[(i+1)%building.points.length].row)*.5
      })),[{column:building.points.reduce((sum,p)=>sum+p.column,0)/building.points.length,
        row:building.points.reduce((sum,p)=>sum+p.row,0)/building.points.length}]).every(point=>wallDomainContains(point,housingWallDomain)))
      &&!reservations.some(points=>polygonsOverlap(building.points,points))
      &&![...housingWalls,...innerWalls].some(wall=>polygonNearRoute(building.points,wall,widths.collector*1.8))
      &&!roadIndex.intersects(building.points));
    rural.houses=rural.houses.filter(house=>!barbicans.some(b=>polygonsOverlap(house.points,b.points)));
    nameStreets(safeStreets,request);
    const moats=defensiveDitches(request,fortress,[],toWorld,safeStreets,landmarks);
    safeBuildings=safeBuildings.filter(building=>!moats.some(m=>polygonNearRoute(building.points,m.points.concat(m.points[0]),m.widthMetres/1500/metric)));
    const masonryIndex=wallClearanceIndex([...walls,...innerWalls],request,widths);
    safeBuildings=attachBuildingFrontages(safeBuildings,safeStreets,request.recipe)
      .filter(building=>!masonryIndex.intersects(building.points)&&masonryIndex.clearAccess(building.access));
    rural.houses=rural.houses.filter(house=>!masonryIndex.intersects(house.points)&&masonryIndex.clearAccess(house.access,'country-access'));
    const enterprises=new Set(safeBuildings.filter(b=>b.compoundRole==='mill').map(b=>b.estateId));
    safeBuildings=safeBuildings.filter(b=>!b.estateId||enterprises.has(b.estateId));
    const housingCandidates=safeBuildings;
    safeBuildings=allocateFrontageBudget(safeBuildings,industrialPlan?Infinity:character.buildingCount);
    safeStreets=pruneUnservedStreetStubs(safeStreets,safeBuildings,request,widths);
    // The completed household fabric can leave an alley behind a concave
    // wall corner. Join that occupied fabric after its roofs are fixed; the
    // site-planning street skeleton retains its original local join radius.
    joinStreetLanes(safeStreets,request,widths,plazas,fortress,safeBuildings,[...walls,...innerWalls],.075);
    // Fill the population from complete lots on the real accessible road
    // network. A steep gap cannot become inhabited merely because both banks
    // have dry building ground, and a final legal link may cross an unused lot.
    const completedRoads=streetClearanceIndex(safeStreets,widths,request.center,.075/metric),
      completeCandidates=attachBuildingFrontages(housingCandidates.filter(building=>!completedRoads.intersects(building.points)),safeStreets,request.recipe)
        .filter(building=>masonryIndex.clearAccess(building.access)),
      accessible=accessibleFrontageBuildings(completeCandidates,safeStreets,request,widths);
    safeBuildings=allocateFrontageBudget(accessible,industrialPlan?Infinity:character.buildingCount);
    const housingCapacity={target:character.buildingCount,placed:safeBuildings.length,accessible:accessible.length,
      limited:safeBuildings.length<character.buildingCount*(industrialPlan||character.eraPlan?.id&&character.eraPlan.id!=='temple-city'?.6:1),reason:safeBuildings.length<character.buildingCount?'terrain-road-access':null};
    for(const moat of moats)moat.crossings=ditchCrossings(moat,safeStreets,request);
    const farmland=(request.recipe.localSite?.farmland||[]).filter(field=>!request.recipe.harbor?.reservedLand||!polygonsOverlap(field.points,request.recipe.harbor.reservedLand))
      .filter(field=>!rural.lanes.some(lane=>polygonNearRoute(field.points,lane,widths.local*1.2))
      &&!rural.houses.some(house=>polygonsOverlap(field.points,house.yard)));
    const trees=global.WorldAtlasCitySite.clearTreeCrowns(request.recipe,safeStreets.concat(rural.lanes.map(points=>({kind:'local',points}))),
      [...safeBuildings.map(building=>building.plotPoints||building.points),...rural.houses.map(home=>home.yard),
        ...plazas.map(plaza=>plaza.points),...landmarks.map(landmark=>landmark.points)]);
    return {footprint,blocks,districts,landUse:landUse.summary,streets:safeStreets,railwayStations,buildings:safeBuildings,housingCapacity,farmland,trees,
      walls,innerWalls,wallSpans,innerWallSpans,enclosures:districtPolygons,innerEnclosures,towers,gates,gateStreets,barbicans,moats,plazas,wards:wardPlan.wards,landmarks,countryside:rural.houses,countryLanes:rural.lanes,hamlets:rural.hamlets,fortress};
  }

  function accessibleFrontageBuildings(buildings,streets,request,widths){
    if(request.character.mobile||!buildings.length)return buildings;
    const recipe=request.recipe,{m,distance,project}=defenceMetric(request),metric=gridCellKilometres(recipe,request.radiusRows,request.radiusColumns),
      regional=(recipe.transport?.corridors||[]).filter(road=>road.kind==='road'),
      roads=streets.filter(street=>street.kind!=='rail').concat(regional,
        (recipe.localSite?.ruralRoads||[]).filter(road=>road.kind!=='rail'),
        (recipe.localSite?.ruralSettlements||[]).flatMap(village=>village.localLanes)),
      regionalSet=new Set(regional),parents=roads.map((road,i)=>i),
      root=i=>parents[i]===i?i:parents[i]=root(parents[i]),
      join=(a,b)=>{a=root(a);b=root(b);if(a!==b)parents[a]=b;},
      half=road=>(road.fieldTrack ? .0018:['arterial','collector','local'].includes(road.kind)?
        widths[road.kind]*metric:(recipe.urban.streetWidthsMetres[road.local?'collector':'arterial']/1000))*.5,
      segments=roads.flatMap((road,route)=>road.points.slice(1).map((b,i)=>{
        const a=road.points[i],margin=half(road);return {a,b,route,index:0,bounds:{
          west:Math.min(a.column,b.column)-margin/m.column,east:Math.max(a.column,b.column)+margin/m.column,
          north:Math.min(a.row,b.row)-margin/m.row,south:Math.max(a.row,b.row)+margin/m.row}};
      }));
    segments.forEach((segment,i)=>segment.index=i);
    const nearby=boundsIndex(segments,request.center,.075/metric);
    for(const first of segments)for(const second of nearby(first.bounds)){
      if(second.index<=first.index||root(first.route)===root(second.route))continue;
      const {a,b}=first,{a:c,b:d}=second,dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,
        sx=(d.column-c.column)*m.column,sy=(d.row-c.row)*m.row,cx=(c.column-a.column)*m.column,cy=(c.row-a.row)*m.row,den=dx*sy-dy*sx;
      let crossed=false;if(Math.abs(den)>1e-16){const t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;
        crossed=t>=0&&t<=1&&u>=0&&u<=1;}
      if(crossed||Math.min(distance(a,project(a,c,d)),distance(b,project(b,c,d)),
        distance(c,project(c,a,b)),distance(d,project(d,a,b)))<=half(roads[first.route])+half(roads[second.route])+1e-8)join(first.route,second.route);
    }
    const byId=new Map();roads.forEach((road,i)=>{if(!byId.has(road.id))byId.set(road.id,[]);byId.get(road.id).push(i);});
    const memberships=buildings.map(building=>{
      const p=building.access?.at(-1);if(!p)return [];
      const candidates=building.frontage?.streetId?byId.get(building.frontage.streetId)||[]:
        [...new Set(nearby(polygonBounds([p])).map(segment=>segment.route))];
      return [...new Set(candidates.filter(i=>roads[i].points.slice(1).some((b,j)=>
        distance(p,project(p,roads[i].points[j],b))<1e-5)).map(root))];
    }),components=new Map();
    for(let i=0;i<roads.length;i++){
      const key=root(i);if(!components.has(key))components.set(key,{key,count:0,regional:false,near:Infinity});
      const component=components.get(key);component.regional||=regionalSet.has(roads[i]);
      for(const p of roads[i].points)component.near=Math.min(component.near,distance(p,request.center));
    }
    for(const groups of memberships)for(const key of groups)components.get(key).count++;
    const primary=[...components.values()].filter(component=>component.count).sort((a,b)=>
      Number(b.regional)-Number(a.regional)||b.count-a.count||a.near-b.near||a.key-b.key)[0];
    return primary?buildings.filter((building,i)=>memberships[i].includes(primary.key)):[];
  }

  // Allocate scarce population to whole runs of frontage. Randomly deleting
  // individual roofs after packing a terrace creates an uninhabited street.
  function allocateFrontageBudget(buildings,budget) {
    if(buildings.length<=budget)return buildings;
    const productive=buildings.filter(b=>b.estateId),homes=buildings.filter(b=>!b.estateId);
    if(productive.length){
      return productive.concat(allocateFrontageBudget(homes,Math.max(0,budget-productive.length)));
    }
    const byFrontage=new Map();
    for(const building of buildings){
      const key=building.frontage?.groupId||building.landUseId||'settlement';
      if(!byFrontage.has(key))byFrontage.set(key,[]);byFrontage.get(key).push(building);
    }
    const groups=Array.from(byFrontage.values()).map((members,index)=>{
      const exact=members.length*budget/buildings.length;
      return {members,index,count:Math.floor(exact),remainder:exact-Math.floor(exact)};
    });
    let remaining=budget-groups.reduce((sum,g)=>sum+g.count,0);
    for(const group of groups.slice().sort((a,b)=>b.remainder-a.remainder||a.index-b.index))if(remaining-->0)group.count++;
    return groups.flatMap(group=>{
      const ordered=group.members.slice().sort((a,b)=>(a.frontage?.position||0)-(b.frontage?.position||0));
      const start=Math.floor((ordered.length-group.count)/2);return ordered.slice(start,start+group.count);
    });
  }

  // Assign uses once at the street-block scale, before plots or roofs exist.
  // These bounded modelling choices describe historical relationships, not
  // universal historical zoning percentages. See historical-urban-morphology.
  function planUrbanLandUse(parcels, request, toWorld, corridors) {
    const modern = ['industrial','contemporary'].includes(request.era), m = request.recipe.urban.gridCellKilometres;
    const distance = (a,b) => Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row);
    const routeDistance = (point,points) => Math.min(...points.slice(1).map((b,i)=>{
      const a=points[i],x=(b.column-a.column)*m.column,y=(b.row-a.row)*m.row,
        t=Math.max(0,Math.min(1,((point.column-a.column)*m.column*x+(point.row-a.row)*m.row*y)/(x*x+y*y||1)));
      return distance(point,{column:a.column+x*t/m.column,row:a.row+y*t/m.row});
    }));
    const form=request.recipe.localSite?.form, assignments=new Map(), entries=parcels.map((parcel,index)=>{
      const c=polygonCentre(parcel.polygon),center=toWorld(c),radial=Math.hypot(c.x/(form?.alongScale||.95),c.y/(form?.crossScale||.92)),
        industrialPlan=!!request.character.eraPlan?.industrial,
        historic=industrialPlan?!!parcel.oldCore:request.character.mechanisms.multiPhase?Math.hypot(c.x+.18,c.y+.08)<.48:radial<(modern?.40:.52),
        civic=parcel.civic||(request.recipe.urban.coreZones||[]).some(core=>distance(center,core)<Math.min(.18,request.recipe.urban.radiusKm*.12)),
        entry={parcel,index,center,radial,area:polygonArea(parcel.polygon),kind:civic?'civic':historic?'old-town':modern||request.character.mechanisms.multiPhase?'planned-extension':'residential',
          phase:historic||civic?'historic-core':modern?'industrial-extension':'preindustrial-extension',landUseId:'neighborhood-'+index};
      assignments.set(parcel,entry);return entry;
    });
    const eraPlan=request.character.eraPlan,industrialPlan=!!eraPlan?.industrial;
    const totalArea=entries.reduce((sum,e)=>sum+e.area,0),industryBudget=totalArea*(industrialPlan?eraPlan.id==='mill-town'?.22:.15:.10),port=request.recipe.harbor;
    const rails=corridors.filter(c=>c.kind==='rail'),freightReach=Math.min(industrialPlan?1.1:.8,Math.max(.25,request.recipe.urban.radiusKm*(industrialPlan?.3:.18)));
    const rivers=industrialPlan?(request.recipe.localSite?.channels||[]).filter(c=>c.kind==='river'&&c.points?.length>1):[];
    const leeward=toWorld({x:.8,y:.15});
    const freightDistance=e=>{
      const d=Math.min(port?.shore?distance(e.center,port.shore):Infinity,...rails.map(r=>routeDistance(e.center,r.points)),...rivers.map(r=>routeDistance(e.center,r.points)));
      return Number.isFinite(d)||!industrialPlan?d:distance(e.center,leeward)*.5;
    };
    const candidates=modern&&!request.character.small?entries.filter(e=>(industrialPlan?!e.parcel.oldCore&&!e.parcel.reserve:e.radial>.40)&&e.kind!=='civic'&&e.area<=industryBudget&&freightDistance(e)<freightReach):[];
    // One connected employment district grows along a genuine freight anchor.
    // Passenger approach roads and ordinary highways do not establish industry.
    candidates.sort((a,b)=>freightDistance(a)-freightDistance(b)||a.index-b.index);
    const industry=[],remaining=new Set(candidates);let industrialArea=0;
    while(remaining.size){
      const next=Array.from(remaining).find(e=>industrialArea+e.area<=industryBudget&&(!industry.length||industry.some(other=>parcelNeighbours(e.parcel.polygon,other.parcel.polygon))));
      if(!next)break;remaining.delete(next);industry.push(next);industrialArea+=next.area;
      next.kind='industrial';next.phase='industrial-extension';next.landUseId='freight-district';
    }
    // Port trade predates factories. Storehouses stay near the actual landing;
    // a settlement's maritime label alone never invents a waterfront.
    let storageArea=0;
    if(port?.shore&&!request.character.small)for(const e of entries.slice().sort((a,b)=>distance(a.center,port.shore)-distance(b.center,port.shore))){
      if(['industrial','civic','old-town'].includes(e.kind)||storageArea+e.area>totalArea*.035||distance(e.center,port.shore)>freightReach)continue;
      e.kind='warehouse';e.landUseId='harbor-warehouses';storageArea+=e.area;
    }
    let workerArea=0,parkArea=0;
    const workerBudget=totalArea*(eraPlan?.id==='mill-town'?.42:industrialPlan?.2:.16),workers=[];
    for(let changed=true;changed&&request.era==='industrial';){
      changed=false;
      for(const e of entries){
        if(e.employmentDistrictId||e.kind!=='planned-extension'||workerArea+e.area>workerBudget)continue;
        if(industry.some(other=>parcelNeighbours(e.parcel.polygon,other.parcel.polygon))
          ||industrialPlan&&workers.some(other=>parcelNeighbours(e.parcel.polygon,other.parcel.polygon))){
          e.employmentDistrictId='freight-district';workerArea+=e.area;workers.push(e);changed=true;
        }
      }
      if(!industrialPlan)break;
    }
    for(const e of entries){
      if(!request.character.small&&!e.employmentDistrictId&&['residential','planned-extension'].includes(e.kind)
        &&parkArea+e.area<=totalArea*.05&&random(request.seed,e.parcel.channel+17000)<(e.radial>.8?.07:.025)){
        e.kind='park';parkArea+=e.area;
      }
    }
    return {assignments,summary:{industrialAreaFraction:totalArea?industrialArea/totalArea:0,
      storageAreaFraction:totalArea?storageArea/totalArea:0,industrialDistricts:industry.length?1:0}};
  }

  function boundsIndex(entries,center,size){
    const bins=new Map(),keys=b=>{const out=[];
      for(let y=Math.floor((b.north-center.row)/size);y<=Math.floor((b.south-center.row)/size);y++)
        for(let x=Math.floor((b.west-center.column)/size);x<=Math.floor((b.east-center.column)/size);x++)out.push(x+','+y);
      return out;
    };
    for(const [index,entry] of entries.entries())for(const key of keys(entry.bounds)){
      if(!bins.has(key))bins.set(key,[]);bins.get(key).push(index);
    }
    return bounds=>Array.from(new Set(keys(bounds).flatMap(key=>bins.get(key)||[])))
      .sort((a,b)=>a-b).map(index=>entries[index]);
  }

  function streetClearanceIndex(streets,widths,center,size){
    const entries=[];
    for(const street of streets)for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],width=(widths[street.kind]||widths.local)*.60,entry={points:[a,b],width};
      entry.bounds={west:Math.min(a.column,b.column)-width,east:Math.max(a.column,b.column)+width,
        north:Math.min(a.row,b.row)-width,south:Math.max(a.row,b.row)+width};entries.push(entry);
    }
    const candidates=boundsIndex(entries,center,size);
    return {intersects(points){for(const entry of candidates(polygonBounds(points)))
      if(polygonNearRoute(points,entry.points,entry.width))return true;return false;}};
  }

  function defensiveDitches(request,fortress,innerParcels,toWorld,streets,landmarks){
    const site=request.recipe.localSite;if(!site||!request.character.defence.layers||!['plain','hills'].includes(site.form.kind))return [];
    const candidates=[];
    if(fortress?.moatEligible)candidates.push({points:fortress.clearancePoints,name:request.character.prefix+'卫城'});
    if(request.character.capital&&innerParcels.length){
      const points=innerParcels.flatMap(p=>p.map(toWorld)),sorted=points.map(p=>({x:p.column,y:p.row})).sort((a,b)=>a.x-b.x||a.y-b.y),cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x),lower=[],upper=[];
      for(const p of sorted){while(lower.length>1&&cross(lower.at(-2),lower.at(-1),p)<=0)lower.pop();lower.push(p);}
      for(const p of sorted.slice().reverse()){while(upper.length>1&&cross(upper.at(-2),upper.at(-1),p)<=0)upper.pop();upper.push(p);}
      candidates.push({points:lower.slice(0,-1).concat(upper.slice(0,-1)).map(p=>({column:p.x,row:p.y})),name:'内城'});
    }
    const result=[],metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns);
    for(const candidate of candidates){if(candidate.points.length<3)continue;
      const centre=polygonCentre(candidate.points.map(p=>({x:p.column,y:p.row}))),points=candidate.points.map(p=>{
        const dx=p.column-centre.x,dy=p.row-centre.y,len=Math.hypot(dx,dy);return {column:p.column+dx/len*.024/metric,row:p.row+dy/len*.024/metric};});
      if(!points.every((p,i)=>segmentOnLand(p,points[(i+1)%points.length],request.recipe))||landmarks.some(l=>polygonNearRoute(l.compoundPoints,points.concat(points[0]),.012/metric)))continue;
      const foundation=foundationAt(points,request.recipe);if(foundation.reliefMetres>8)continue;
      const wet=foundation.reliefMetres<1.8&&site.channels.length>0,widthMetres=candidate.name==='内城'?18:12;
      result.push({points,name:candidate.name+(wet?'护城河':'防御壕'),wet,widthMetres,crossings:[],foundation});
    }return result;
  }

  function ditchCrossings(moat,streets,request){
    const crossings=[],{m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      widths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),points=moat.points;
    for(const street of streets.filter(street=>street.kind!=='rail'))for(let i=1;i<street.points.length;i++)for(let j=0;j<points.length;j++){
      const a=street.points[i-1],b=street.points[i],c=points[j],d=points[(j+1)%points.length],dx=b.column-a.column,dy=b.row-a.row,sx=d.column-c.column,sy=d.row-c.row,den=dx*sy-dy*sx;
      if(Math.abs(den)<1e-16)continue;const t=((c.column-a.column)*sy-(c.row-a.row)*sx)/den,u=((c.column-a.column)*dy-(c.row-a.row)*dx)/den;
      if(t<0||t>1||u<0||u>1)continue;
      const len=Math.hypot(dx*m.column,dy*m.row),half=moat.widthMetres*.8/1000;
      if(len<1e-12)continue;
      const center={column:a.column+dx*t,row:a.row+dy*t},widthMetres=(widths[street.kind]||widths.collector)*metric*1000;
      if(crossings.some(crossing=>crossing.streetId===street.id&&Math.hypot((crossing.center.column-center.column)*m.column,(crossing.center.row-center.row)*m.row)<1e-7))continue;
      crossings.push({streetId:street.id,center,widthMetres,points:[-1,1].map(sign=>({column:center.column+dx/len*half*sign,row:center.row+dy/len*half*sign}))});
    }return crossings;
  }

  function createBarbicans(gates,request,widths){
    const courts=[],{m,distance,shift}=defenceMetric(request),
      width=widths.arterial*(m.column+m.row)*.5,depth=Math.max(width*4,.065),opening=width*.9,
      roads=[...(request.recipe.transport?.corridors||[]),...(request.recipe.localSite?.ruralRoads||[])].filter(road=>road.kind==='road');
    for(const gate of gates.filter(g=>g.layer==='outer')){
      if(courts.length>=4)break;
      const normal=gate.outward,tangent={x:-normal.y,y:normal.x},
        local=p=>{const x=(p.column-gate.center.column)*m.column,y=(p.row-gate.center.row)*m.row;
          return {x:x*tangent.x+y*tangent.y,y:x*normal.x+y*normal.y};},
        at=(x,y)=>shift(gate.center,tangent.x*x+normal.x*y,tangent.y*x+normal.y*y);
      let entrance=null;
      // The routed approach already passes through the main gate. Follow it
      // to the outer court wall instead of inventing another straight exit.
      for(const road of roads){
        const index=road.points.findIndex(p=>distance(p,gate.center)<1e-6);if(index<0)continue;
        for(const direction of [-1,1]){
          const access=[gate.center];
          for(let i=index+direction;i>=0&&i<road.points.length;i+=direction){
            const a=access.at(-1),b=road.points[i],first=local(a),last=local(b);
            if(last.y<-.001)break;
            if(first.y<=depth&&last.y>=depth&&last.y-first.y>1e-9){
              const t=(depth-first.y)/(last.y-first.y),front={column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t},x=local(front).x;
              if(Math.abs(x)>depth)break;
              access.push(front);const remaining=distance(front,b);
              if(remaining>1e-8){const fraction=Math.min(1,width/remaining);access.push({column:front.column+(b.column-front.column)*fraction,row:front.row+(b.row-front.row)*fraction});}
              entrance={x,access};break;
            }
            if(Math.hypot(last.x,last.y)>depth*3)break;access.push(b);
          }
          if(entrance)break;
        }
        if(entrance)break;
      }
      if(!entrance)continue;
      const half=Math.max(width*2.2,.026,Math.abs(entrance.x)+opening+widths.collector*(m.column+m.row)/2*1.4+.002);
      const points=[at(-half,0),at(half,0),at(half,depth),at(-half,depth)];
      if(!points.every((p,i)=>segmentOnLand(gate.center,p,request.recipe)&&segmentOnLand(p,points[(i+1)%points.length],request.recipe)))continue;
      const access=entrance.access,walls=fitWallOpenings(
        [[points[0],points[3]],[points[1],points[2]],[points[3],at(entrance.x-opening,depth)],[at(entrance.x+opening,depth),points[2]]],
        [{points:access,halfWidthKm:width*.5+.001}],widths.collector*2.8,request);
      if(!access.every((p,i)=>!i||segmentOnLand(access[i-1],p,request.recipe)))continue;
      if(masonryBlocksTransport(walls,widths.collector*2.8,request,widths))continue;
      courts.push({points,walls,access,gateId:gate.id,name:gate.name+'瓮城'});
    }return courts;
  }

  // Villages grow beside connected lanes, rather than inside urban BSP blocks.
  // Every lane uses the same dry ground and metre slope constraints as houses.
  function villageStreets(request,outline,toWorld,radiusKm){
    const recipe=request.recipe,m=recipe.urban.gridCellKilometres,
      n=Math.max(17,Math.min(65,Math.ceil(radiusKm*2/.012)+1)),points=[],allowed=[],links=[],roads=[],network=new Set(),
      distance=(a,b)=>Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row),
      phase=random(request.seed,58001)*Math.PI*2,
      roadGround=request.character.defence.layers>0?insetPolygon(outline,.016/radiusKm):outline;
    let garrisonParcel=null;
    if(request.character.defence.layers>0){
      const half=Math.min(.22,.070/radiusKm),sites=[],garrisonGround=insetPolygon(outline,.050/radiusKm),
        fixedRoads=recipe.localSite?[]:(recipe.transport?.corridors||[]);
      // Leave space for the complete fort pad, ditch and outside city wall.
      for(const [x,y] of [[0,0],[-.30,-.36],[-.30,.36],[.30,-.36],[.30,.36]]){
        const polygon=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([dx,dy])=>({x:x+dx*half,y:y+dy*half})),world=polygon.map(toWorld);
        if(polygon.every(p=>containsPoint(outline,p))&&world.every((p,i)=>segmentOnLand(p,world[(i+1)%4],recipe))
          &&!fixedRoads.some(road=>polygonNearRoute(world,road.points,.005/gridCellKilometres(recipe,request.radiusRows,request.radiusColumns)))
          &&foundationAt(world,recipe).reliefMetres<4)sites.push({polygon,channel:58003,elevation:foundationAt(world,recipe).elevationMetres,
            moatRoom:garrisonGround.length>=3&&polygon.every(p=>containsPoint(garrisonGround,p))});
      }sites.sort((a,b)=>Number(b.moatRoom)-Number(a.moatRoom)||b.elevation-a.elevation);garrisonParcel=sites[0]||null;
    }
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const u=x/(n-1)*2-1,v=y/(n-1)*2-1,
        p={x:u,y:v},world=toWorld(p);
      points.push(world);allowed.push(containsPoint(roadGround,p)&&(!garrisonParcel||!containsPoint(garrisonParcel.polygon,p))&&segmentOnLand(world,world,recipe));links.push([]);
    }
    for(let i=0;i<points.length;i++)if(allowed[i]){
      const x=i%n,y=Math.floor(i/n);
      for(const [sx,sy] of [[1,0],[0,1],[1,1],[-1,1]]){
        if(x+sx<0||x+sx>=n||y+sy>=n)continue;const j=i+sy*n+sx;
        if(!allowed[j]||!segmentOnLand(points[i],points[j],recipe)
          ||garrisonParcel&&clipToDistricts({points:[points[i],points[j]]},[garrisonParcel.polygon.map(toWorld)]).length)continue;
        const length=distance(points[i],points[j]),heights=recipe.localSite?.surface,
          grade=heights?Math.abs(global.WorldAtlasCitySite.elevationAt(heights,points[i])-global.WorldAtlasCitySite.elevationAt(heights,points[j]))/(length*1000):0;
        if(grade>.12)continue;
        const cost=length*(1+grade*12);links[i].push([j,cost]);links[j].push([i,cost]);
      }
    }
    const pathsFrom=sources=>{
      const costs=new Float64Array(points.length).fill(Infinity),parents=new Int32Array(points.length).fill(-1),heap=[];
      const put=(i,cost)=>{let k=heap.length;heap.push([i,cost]);while(k){const p=(k-1)>>1;if(heap[p][1]<=cost)break;heap[k]=heap[p];k=p;}heap[k]=[i,cost];};
      const take=()=>{const first=heap[0],last=heap.pop();if(heap.length){let k=0;while(k*2+1<heap.length){let c=k*2+1;if(c+1<heap.length&&heap[c+1][1]<heap[c][1])c++;if(heap[c][1]>=last[1])break;heap[k]=heap[c];k=c;}heap[k]=last;}return first;};
      for(const i of sources){costs[i]=0;put(i,0);}
      while(heap.length){const [i,cost]=take();if(cost!==costs[i])continue;
        for(const [j,weight] of links[i])if(cost+weight<costs[j]){costs[j]=cost+weight;parents[j]=i;put(j,costs[j]);}}
      return {costs,parents};
    };
    const nearest=(target,reach)=>{let best=-1,minimum=Infinity;for(let i=0;i<points.length;i++)if(allowed[i]&&(!reach||Number.isFinite(reach.costs[i]))){
      const d=distance(points[i],target);if(d<minimum){minimum=d;best=i;}}return best;};
    const root=nearest(request.center);if(root<0)return {streets:[],garrisonParcel};
    const reachable=pathsFrom([root]),trace=(target,map)=>{const path=[];for(let i=target;i>=0;i=map.parents[i])path.push(i);return path.reverse();};
    const add=(indices,kind)=>{
      if(indices.length<2)return;indices.forEach(i=>network.add(i));
      roads.push({kind,indices});
    };
    // Regional approaches establish the village's first street. Later lanes
    // serve new domestic ground; they are not copies of a full-width row.
    const entryPoints=(recipe.transport?.corridors||[]).filter(road=>road.kind==='road'&&!road.fieldTrack)
      .flatMap(road=>clipToDistricts(road,[outline.map(toWorld)]).flatMap(run=>[run.points[0],run.points.at(-1)])),entries=[];
    for(const p of entryPoints){const i=nearest(p,reachable);if(i>=0&&distance(points[i],points[root])>radiusKm*.40
      &&entries.every(j=>distance(points[i],points[j])>radiusKm*.35))entries.push(i);}
    if(entries.length<2)for(const x of [Math.min(...roadGround.map(p=>p.x)),Math.max(...roadGround.map(p=>p.x))]){
      const i=nearest(toWorld({x,y:0}),reachable);if(!entries.includes(i))entries.push(i);
    }
    for(const entry of entries.slice(0,4))add(trace(entry,reachable),'collector');
    const hubs=[0,1,2].map(i=>nearest(toWorld({x:Math.cos(phase+i*Math.PI*2/3)*.34,
      y:Math.sin(phase+i*Math.PI*2/3)*.34}),reachable));
    for(let i=0;i<hubs.length;i++)add(trace(hubs[(i+1)%hubs.length],pathsFrom([hubs[i]])),'local');
    const edgeLength=()=>{const seen=new Set();let length=0;for(const road of roads)for(let j=1;j<road.indices.length;j++){
      const a=road.indices[j-1],b=road.indices[j],key=a<b?a+':'+b:b+':'+a;if(!seen.has(key)){seen.add(key);length+=distance(points[a],points[b]);}
    }return length;};
    // Even the shallowest two private plots need about fifty metres between
    // parallel lanes, including the carriageways and verges. Closer branches
    // promise the same backyards to households on two different streets.
    const neededLength=request.character.buildingCount*.027;
    for(let growth=0;growth<90&&edgeLength()<neededLength;growth++){
      const map=pathsFrom(network);let target=-1,score=0;
      for(let i=0;i<points.length;i++)if(allowed[i]&&Number.isFinite(map.costs[i])&&map.costs[i]>.050){
        const x=i%n/(n-1)*2-1,y=Math.floor(i/n)/(n-1)*2-1,
          bearing=Math.atan2(y,x),reach=.90+.05*Math.sin(bearing*3+phase),
          radial=Math.hypot(x/Math.max(.3,Math.max(...outline.map(p=>Math.abs(p.x)))),y/Math.max(.3,Math.max(...outline.map(p=>Math.abs(p.y)))));
        if(radial>reach)continue;
        const intensity=.30+Math.exp(-radial*radial*2.6),priority=map.costs[i]*intensity;
        if(priority>score){score=priority;target=i;}
      }
      if(target<0)break;
      add(trace(target,map),'local');
    }
    // The landing is a destination on the same graph. Rural routing can then
    // continue from this exact entrance to the quay without a detached port.
    if(recipe.harbor&&request.character.defence.layers===0){
      const entrance=recipe.harbor.landPoint,target=nearest(entrance,reachable),map=pathsFrom(network);
      add(trace(target,map),'collector');
      if(segmentOnLand(points[target],entrance,recipe)&&distance(points[target],entrance)<radiusKm*.8){
        points.push(entrance);add([target,points.length-1],'collector');
      }
    }
    // Join shared graph edges before smoothing, retaining every real junction.
    const graph=new Map(),edges=new Map(),visited=new Set(),result=[],key=(a,b)=>a<b?a+':'+b:b+':'+a;
    for(const road of roads)for(let k=1;k<road.indices.length;k++){
      const a=road.indices[k-1],b=road.indices[k];if(a===b)continue;
      if(!graph.has(a))graph.set(a,new Set());if(!graph.has(b))graph.set(b,new Set());graph.get(a).add(b);graph.get(b).add(a);
      const id=key(a,b);if(!edges.has(id)||road.kind==='collector')edges.set(id,road.kind);
    }
    const chain=(start,next)=>{const indices=[start],kinds=[];let a=start,b=next;
      while(!visited.has(key(a,b))){visited.add(key(a,b));kinds.push(edges.get(key(a,b)));indices.push(b);
        if(graph.get(b).size!==2)break;const c=Array.from(graph.get(b)).find(i=>i!==a);a=b;b=c;
      }
      const path=indices.map(i=>points[i]),simplified=[path[0]];
      for(let start=0;start<path.length-1;){let end=start+1;
        for(let next=end+1;next<path.length;next++){
          if(!segmentOnLand(path[start],path[next],recipe)
            ||garrisonParcel&&clipToDistricts({points:[path[start],path[next]]},[garrisonParcel.polygon.map(toWorld)]).length
            ||path.slice(start+1,next).some(p=>distance(p,nearestPoint(p,path[start],path[next]))>.006))break;
          end=next;
        }simplified.push(path[end]);start=end;
      }
      if(simplified.length>1)result.push({id:'village-lane-'+result.length,kind:kinds.includes('collector')?'collector':'local',points:simplified,village:true});
    };
    for(const [a,neighbours] of graph)if(neighbours.size!==2)for(const b of neighbours)if(!visited.has(key(a,b)))chain(a,b);
    for(const [a,neighbours] of graph)for(const b of neighbours)if(!visited.has(key(a,b)))chain(a,b);
    return {streets:result,garrisonParcel};
  }

  function settlementFrontageBuildings(request,streets,districts,plazas,fortress,widths,metric) {
    const candidates=[],buildings=[],occupied=[],recipe=request.recipe,m=recipe.urban.gridCellKilometres,
      roadIndex=streetClearanceIndex(streets,widths,request.center,.04/metric),
      land=districts.map(points=>points.map(p=>({x:p.column,y:p.row}))),
      distance=(a,b)=>Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row);
    for(const [streetIndex,street] of streets.entries())if(street.village&&!street.access){
      const lengths=[0];for(let i=1;i<street.points.length;i++)lengths.push(lengths.at(-1)+distance(street.points[i-1],street.points[i]));
      const length=lengths.at(-1),pointAt=position=>{
        let i=1;while(i<lengths.length-1&&lengths[i]<position)i++;
        const a=street.points[i-1],b=street.points[i],t=Math.max(0,Math.min(1,(position-lengths[i-1])/(lengths[i]-lengths[i-1]||1)));
        return {column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t};
      };
      for(const side of [-1,1]){
        let position=.003;for(let lot=0;position<length-.008;lot++){
          const channel=62000+streetIndex*7919+lot*31+(side+1)*149,
            frontage=.0105+random(request.seed,channel)*.006,
            depth=.021+random(request.seed,channel+1)*.014,
            centerPosition=position+frontage/2;
          if(centerPosition+frontage/2>length-.002)break;position+=frontage*.55;
          const roadPoint=pointAt(centerPosition),a=pointAt(centerPosition-frontage*.4),b=pointAt(centerPosition+frontage*.4),
            span=distance(a,b);if(span<frontage*.45)continue;
          const u={x:(b.column-a.column)*m.column/span,y:(b.row-a.row)*m.row/span},v={x:-u.y*side,y:u.x*side},
            roadWidth=(widths[street.kind]||widths.local)*metric,edge=roadWidth*.6+.001,
            at=(x,y)=>({column:roadPoint.column+(u.x*x+v.x*y)/m.column,row:roadPoint.row+(u.y*x+v.y*y)/m.row}),
            rectangle=(x,y,w,h)=>{
              const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>at(x+sx*w/2,y+sy*h/2));
              // Mirroring to the opposite lane side reverses winding. Every
              // private plot must retain the convex clipper's counterclockwise
              // orientation before it participates in global occupancy checks.
              return side<0?points.reverse():points;
            },
            plot=rectangle(0,edge+depth/2,frontage-.0007,depth),
            front=Math.min(frontage-.003,.0065+random(request.seed,channel+2)*.0045),
            houseDepth=.008+random(request.seed,channel+3)*.0065,
            setback=.0015+random(request.seed,channel+4)*.003,
            houseY=edge+setback+houseDepth/2,points=rectangle(0,houseY,front,houseDepth);
          if(!plot.every(p=>land.some(d=>containsPoint(d,{x:p.column,y:p.row})))||roadIndex.intersects(plot)
            ||plazas.some(plaza=>polygonsOverlap(plot,plaza.points))
            ||fortress&&polygonsOverlap(plot,fortress.clearancePoints)
            ||recipe.harbor?.reservedLand&&polygonsOverlap(plot,recipe.harbor.reservedLand)
            ||!completeBuildingGround(plot,recipe)||!completeBuildingGround(points,recipe))continue;
          const foundation=foundationAt(points,recipe);if(foundation.reliefMetres>3.5)continue;
          const entrance=at(0,edge+setback);if(!segmentOnLand(entrance,roadPoint,recipe))continue;
          const gardenStart=edge+setback+houseDepth+.0015,gardenDepth=edge+depth-gardenStart,
            gardenPoints=gardenDepth>.004?rectangle(0,gardenStart+gardenDepth/2,frontage-.002,gardenDepth):[],
            center=at(0,houseY),rank=distance(center,request.center),roof=request.character.dwellingRoof||
              (request.character.court?'hip':['arcaded','terraced'].includes(request.character.style)?'flat':'gable'),
            courtyard=request.character.court?rectangle(0,houseY,front*.40,houseDepth*.42):null;
          candidates.push({points,plotPoints:plot,gardenPoints,entrance,access:[entrance,roadPoint],foundation,channel,rank,roof,courtyard,
            frontage:{streetId:street.id,groupId:street.id+':'+side,position:centerPosition,roadPoint,widthMetres:front*1000,depthMetres:houseDepth*1000}});
        }
      }
    }
    candidates.sort((a,b)=>a.rank-b.rank||a.channel-b.channel);
    for(const home of candidates){
      if(buildings.length>=request.character.buildingCount)break;
      if(occupied.some(plot=>polygonsOverlap(home.plotPoints,plot)))continue;
      occupied.push(home.plotPoints);
      buildings.push({...home,kind:'residential',material:request.character.material.name,wallMaterial:request.character.material.wallName,
        roofLines:roofLines(home.points,home.courtyard,home.roof),
        fill:request.character.roof[Math.floor(random(request.seed,home.channel+9200)*request.character.roof.length)]});
    }
    return buildings;
  }

  // A works is a mill, production shed, store and boiler house around a
  // shared yard. It has one entrance on a real street, rather than four
  // unrelated rows of identical factory symbols on the block perimeter.
  function industrialCompound(polygon,streets,recipe,channel,roadIndex,masonryIndex) {
    const main=frontageBuilding(polygon,streets,recipe,channel,{courtyard:false,rowHouse:false,industrial:true,
      modern:true,roadIndex,masonryIndex,capacity:1})[0];
    if(!main)return [];
    const m=recipe.urban.gridCellKilometres,[a,b,,d]=main.points,
      width=Math.hypot((b.column-a.column)*m.column,(b.row-a.row)*m.row)*1000,
      depth=Math.hypot((d.column-a.column)*m.column,(d.row-a.row)*m.row)*1000,
      u={x:(b.column-a.column)*m.column*1000/width,y:(b.row-a.row)*m.row*1000/width},
      center={column:(b.column+d.column)/2,row:(b.row+d.row)/2},
      away={x:(center.column-main.frontage.roadPoint.column)*m.column,y:(center.row-main.frontage.roadPoint.row)*m.row},
      awayLength=Math.hypot(away.x,away.y),v={x:away.x/awayLength,y:away.y/awayLength},
      at=(x,y)=>({column:center.column+(u.x*x+v.x*y)/m.column/1000,row:center.row+(u.y*x+v.y*y)/m.row/1000}),
      rectangleAt=(x,y,w,h)=>[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>at(x+sx*w/2,y+sy*h/2)),
      lot=polygon.map(p=>({x:p.column,y:p.row})),yardX=width/2+7,
      local=p=>({x:(p.column-center.column)*m.column*1000*u.x+(p.row-center.row)*m.row*1000*u.y,
        y:(p.column-center.column)*m.column*1000*v.x+(p.row-center.row)*m.row*1000*v.y}),
      roadY=local(main.frontage.roadPoint).y,frontageY=Math.min(...polygon.map(p=>local(p).y)),
      // The short public setback is the only place a private path may leave
      // its plot. Exact clipping catches a yard entrance that cuts across a
      // neighboring works where a narrow frontage widens toward the rear.
      accessInProperty=access=>streetOutsidePolygon({points:access},polygon)
        .every(part=>part.points.every(p=>local(p).y<=frontageY+1e-5));
    const buildings=[{...main,compoundRole:'mill',chimney:false}];
    for(const [index,part] of [
      {role:'shed',x:0,y:depth/2+20,w:Math.max(20,width),h:18},
      {role:'warehouse',x:yardX+15,y:0,w:16,h:Math.max(18,depth*.75)},
      {role:'boiler-house',x:yardX+15,y:depth/2+18,w:12,h:12},
    ].entries()){
      const points=rectangleAt(part.x,part.y,part.w,part.h),entrance=at(part.x<yardX?part.x+part.w/2:part.x-part.w/2,part.y),
        access=[entrance,at(yardX,part.y),at(yardX,roadY),main.frontage.roadPoint];
      if(!points.every(p=>containsPoint(lot,{x:p.column,y:p.row}))||!completeBuildingGround(points,recipe)
        ||roadIndex.intersects(points)||buildings.some(other=>polygonsOverlap(points,other.points))
        ||!accessInProperty(access)||!access.every((p,i)=>!i||segmentOnLand(access[i-1],p,recipe)))continue;
      if(buildings.some(other=>polygonNearRoute(other.points,access,.001/gridCellKilometres(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns))))continue;
      buildings.push({points,entrance,access,compoundRole:part.role,chimney:part.role==='boiler-house',
        index:main.index+(index+1)*100000,rank:main.rank,
        frontage:{...main.frontage,widthMetres:part.w,depthMetres:part.h,position:index+1},placementRank:main.placementRank});
    }
    const yard=rectangleAt(yardX,depth*.15,10,depth+14);
    if(yard.every(p=>containsPoint(lot,{x:p.column,y:p.row}))&&completeBuildingGround(yard,recipe)
      &&accessInProperty([at(yardX,depth*.15),at(yardX,roadY),main.frontage.roadPoint]))buildings[0].yardPoints=yard;
    return buildings;
  }

  function frontageBuilding(polygon,streets,recipe,channel,{courtyard,rowHouse,industrial,modern,roadIndex,masonryIndex,capacity,land=null}) {
    const form=global.WorldAtlasCityCharacter.profile(recipe).morphology;
    const metric=recipe.urban.gridCellKilometres,origin=polygon[0],
      allowedLand=land&&land.map(piece=>piece.map(p=>({x:p.column,y:p.row}))),
      toMetres=p=>({x:(p.column-origin.column)*metric.column*1000,y:(p.row-origin.row)*metric.row*1000}),
      local=polygon.map(toMetres),bounds=polygonBounds(polygon),homes=[],candidates=[],
      widths=streetWidthsInGrid(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns),gridMetric=gridCellKilometres(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns),
      houseWidth=industrial?[18,34]:modern?rowHouse?[6,10]:[9,18]:form.frontageMetres,
      houseDepth=industrial?[24,46]:modern?rowHouse?[10,18]:[12,24]:form.depthMetres;
    for(const [streetIndex,street] of streets.entries())if(street.kind!=='rail'&&!street.plaza&&!street.palacePerimeter)for(let segment=1;segment<street.points.length;segment++){
      const start=street.points[segment-1],end=street.points[segment],margin=.035,
        expanded={west:bounds.west-margin/metric.column,east:bounds.east+margin/metric.column,north:bounds.north-margin/metric.row,south:bounds.south+margin/metric.row};
      if(Math.max(start.column,end.column)<expanded.west||Math.min(start.column,end.column)>expanded.east
        ||Math.max(start.row,end.row)<expanded.north||Math.min(start.row,end.row)>expanded.south)continue;
      const a=toMetres(start),b=toMetres(end),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);if(length<houseWidth[0])continue;
      const u={x:dx/length,y:dy/length},baseNormal={x:-u.y,y:u.x},roadWidth=(widths[street.kind]||widths.local)*gridMetric*1000;
      for(const side of [-1,1]){
        const salt=channel+streetIndex*7919+segment*131+(side+1)*191,normal={x:baseNormal.x*side,y:baseNormal.y*side},
          at=(x,y)=>({column:origin.column+(a.x+u.x*x+normal.x*y)/metric.column/1000,
            row:origin.row+(a.y+u.y*x+normal.y*y)/metric.row/1000}),
          projected=local.map(p=>({x:(p.x-a.x)*u.x+(p.y-a.y)*u.y,y:(p.x-a.x)*normal.x+(p.y-a.y)*normal.y}));
        if(side<0)projected.reverse();
        // Erode the convex plot by the actual house rectangle. Its remaining
        // polygon contains all legal centres, so narrow tips cannot turn into
        // tiny buildings and no building needs iterative shrink or clipping.
        let width=houseWidth[0]+random(recipe.seed,salt+12100)*(houseWidth[1]-houseWidth[0]),
          depth=houseDepth[0]+random(recipe.seed,salt+12101)*(houseDepth[1]-houseDepth[0]);
        if(!modern&&!industrial&&recipe.localSite?.surface){
          const surface=recipe.localSite.surface,x=Math.max(0,Math.min(length,projected.reduce((sum,p)=>sum+p.x,0)/projected.length)),
            y=roadWidth*.65+1.4+depth/2,height=(dx,dy)=>global.WorldAtlasCitySite.elevationAt(surface,at(x+dx,y+dy)),
            alongGrade=Math.abs(height(5,0)-height(-5,0))/10,crossGrade=Math.abs(height(0,5)-height(0,-5))/10,
            minimumRelief=alongGrade*houseWidth[0]+crossGrade*houseDepth[0],
            extraRelief=alongGrade*(width-houseWidth[0])+crossGrade*(depth-houseDepth[0]),
            scale=extraRelief>0?Math.max(0,Math.min(1,(3.5-minimumRelief)/extraRelief)):1;
          // Choose a house within this culture's dimensions that suits the
          // actual slope. The complete terrain foundation still has to pass;
          // this does not level the ground or permit a taller retaining pad.
          width=houseWidth[0]+(width-houseWidth[0])*scale;
          depth=houseDepth[0]+(depth-houseDepth[0])*scale;
        }
        const halfW=width/2,halfD=depth/2;
        let centres=projected;
        for(let edge=0;edge<projected.length&&centres.length>=3;edge++){
          const p=projected[edge],q=projected[(edge+1)%projected.length],nx=q.y-p.y,ny=p.x-q.x;
          centres=clipHalfPlane(centres,nx,ny,p.x*nx+p.y*ny-Math.abs(nx)*halfW-Math.abs(ny)*halfD);
        }
        centres=clipHalfPlane(centres,-1,0,0);centres=clipHalfPlane(centres,1,0,length);
        centres=clipHalfPlane(centres,0,-1,-(roadWidth*.65+1.4+halfD));
        centres=clipHalfPlane(centres,0,1,35+halfD);
        if(centres.length<3)continue;
        const minimumY=Math.min(...centres.map(p=>p.y)),maximumY=Math.max(...centres.map(p=>p.y)),
          y=minimumY+Math.min(.5,(maximumY-minimumY)*.20),intercepts=[];
        for(let edge=0;edge<centres.length;edge++){
          const p=centres[edge],q=centres[(edge+1)%centres.length];
          if((p.y<=y&&q.y>=y)||(q.y<=y&&p.y>=y)){
            if(Math.abs(q.y-p.y)<1e-8)intercepts.push(p.x,q.x);else intercepts.push(p.x+(q.x-p.x)*(y-p.y)/(q.y-p.y));
          }
        }
        if(!intercepts.length)continue;
        // Medieval and early-modern burgher towns build continuous street
        // frontages of narrow gabled houses; courtyard cultures keep gaps.
        const burgage=!courtyard&&!industrial&&!modern&&['medieval','early-modern','preindustrial'].includes(recipe.era)
          &&['timber-frame','stone-masonry','terraced','canal-side','vernacular-mixed'].includes(recipe.culture?.cityLayout?.architecture);
        const west=Math.min(...intercepts),east=Math.max(...intercepts),terrace=rowHouse&&recipe.era==='industrial',
          gap=terrace?.15:burgage?.2+random(recipe.seed,salt+12102)*.4:form.gapMetres[0]+random(recipe.seed,salt+12102)*(form.gapMetres[1]-form.gapMetres[0]),
          count=Math.max(1,Math.min(capacity,1+Math.floor((east-west)/(width+gap)))),pitch=width+gap,
          first=(west+east-(count-1)*pitch)*.5;
        for(let index=0;index<count;index++){
          const front=width*(terrace||burgage?.99:.84+random(recipe.seed,salt+index*29+12201)*.16),deep=depth*(terrace?.99:burgage?.82+random(recipe.seed,salt+index*29+12202)*.18:.88+random(recipe.seed,salt+index*29+12202)*.12),
            x=first+index*pitch,points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([sx,sy])=>at(x+sx*front/2,y+sy*deep/2));
          if(side<0)points.reverse();
          const entrance=at(x,y-deep/2),roadPoint=at(x,0);
          candidates.push({points,entrance,access:[entrance,roadPoint],index:salt+index,
            frontage:{streetId:street.id||null,roadPoint,widthMetres:front,depthMetres:deep,groupId:`frontage-${channel}-${streetIndex}-${segment}-${side}`,position:index},
            placementRank:random(recipe.seed,salt+12300)+Math.abs(index-(count-1)*.5)/(count*1000),rank:random(recipe.seed,salt+index*29+12300)});
        }
      }
    }
    candidates.sort((a,b)=>a.placementRank-b.placementRank);
    for(const home of candidates){
      if(homes.length===capacity)break;
      // An inaccessible orientation cannot consume a plot's dwelling quota
      // before another complete house facing its real ward service is tried.
      if(masonryIndex.intersects(home.points)||!masonryIndex.clearAccess(home.access))continue;
      if(allowedLand&&!home.points.every(point=>allowedLand.some(piece=>containsPoint(piece,{x:point.column,y:point.row})))
        ||!completeBuildingGround(home.points,recipe)||!segmentOnLand(home.entrance,home.access.at(-1),recipe)||roadIndex.intersects(home.points))continue;
      if(foundationAt(home.points,recipe).reliefMetres>3.5)continue;
      if(homes.some(other=>polygonsOverlap(home.points,other.points)
        ||polygonNearRoute(home.points,other.access,.0008/gridMetric)||polygonNearRoute(other.points,home.access,.0008/gridMetric)))continue;
      homes.push(home);
    }return homes;
  }

  function completeBuildingGround(points,recipe){
    const surface=recipe.localSite?.surface;
    if(surface){
      const b=surface.bounds,box=polygonBounds(points);
      if(box.west<b.west||box.east>b.east||box.north<b.north||box.south>b.south)return false;
      const firstX=Math.floor((box.west-b.west)/(b.east-b.west)*(surface.columns-1)),
        lastX=Math.min(surface.columns-1,Math.ceil((box.east-b.west)/(b.east-b.west)*(surface.columns-1))),
        firstY=Math.floor((box.north-b.north)/(b.south-b.north)*(surface.rows-1)),
        lastY=Math.min(surface.rows-1,Math.ceil((box.south-b.north)/(b.south-b.north)*(surface.rows-1)));
      let entirelyAllowed=!(surface.lakeTerrain||[]).some(field=>box.east>=field.bounds.west&&box.west<=field.bounds.east
        &&box.south>=field.bounds.north&&box.north<=field.bounds.south);
      for(let y=firstY;y<=lastY&&entirelyAllowed;y++)for(let x=firstX;x<=lastX;x++){
        const i=y*surface.columns+x;
        if(surface.elevationMetres[i]<=0||surface.slopes[i]>=.20||(surface.lakeDepths&&surface.lakeDepths[i]>=0)){entirelyAllowed=false;break;}
      }
      // Triangle heights and bilinear slopes are weighted node values. When
      // every covered node is legal the entire roof is legal, without repeated
      // route sampling. At a terrain boundary require the exact original area.
      if(!entirelyAllowed){
        const area=polygonArea(points.map(p=>({x:p.column,y:p.row}))),
          available=clipToLand(points,recipe).reduce((sum,part)=>sum+polygonArea(part.map(p=>({x:p.column,y:p.row}))),0);
        if(Math.abs(available-area)>Math.max(1e-14,area*1e-7))return false;
      }
    }else if(!points.every((p,i)=>segmentOnLand(p,points[(i+1)%points.length],recipe)))return false;
    return !polygonNearWater(points,recipe);
  }

  function completeBuildingFoundation(points,recipe){
    return foundationAt(points,recipe);
  }

  function attachBuildingFrontages(buildings,streets,recipe){
    const m=recipe.urban.gridCellKilometres,byId=new Map();
    for(const street of streets){const id=street.id||null;if(!byId.has(id))byId.set(id,[]);byId.get(id).push(street);}
    return buildings.flatMap(building=>{
      if(!building.frontage)return [building];
      const p=building.frontage.roadPoint;let target=null,minimum=Infinity;
      for(const street of byId.get(building.frontage.streetId)||[])for(let i=1;i<street.points.length;i++){
        const a=street.points[i-1],b=street.points[i],x=(b.column-a.column)*m.column,y=(b.row-a.row)*m.row,
          t=Math.max(0,Math.min(1,((p.column-a.column)*m.column*x+(p.row-a.row)*m.row*y)/(x*x+y*y||1))),
          q={column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t},distance=Math.hypot((q.column-p.column)*m.column,(q.row-p.row)*m.row);
        if(distance<minimum){minimum=distance;target=q;}
      }
      // Lane-end joins can move the segment by a few millimetres. Follow that
      // actual segment, and discard a lot whose only frontage was removed.
      if(!target||minimum>.002)return [];
      const access=building.estateId?building.access.slice(0,-1).concat(target):[building.entrance,target];
      if(!access.every((p,i)=>!i||segmentOnLand(access[i-1],p,recipe)))return [];
      return [{...building,access,frontage:{...building.frontage,roadPoint:target}}];
    });
  }

  function joinStreetLanes(streets,request,widths,plazas,fortress,buildings,walls,connectionReach=0){
    if(!streets.length)return;
    const grounds=plazas.map(plaza=>plaza.points).concat(fortress?[fortress.clearancePoints]:[],buildings.map(building=>building.points)),
      boundedGrounds=grounds.map(points=>({points,bounds:polygonBounds(points)})),clearance=widths.local*.5,
      metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      candidates=boundsIndex(boundedGrounds,request.center,.075/metric),
      wallIndex=wallClearanceIndex(walls,request,widths);
    // A narrow village lane can be cut across the same frontage span as an
    // urban street. Keep that short physical reach independent of lane width.
    const reach=Math.max(.025,widths.arterial*metric*2.5,connectionReach),m=request.recipe.urban.gridCellKilometres,
      edge=polygonBounds(streets.flatMap(street=>street.points)),apron=[
        {column:edge.west-reach/m.column,row:edge.north-reach/m.row},{column:edge.east+reach/m.column,row:edge.north-reach/m.row},
        {column:edge.east+reach/m.column,row:edge.south+reach/m.row},{column:edge.west-reach/m.column,row:edge.south+reach/m.row}],
      receivers=(request.recipe.transport?.corridors||[]).filter(route=>route.kind==='road').flatMap(route=>
        clipToDistricts({...route,kind:route.local?'collector':'arterial',joinTarget:true},[apron]));
    // District clipping only trims the urban rendering of an approach. Its
    // retained countryside continuation is still a real receiving road.
    joinLaneEnds(streets.concat(receivers),reach,request.recipe,connection=>{
      const bounds=polygonBounds(connection.points);
      const nearby=candidates({west:bounds.west-clearance,east:bounds.east+clearance,
        north:bounds.north-clearance,south:bounds.south+clearance});
      if(nearby.some(ground=>ground.bounds.east>=bounds.west-clearance&&ground.bounds.west<=bounds.east+clearance
        &&ground.bounds.south>=bounds.north-clearance&&ground.bounds.north<=bounds.south+clearance
        &&polygonNearRoute(ground.points,connection.points,clearance)))return false;
      const clear=wallIndex.clip(clipStreetToLand(connection,request.recipe));
      return clear.length===1&&clear[0].points.length===connection.points.length
        &&clear[0].points.every((p,i)=>Math.hypot(p.column-connection.points[i].column,p.row-connection.points[i].row)<1e-10);
    },connectionReach>0);
  }

  function streetSegmentGrade(a,b,recipe){
    const surface=recipe.localSite?.surface;if(!surface)return 0;
    const m=recipe.urban.gridCellKilometres,length=Math.hypot((b.column-a.column)*m.column,(b.row-a.row)*m.row)*1000;
    if(length<1e-8)return 0;
    const cuts=[0,1],at=t=>({column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t});
    // Height is planar inside each rendered terrain triangle. Test every grid
    // and diagonal crossing, so a short steep facet cannot hide in an average.
    for(const field of [surface,...surface.lakeTerrain||[]]){
      const bounds=field.bounds,scaleX=(field.columns-1)/(bounds.east-bounds.west),scaleY=(field.rows-1)/(bounds.south-bounds.north),
        x=(a.column-bounds.west)*scaleX,y=(a.row-bounds.north)*scaleY,
        dx=(b.column-a.column)*scaleX,dy=(b.row-a.row)*scaleY;
      for(const [start,delta] of [[x,dx],[y,dy],[x-y,dx-dy]])if(Math.abs(delta)>1e-12){
        const last=start+delta;
        for(let k=Math.ceil(Math.min(start,last));k<=Math.floor(Math.max(start,last));k++){
          const t=(k-start)/delta;if(t>1e-10&&t<1-1e-10)cuts.push(t);
        }
      }
    }
    cuts.sort((x,y)=>x-y);let grade=0,previous=0,height=global.WorldAtlasCitySite.elevationAt(surface,a);
    for(const t of cuts.slice(1)){
      if(t-previous<1e-10)continue;
      const next=global.WorldAtlasCitySite.elevationAt(surface,at(t));
      grade=Math.max(grade,Math.abs(next-height)/(length*(t-previous)));previous=t;height=next;
    }
    return grade;
  }

  function joinLaneEnds(streets,maximum,recipe,valid,aroundObstacles=false) {
    const origin=recipe.location,m=recipe.urban.gridCellKilometres,bins=new Map(),segments=new Map(),ends=new Map(),
      order=new Map(streets.map((s,i)=>[s,i])),distance=(a,b)=>Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row),
      cell=p=>[Math.floor((p.column-origin.column)*m.column/maximum),Math.floor((p.row-origin.row)*m.row/maximum)],key=p=>cell(p).join(','),
      parent=streets.map((s,i)=>i),root=street=>{let i=order.get(street);while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i];}return i;},
      connect=(a,b)=>{parent[root(a)]=root(b);},project=(p,a,b)=>{
        const dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,
          t=Math.max(0,Math.min(1,((p.column-a.column)*m.column*dx+(p.row-a.row)*m.row*dy)/(dx*dx+dy*dy||1)));
        return {t,q:{column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t}};
      },nearby=cells=>{const result=new Set();for(const [x,y] of cells)for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)
        for(const segment of bins.get(`${x+dx},${y+dy}`)||[])result.add(segment);return result;};
    for(const street of streets)if(street.kind!=='rail')for(let index=1;index<street.points.length;index++){
      const a=street.points[index-1],b=street.points[index],count=Math.max(1,Math.ceil(distance(a,b)/maximum));
      const segment={street,index,a,b,junctions:[],cells:[]},keys=new Set();
      if(!segments.has(street))segments.set(street,[]);segments.get(street).push(segment);
      for(let i=0;i<=count;i++)keys.add(key({column:a.column+(b.column-a.column)*i/count,row:a.row+(b.row-a.row)*i/count}));
      for(const k of keys){segment.cells.push(k.split(',').map(Number));if(!bins.has(k))bins.set(k,[]);bins.get(k).push(segment);}
    }
    for(const parts of segments.values())for(const first of parts)for(const second of nearby(first.cells)){
      if(root(first.street)===root(second.street))continue;
      const {a,b}=first,{a:c,b:d}=second,dx=b.column-a.column,dy=b.row-a.row,sx=d.column-c.column,sy=d.row-c.row,den=dx*sy-dy*sx;
      let crossed=false;if(Math.abs(den)>1e-18){const t=((c.column-a.column)*sy-(c.row-a.row)*sx)/den,u=((c.column-a.column)*dy-(c.row-a.row)*dx)/den;
        crossed=t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9;}
      if(crossed||Math.min(distance(a,project(a,c,d).q),distance(b,project(b,c,d).q),
        distance(c,project(c,a,b).q),distance(d,project(d,a,b).q))<1e-7)connect(first.street,second.street);
    }
    const clearExtension=(lane,p,q)=>{
      const dx=(q.column-p.column)*m.column,dy=(q.row-p.row)*m.row,length=Math.hypot(dx,dy),squared=length*length;
      for(const segment of segments.get(lane)||[]){
        const ax=(segment.a.column-p.column)*m.column,ay=(segment.a.row-p.row)*m.row,
          bx=(segment.b.column-p.column)*m.column,by=(segment.b.row-p.row)*m.row,sx=bx-ax,sy=by-ay,den=dx*sy-dy*sx;
        if(Math.abs(den)>1e-16){const t=(ax*sy-ay*sx)/den,u=(ax*dy-ay*dx)/den;
          if(t*length>1e-7&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)return false;
        }else if(Math.max(Math.abs(dx*ay-dy*ax),Math.abs(dx*by-dy*bx))/length<1e-7){
          const first=(ax*dx+ay*dy)/squared,last=(bx*dx+by*dy)/squared;
          if((Math.min(1,Math.max(first,last))-Math.max(0,Math.min(first,last)))*length>1e-7)return false;
        }
      }
      return true;
    };
    for(const lane of streets)if(lane.kind!=='rail'&&!lane.joinTarget&&distance(lane.points[0],lane.points.at(-1))>1e-7)for(const index of [0,lane.points.length-1]){
      const p=lane.points[index];let closest=null,outside=null,existing=null;
      const candidates=nearby([cell(p)]);
      for(const segment of Array.from(candidates).sort((a,b)=>order.get(a.street)-order.get(b.street)||a.index-b.index))if(segment.street!==lane){
        const projected=project(p,segment.a,segment.b),targets=[projected];
        if(aroundObstacles&&root(lane)!==root(segment.street)){
          const length=distance(segment.a,segment.b),step=Math.min(.5,maximum*.25/Math.max(length,1e-9));
          for(const sign of [-1,1]){const t=Math.max(0,Math.min(1,projected.t+step*sign));
            if(Math.abs(t-projected.t)>1e-8)targets.push({t,q:{column:segment.a.column+(segment.b.column-segment.a.column)*t,
              row:segment.a.row+(segment.b.row-segment.a.row)*t}});}
        }
        for(const {q,t}of targets){const gap=distance(p,q),different=root(lane)!==root(segment.street),
          best=different?outside:closest;
        if(gap<1e-7){existing={q,gap,t,segment,path:[p,q],length:gap};connect(lane,segment.street);continue;}
        if(aroundObstacles&&!different)continue;
        if(gap>maximum||best&&gap>=best.length-1e-9)continue;
        const allowed=(a,b)=>clearExtension(lane,a,b)&&segmentOnLand(a,b,recipe)
          &&valid({kind:lane.kind,points:[a,b]}),direct=allowed(p,q);
        if(!direct&&!aroundObstacles)continue;
        let path=null,length=gap;
        if(direct&&streetSegmentGrade(p,q,recipe)<=.12)path=[p,q];
        else if(different){
          // Terrain clipping can separate two street pieces whose chord is too
          // steep or cuts across a wall corner. Try short bends; every leg retains the same exact
          // land, building and masonry checks as a straight junction.
          const dx=(q.column-p.column)*m.column,dy=(q.row-p.row)*m.row;
          for(const fraction of [.5,.25,.75])for(let step=1;step<=6;step++)for(const sign of [-1,1]){
            const offset=gap*step/8*sign,bend={column:p.column+(dx*fraction-dy/gap*offset)/m.column,
              row:p.row+(dy*fraction+dx/gap*offset)/m.row},candidateLength=distance(p,bend)+distance(bend,q);
            if(candidateLength>gap*2||path&&candidateLength>=length-1e-9
              ||streetSegmentGrade(p,bend,recipe)>.12||streetSegmentGrade(bend,q,recipe)>.12
              ||!allowed(p,bend)||!allowed(bend,q))continue;
            path=[p,bend,q];length=candidateLength;
          }
        }
        if(path&&(!best||length<best.length-1e-9)){
          const candidate={q,gap,t,segment,path,length};if(different)outside=candidate;else closest=candidate;
        }
        }
      }
      // A closed occupied loop already has a junction at every end. That
      // zero-length junction must not hide a legal route to another component.
      closest=aroundObstacles?outside||existing||closest:existing||outside||closest;
      if(!closest)continue;
      connect(lane,closest.segment.street);
      closest.segment.junctions.push({point:closest.q,t:closest.t});
      if(closest.gap>1e-9){if(!ends.has(lane))ends.set(lane,new Map());ends.get(lane).set(index,closest.path);}
    }
    // Keep each original cut fixed. Moving a target lane after a projection
    // would detach roads that already joined it; extensions preserve that node.
    for(const [street,parts] of segments){
      const original=street.points,result=[original[0]];
      for(const segment of parts){
        for(const junction of segment.junctions.sort((a,b)=>a.t-b.t))if(junction.t>1e-9&&junction.t<1-1e-9
          &&distance(result.at(-1),junction.point)>1e-9)result.push(junction.point);
        result.push(segment.b);
      }
      const attached=ends.get(street);if(attached?.has(0))result.unshift(...attached.get(0).slice(1).reverse());
      if(attached?.has(original.length-1))result.push(...attached.get(original.length-1).slice(1));
      street.points=result;
    }
  }

  function pruneUnservedStreetStubs(streets,buildings,request,widths){
    const {m,distance,project}=defenceMetric(request),minimum=widths.arterial*gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      served=new Set(buildings.map(building=>building.frontage?.streetId).filter(Boolean)),
      touching=(a,b,c,d)=>{
        const dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,sx=(d.column-c.column)*m.column,sy=(d.row-c.row)*m.row,
          cx=(c.column-a.column)*m.column,cy=(c.row-a.row)*m.row,den=dx*sy-dy*sx;
        if(Math.abs(den)>1e-16){const t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;
          if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)return true;}
        return Math.min(distance(a,project(a,c,d)),distance(b,project(b,c,d)),distance(c,project(c,a,b)),distance(d,project(d,a,b)))<1e-7;
      };
    return streets.filter(street=>{
      if(!street.id?.startsWith('street-')||street.access||street.authoritative||served.has(street.id)
        ||street.points.slice(1).reduce((sum,p,i)=>sum+distance(street.points[i],p),0)>=minimum)return true;
      return streets.some(other=>other!==street&&street.points.slice(1).some((b,i)=>other.points.slice(1).some((d,j)=>
        touching(street.points[i],b,other.points[j],d))));
    });
  }

  function wallDomainContains(point,spans){
    let inside=false;
    for(const [a,b] of spans)if((a.row>point.row)!==(b.row>point.row)
      &&point.column<(b.column-a.column)*(point.row-a.row)/(b.row-a.row)+a.column)inside=!inside;
    return inside;
  }

  function streetInsideWallDomain(street,spans,request){
    const {m,distance,at}=defenceMetric(request),result=[];let run=[];
    const flush=()=>{if(run.length>1)result.push({...street,points:run});run=[];};
    for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,cuts=[0,1];
      for(const [c,d] of spans){
        const sx=(d.column-c.column)*m.column,sy=(d.row-c.row)*m.row,den=dx*sy-dy*sx;
        if(Math.abs(den)<1e-16)continue;
        const cx=(c.column-a.column)*m.column,cy=(c.row-a.row)*m.row,t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;
        if(t>1e-9&&t<1-1e-9&&u>=-1e-9&&u<=1+1e-9)cuts.push(t);
      }
      cuts.sort((a,b)=>a-b);
      for(let j=1;j<cuts.length;j++){
        const low=cuts[j-1],high=cuts[j];if(high-low<1e-9)continue;
        if(!wallDomainContains(at(a,b,(low+high)/2),spans)){flush();continue;}
        const first=at(a,b,low),last=at(a,b,high);
        if(run.length&&distance(run.at(-1),first)>1e-7)flush();
        if(!run.length)run.push(first);run.push(last);
      }
    }
    flush();return result;
  }

  const wallUnionCache=new Map();
  function insetWallBoundaries(spans,setback,request,interiorOnly,towers=[],towerClearance=0){
    const {m}=defenceMetric(request),result=[],precision=1e6,
      local=p=>[(p.column-request.center.column)*m.column*precision,(p.row-request.center.row)*m.row*precision],
      world=([x,y])=>({column:request.center.column+x/precision/m.column,row:request.center.row+y/precision/m.row}),
      radius=setback*precision,capRadius=radius/Math.cos(Math.PI/24);
    for(const [index,chain] of wallChains(spans,request).entries()){
      if(!chain.closed||chain.length<setback*8)continue;
      const ring=chain.points.slice(0,-1).map(local),ribbons=[];
      // Union round segment buffers before extracting the inset. A concave
      // neck that is narrower than the reserved width splits into real domains.
      for(let i=0;i<ring.length;i++){
        const a=ring[i],b=ring[(i+1)%ring.length],dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
        if(length<1e-6)continue;
        // A complete capsule avoids almost tangent rectangle/circle seams.
        // Such seams produced sub-nanometre slivers in the polygon sweep.
        // Keep the existing 24-sided round resolution and conservative radius.
        const angle=Math.atan2(dy,dx),capsule=[];
        for(const [center,start]of [[b,angle-Math.PI/2],[a,angle+Math.PI/2]])for(let j=0;j<=12;j++){
          const theta=start+j*Math.PI/12;
          capsule.push([center[0]+Math.cos(theta)*capRadius,center[1]+Math.sin(theta)*capRadius]);
        }
        ribbons.push(capsule);
      }
      for(const tower of towers)if(chain.points.some(p=>Math.hypot((p.column-tower.center.column)*m.column,
        (p.row-tower.center.row)*m.row)<2e-6)){
        const bounds=polygonBounds(tower.points),body=rectangle({column:(bounds.west+bounds.east)/2,row:(bounds.north+bounds.south)/2},
          (bounds.east-bounds.west)/2+towerClearance/m.column,(bounds.south-bounds.north)/2+towerClearance/m.row);
        ribbons.push(body.map(local));
      }
      // The exact union is expensive and the same wall is inset several times
      // (site planning, capacity passes, final plan); memoise on its exact input.
      const key=JSON.stringify(ribbons);let union=wallUnionCache.get(key);
      if(!union){union=global.WorldAtlasCitySite.unionWallBuffers(ribbons);wallUnionCache.set(key,union);
        if(wallUnionCache.size>64)wallUnionCache.delete(wallUnionCache.keys().next().value);}
      const boundaries=union.flatMap(polygon=>interiorOnly?polygon.slice(1):polygon);
      for(const [side,boundary] of boundaries.entries())result.push({index,side,points:boundary.map(world)});
    }
    return result;
  }

  function serviceableParcels(parcels,spans,request,widths,toWorld){
    const {m,distance,project}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      setback=(defenceWallWidth(widths)*.5+widths.local*.5)*metric+.001,
      local=p=>[(p.column-request.center.column)*m.column*1e6,(p.row-request.center.row)*m.row*1e6],
      rings=parcels.map(parcel=>parcel.polygon.map(toWorld).map(local)),
      overlaps=(ring,cores)=>global.WorldAtlasCitySite.intersectPolygons([ring],cores).some(polygon=>polygon.some(boundary=>
        Math.abs(boundary.reduce((sum,p,i)=>{const q=boundary[(i+1)%boundary.length];return sum+p[0]*q[1]-q[0]*p[1];},0))>200)),
      domains=insetWallBoundaries(spans,setback,request,true).map(boundary=>boundary.points)
        .filter(points=>wallDomainContains(points[0],spans)&&rings.some(ring=>overlaps(ring,[[points.map(local)]]))),
      inside=(p,ring)=>containsPoint(ring.map(q=>({x:q.column,y:q.row})),{x:p.column,y:p.row}),
      distanceTo=(p,ring)=>inside(p,ring)?0:Math.min(...ring.slice(1).map((b,i)=>distance(p,project(p,ring[i],b))));
    if(!domains.length)return [];
    const area=ring=>Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];
      return sum+(p.column-request.center.column)*m.column*(q.row-request.center.row)*m.row
        -(q.column-request.center.column)*m.column*(p.row-request.center.row)*m.row;},0));
    // Choose among domains that serve the already connected settlement. An
    // unbridged opposite riverbank may have larger walls but no selected lots.
    let core=0;for(let i=1;i<domains.length;i++)if(area(domains[i])>area(domains[core])+1e-10
      ||Math.abs(area(domains[i])-area(domains[core]))<=1e-10&&distanceTo(request.center,domains[i])<distanceTo(request.center,domains[core]))core=i;
    const kept=new Set([core]),connections=[];
    for(const bridge of request.recipe.localSite?.bridges||[]){
      if(bridge.kind==='rail')continue;
      const ends=bridge.points.map(point=>domains.map((ring,index)=>({index,distance:distanceTo(point,ring)}))
        .sort((a,b)=>a.distance-b.distance)[0]);
      if(ends.length===2&&ends.every(end=>end.distance<=setback*3+.01))connections.push(ends.map(end=>end.index));
    }
    for(let changed=true;changed;){
      changed=false;
      for(const [a,b] of connections)if(kept.has(a)!==kept.has(b)){kept.add(a);kept.add(b);changed=true;}
    }
    const cores=Array.from(kept,index=>[domains[index].map(local)]);
    return parcels.filter((parcel,index)=>overlaps(rings[index],cores));
  }

  function wallServiceStreets(outer,inner,request,districts,widths,plazas){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),result=[],
      towers=cornerTowerSites([...outer,...inner],request,metric),
      towerClearance=Math.max(.003,widths.collector*metric*.6)+.001;
    for(const [layer,spans] of [['outer',outer],['inner',inner]]){
      // Reserve masonry, the local carriageway and a one-metre verge.
      // A fixed twenty-metre inset needlessly erases habitable narrow necks.
      const setback=(defenceWallWidth(widths,layer)*.5+widths.local*.5)*metric+.001;
      for(const {index,side,points} of insetWallBoundaries(spans,setback,request,layer==='outer',towers,towerClearance)){
          let roads=clipToDistricts({id:`wall-lane-${layer}-${index}-${side}`,kind:'local',wallAccess:true,access:true,points},districts);
          roads=roads.flatMap(road=>clipStreetToLand(road,request.recipe));
          for(const plaza of plazas)roads=roads.flatMap(road=>streetOutsidePolygon(road,plaza.points));
          const clear=streetsClearOfWalls(roads,[...outer,...inner],request,widths),runs=[];
          for(const road of clear){
            const last=runs.at(-1),a=last?.points.at(-1),b=road.points[0];
            if(a&&Math.hypot((a.column-b.column)*m.column,(a.row-b.row)*m.row)<1e-7)last.points.push(...road.points.slice(1));
            else runs.push({...road,points:road.points.slice()});
          }
          result.push(...runs);
      }
    }
    return result;
  }

  function streetOutsidePolygon(street,polygon) {
    const result=[];let run=[];
    const flush=()=>{if(run.length>1)result.push({...street,points:run});run=[];};
    for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],dx=b.column-a.column,dy=b.row-a.row,squared=dx*dx+dy*dy;
      if(squared<1e-20)continue;
      const inside=clipToDistricts({...street,points:[a,b]},[polygon]);
      const t=p=>Math.max(0,Math.min(1,((p.column-a.column)*dx+(p.row-a.row)*dy)/squared));
      const intervals=inside.length?[[0,t(inside[0].points[0])],[t(inside.at(-1).points.at(-1)),1]]:[[0,1]];
      for(const [low,high] of intervals){
        if(high-low<=1e-8){if(high>=1-1e-8)flush();continue;}
        const at=v=>({column:a.column+dx*v,row:a.row+dy*v}),first=at(low),last=at(high);
        if(run.length&&Math.hypot(run.at(-1).column-first.column,run.at(-1).row-first.row)>1e-9)flush();
        if(!run.length)run.push(first);run.push(last);
        if(high<1-1e-8)flush();
      }
    }
    flush();return result;
  }

  function parcelAdjacency(parcels,bridges) {
    const boxes=parcels.map(({polygon})=>({west:Math.min(...polygon.map(p=>p.x)),east:Math.max(...polygon.map(p=>p.x)),
      north:Math.min(...polygon.map(p=>p.y)),south:Math.max(...polygon.map(p=>p.y))})),
      candidates=global.WorldAtlasCitySite.boundsCandidates(boxes),adjacent=parcels.map(()=>new Set()),
      connect=(a,b)=>{if(a!==b){adjacent[a].add(b);adjacent[b].add(a);}};
    for(let i=0;i<parcels.length;i++){
      const bounds=boxes[i],margin=2e-7;
      // The broad phase exceeds the unchanged 1e-7 edge tolerance. Only the
      // original exact adjacency predicate can accept a candidate.
      for(const j of candidates({west:bounds.west-margin,east:bounds.east+margin,north:bounds.north-margin,south:bounds.south+margin}))
        if(j>i&&parcelNeighbours(parcels[i].polygon,parcels[j].polygon))connect(i,j);
    }
    const near=(polygon,p)=>containsPoint(polygon,p)||polygon.some((a,i)=>{
      const b=polygon[(i+1)%polygon.length],q=nearestPoint({column:p.x,row:p.y},{column:a.x,row:a.y},{column:b.x,row:b.y});
      return Math.hypot(q.column-p.x,q.row-p.y)<.12;
    }),members=p=>candidates({west:p.x-.12,east:p.x+.12,north:p.y-.12,south:p.y+.12})
      .filter(index=>near(parcels[index].polygon,p));
    // A bridge endpoint's exact distance to a parcel is independent of the
    // other parcel. Measure it once, then join the same endpoint memberships.
    for(const [a,b] of bridges){const first=members(a),second=members(b);for(const i of first)for(const j of second)connect(i,j);}
    return adjacent.map(indices=>Array.from(indices).sort((a,b)=>a-b));
  }

  function parcelNeighbours(first,second) {
    return first.some((a,index)=>{
      const b=first[(index+1)%first.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      if(length<1e-9)return false;
      return second.some((c,edge)=>{
        const d=second[(edge+1)%second.length];
        if(Math.abs(dx*(c.y-a.y)-dy*(c.x-a.x))>length*1e-7||Math.abs(dx*(d.y-a.y)-dy*(d.x-a.x))>length*1e-7)return false;
        const t=p=>((p.x-a.x)*dx+(p.y-a.y)*dy)/(length*length);
        return Math.min(1,Math.max(t(c),t(d)))-Math.max(0,Math.min(t(c),t(d)))>1e-7;
      });
    });
  }

  function connectedParcels(parcels,bridges=[]) {
    if(!parcels.length)return [];
    const core=parcels.reduce((best,parcel)=>{
      const c=polygonCentre(parcel.polygon),b=polygonCentre(best.polygon);
      return Math.hypot(c.x,c.y)<Math.hypot(b.x,b.y)?parcel:best;
    },parcels[0]);
    const result=[core],remaining=new Set(parcels.filter(parcel=>parcel!==core)),adjacent=parcelAdjacency(parcels,bridges),
      indices=new Map(parcels.map((parcel,index)=>[parcel,index]));
    for(let index=0;index<result.length;index++)for(const next of adjacent[indices.get(result[index])]){
      const parcel=parcels[next];if(remaining.has(parcel)){result.push(parcel);remaining.delete(parcel);}
    }
    return result;
  }

  function clipToDistricts(street,polygons) {
    const result=[];
    for(let segment=1;segment<street.points.length;segment++){
      const a=street.points[segment-1],b=street.points[segment],intervals=[];
      for(const polygon of polygons){
        let low=0,high=1;
        for(let edge=0;edge<polygon.length&&low<=high;edge++){
          const c=polygon[edge],d=polygon[(edge+1)%polygon.length],dx=d.column-c.column,dy=d.row-c.row;
          const length=Math.hypot(dx,dy);if(length<1e-12)continue;
          const raw=(dx*(a.row-c.row)-dy*(a.column-c.column))/length,
            start=Math.abs(raw)<1e-10?0:raw,delta=(dx*(b.row-a.row)-dy*(b.column-a.column))/length;
          if(Math.abs(delta)<1e-10){if(start<0){low=1;high=0;}continue;}
          const t=-start/delta;if(delta>0)low=Math.max(low,t);else high=Math.min(high,t);
        }
        if(high-low>1e-8)intervals.push([low,high]);
      }
      intervals.sort((x,y)=>x[0]-y[0]);const joined=[];
      for(const interval of intervals){const last=joined.at(-1);if(last&&interval[0]<=last[1]+1e-7)last[1]=Math.max(last[1],interval[1]);else joined.push(interval.slice());}
      const point=t=>({row:a.row+(b.row-a.row)*t,column:a.column+(b.column-a.column)*t});
      for(const [low,high] of joined)result.push({...street,points:[point(low),point(high)]});
    }return result;
  }

  function createFortress(parcels, request, toWorld, radiusKm, streets, plazas,constraints) {
    const core = (request.recipe.urban.coreZones || []).find(zone => zone.role === "government-core") || request.center;
    const candidates = parcels.slice().sort((a, b) => {
      const first = toWorld(polygonCentre(a.polygon)), second = toWorld(polygonCentre(b.polygon));
      return Math.hypot(first.row - core.row, first.column - core.column) - Math.hypot(second.row - core.row, second.column - core.column);
    });
    let unmoatedFort=null;
    for (const parcel of candidates) {
      const center = polygonCentre(parcel.polygon);
      let radius = Math.min((request.character.small?.035+.02*Math.min(1,request.population/5000):.24) / radiusKm, Math.sqrt(polygonArea(parcel.polygon)) * 0.37);
      const square = (point, half) => [{x: point.x - half, y: point.y - half}, {x: point.x + half, y: point.y - half}, {x: point.x + half, y: point.y + half}, {x: point.x - half, y: point.y + half}];
      for (let attempt = 0; attempt < 5; attempt++, radius *= 0.78) {
        const local = square(center, radius);
        const clearancePoints = square(center, radius * 1.22);
        if (!clearancePoints.every(point => containsPoint(parcel.polygon, point))) continue;
        const points = local.map(toWorld);
        if(!constraints.fits(clearancePoints.map(toWorld)))continue;
        // The optional ditch is 24m outside the pad, with a 9m half stroke.
        // Decide whether its complete footprint fits while placing the fort.
        const moatFootprint=constraints.padding(clearancePoints.map(toWorld),34),
          moatEligible=constraints.fits(clearancePoints.map(toWorld),34)&&!plazas.some(plaza=>polygonsOverlap(moatFootprint,plaza.points));
        if(foundationAt(points,request.recipe).reliefMetres>4)continue;
        if (plazas.some(plaza => polygonsOverlap(clearancePoints.map(toWorld), plaza.points))) continue;
        if (!clearancePoints.map(toWorld).every(point => segmentOnLand(toWorld(center), point, request.recipe))) continue;
        if (streets.some(street => polygonNearRoute(clearancePoints.map(toWorld), street.points, request.radiusRows * 0.002))) continue;
        let gate = null;
        for (let edge = 0; edge < 4; edge++) {
          const a = points[edge], b = points[(edge + 1) % 4], midpoint = {row: (a.row + b.row) / 2, column: (a.column + b.column) / 2};
          for (const street of streets) if (street.kind !== "rail") for (let index = 1; index < street.points.length; index++) {
            const target = nearestPoint(midpoint, street.points[index - 1], street.points[index]);
            const distance = Math.hypot(midpoint.row - target.row, midpoint.column - target.column);
            if ((!gate || distance < gate.distance) && segmentOnLand(midpoint, target, request.recipe)&&constraints.access([midpoint,target])) gate = {edge, midpoint, target, distance};
          }
        }
        if (!gate) continue;
        const walls = [];
        for (let edge = 0; edge < 4; edge++) {
          const a = points[edge], b = points[(edge + 1) % 4];
          for (const [start, end] of edge === gate.edge ? [[0, 0.42], [0.58, 1]] : [[0, 1]]) walls.push([start, end].map(t => ({row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t})));
        }
        const ancient=request.era==='ancient',kind=ancient?(request.character.court?'palace-citadel':'garrison'):'castle';
        const interiors=[];
        if(ancient){
          const part=(x,y,w,h)=>rectangle({row:center.y+y*radius,column:center.x+x*radius},w*radius,h*radius).map(p=>toWorld({x:p.column,y:p.row}));
          interiors.push({points:part(0,-.48,.62,.18),kind:'command-hall'});
          for(const x of [-.55,.55])for(const y of [-.05,.43])interiors.push({points:part(x,y,.20,.15),kind:'barracks'});
          if(request.character.court)interiors.push({points:part(0,.42,.26,.12),kind:'sanctuary'});
        }
        const fortress = {
          era: request.era, points, clearancePoints: clearancePoints.map(toWorld), walls, access: [gate.midpoint, gate.target],
          kind,interiors,moatEligible,foundation:foundationAt(points,request.recipe),
          towers: local.map(point => square(point, radius * 0.14).map(toWorld)),
          ...(kind==='castle'?{keep:square({x: center.x - radius * 0.12, y: center.y - radius * 0.1}, radius * 0.33).map(toWorld)}:{}),
        };
        const widths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns);
        fortress.walls=fitWallOpenings(fortress.walls,[{points:fortress.access,halfWidthKm:widths.collector*metric*.5+.001}],widths.collector*2.3,request);
        if(masonryBlocksTransport(fortress.walls,widths.collector*2.3,request,widths,
          fortress.towers.map(points=>({points,border:widths.local*metric*.2}))))continue;
        if(moatEligible)return fortress;
        if(!unmoatedFort)unmoatedFort=fortress;
      }
    }
    return unmoatedFort;
  }

  function rectangle(center, halfColumn, halfRow) {
    return [{row:center.row-halfRow,column:center.column-halfColumn}, {row:center.row-halfRow,column:center.column+halfColumn},
      {row:center.row+halfRow,column:center.column+halfColumn}, {row:center.row+halfRow,column:center.column-halfColumn}];
  }

  function villagePublicPlots(request,streets,districts){
    const m=request.recipe.urban.gridCellKilometres,plots=[],land=districts.map(polygon=>polygon.map(p=>({x:p.column,y:p.row})));
    for(const street of streets)if(street.kind!=='rail')for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,length=Math.hypot(dx,dy);
      if(length<.025)continue;const u={x:dx/length,y:dy/length},v={x:-u.y,y:u.x};
      for(const fraction of [.4,.7])for(const side of [-1,1]){
        const center={column:a.column+(dx*fraction+v.x*.022*side)/m.column,row:a.row+(dy*fraction+v.y*.022*side)/m.row},
          plot=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>({column:center.column+(u.x*x*.016+v.x*y*.016)/m.column,
            row:center.row+(u.y*x*.016+v.y*y*.016)/m.row}));
        if(plot.every(p=>land.some(polygon=>containsPoint(polygon,{x:p.column,y:p.row}))))plots.push(plot);
      }
    }return plots;
  }

  function publicBuildingConstraints(request,districts,innerEnclosures,defence){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      widths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),
      physical=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),
      world=p=>({column:request.center.column+p.x/m.column,row:request.center.row+p.y/m.row}),
      route=p=>({column:p.x,row:p.y}),ground=districts.map(polygon=>polygon.map(physical)),
      innerGround=innerEnclosures.map(polygon=>polygon.map(physical)),
      walls=[...defence.wallSpans,...defence.innerWallSpans].map(span=>span.map(p=>route(physical(p)))),
      wallClearance=Math.max(.008,widths.collector*metric*1.55)+.004,
      roads=[...(request.recipe.transport?.corridors||[]).filter(road=>request.recipe.localSite?.gates||road.kind==='rail'),
        ...(request.recipe.localSite?.gates?request.recipe.localSite.ruralRoads||[]:[])].map(road=>({
        points:road.points.map(p=>route(physical(p))),width:widths[road.local?'collector':'arterial']*metric*.6}));
    const covers=(polygon,parcels)=>{
      const area=polygonArea(polygon),covered=parcels.reduce((sum,parcel)=>{
        let overlap=polygon;
        for(let i=0;i<parcel.length&&overlap.length>=3;i++){
          const a=parcel[i],b=parcel[(i+1)%parcel.length],nx=b.y-a.y,ny=a.x-b.x;
          overlap=clipHalfPlane(overlap,nx,ny,a.x*nx+a.y*ny);
        }return sum+polygonArea(overlap);
      },0);
      return area>1e-12&&covered>=area*(1-1e-8);
    };
    const buffered=(points,margin)=>{
      const polygon=points.map(physical),box={west:Math.min(...polygon.map(p=>p.x))-margin,east:Math.max(...polygon.map(p=>p.x))+margin,
        north:Math.min(...polygon.map(p=>p.y))-margin,south:Math.max(...polygon.map(p=>p.y))+margin};
      let result=[{x:box.west,y:box.north},{x:box.east,y:box.north},{x:box.east,y:box.south},{x:box.west,y:box.south}];
      for(let i=0;i<polygon.length;i++){
        const a=polygon[i],b=polygon[(i+1)%polygon.length],length=Math.hypot(b.x-a.x,b.y-a.y);
        if(length<1e-12)continue;const nx=(b.y-a.y)/length,ny=(a.x-b.x)/length;
        result=clipHalfPlane(result,nx,ny,a.x*nx+a.y*ny+margin);
      }return result;
    };
    return {
      padding:(points,marginMetres)=>buffered(points,marginMetres/1000).map(world),
      insideInner:p=>innerGround.some(polygon=>containsPoint(polygon,physical(p))),
      fits(points,marginMetres=5,requireInner=false){
        const polygon=buffered(points,marginMetres/1000),reservation=polygon.map(route),edge=polygon.map(world),
          roadReservation=buffered(points,.005).map(route);
        return covers(polygon,ground)&&(!requireInner||covers(polygon,innerGround))
          &&edge.every((p,i)=>segmentOnLand(p,edge[(i+1)%edge.length],request.recipe))
          &&!walls.some(wall=>polygonNearRoute(reservation,wall,wallClearance))
          &&!roads.some(road=>polygonNearRoute(roadReservation,road.points,road.width))
          &&!(request.recipe.localSite?.railwayStations||[]).some(station=>polygonsOverlap(edge,station.points));
      },
      access(points){
        const half=widths.collector*metric*.6;
        for(let i=1;i<points.length;i++){
          const a=physical(points[i-1]),b=physical(points[i]),dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
          if(length<1e-9)continue;const nx=-dy/length*half,ny=dx/length*half,
            strip=[{x:a.x+nx,y:a.y+ny},{x:b.x+nx,y:b.y+ny},{x:b.x-nx,y:b.y-ny},{x:a.x-nx,y:a.y-ny}].map(route);
          if(walls.some(wall=>polygonNearRoute(strip,wall,wallClearance)))return false;
        }return true;
      }
    };
  }

  // The surveyed administrative district contains several working compounds,
  // not just the principal palace. Its service blocks share the city's frame,
  // while each hall retains the existing physical architectural proportions.
  function developCivicPrecinct(parcels,request,toWorld,toLocal,streets,plazas,landmarks,constraints,walls,widths){
    if(!parcels.length)return;
    const recipe=request.recipe,character=request.character,{m,distance,project}=defenceMetric(request),
      radius=recipe.urban.radiusKm,metric=gridCellKilometres(recipe,request.radiusRows,request.radiusColumns),
      angle=request.plannedCity.angle,plots=[],lanes=[],
      principal=plazas.slice(),setback=Math.max(.014,widths.collector*metric*2.2)/radius;
    const divide=(polygon,channel,depth)=>{
      if(depth>=7||polygonArea(polygon)*radius*radius<=.0064){plots.push({polygon,channel});return;}
      const cut=bisectParcel(polygon,request.seed,channel,0,1.35);
      if(!cut){plots.push({polygon,channel});return;}
      lanes.push({id:'civic-service-'+channel,kind:'local',service:true,access:true,points:cut.cut.map(toWorld)});
      divide(cut.first,channel*2+1,depth+1);divide(cut.second,channel*2+2,depth+1);
    };
    for(const [index,parcel] of parcels.entries()){
      const polygon=insetPolygon(parcel.polygon,setback);
      if(polygon.length>=3)divide(polygon,71000+index*1000,0);
    }
    let clear=lanes.flatMap(lane=>clipStreetToLand(lane,recipe));
    for(const plaza of principal)clear=clear.flatMap(lane=>streetOutsidePolygon(lane,constraints.padding(plaza.points,6)));
    clear=streetsClearOfWalls(clear,walls,request,widths);
    streets.push(...clear);
    joinStreetLanes(streets,request,widths,plazas,null,[],walls);
    // A court can cut a survey line into an isolated remnant. Only streets
    // reached from the existing town may establish new public compounds.
    const pending=new Set(clear),reached=streets.filter(street=>!pending.has(street)&&street.kind!=='rail'),
      touches=(first,second)=>first.points.slice(1).some((b,i)=>second.points.slice(1).some((d,j)=>{
        const a=first.points[i],c=second.points[j],dx=b.column-a.column,dy=b.row-a.row,
          sx=d.column-c.column,sy=d.row-c.row,den=dx*sy-dy*sx;
        if(Math.abs(den)>1e-18){const cx=c.column-a.column,cy=c.row-a.row,
          t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;
          if(t>=0&&t<=1&&u>=0&&u<=1)return true;}
        return Math.min(distance(a,project(a,c,d)),distance(b,project(b,c,d)),
          distance(c,project(c,a,b)),distance(d,project(d,a,b)))
          <=((widths[first.kind]||widths.local)+(widths[second.kind]||widths.local))*metric*.5+1e-7;
      }));
    for(let changed=true;changed;){
      changed=false;
      for(const lane of pending)if(reached.some(street=>touches(lane,street))){pending.delete(lane);reached.push(lane);changed=true;}
    }
    if(pending.size)streets.splice(0,streets.length,...streets.filter(street=>!pending.has(street)));
    const roadIndex=streetClearanceIndex(streets,widths,request.center,.075/metric),
      roles=[['administration','town-hall','官署'],['guard','barracks','卫戍营'],['storage','granary','公仓']];
    for(const [plotIndex,plot] of plots.entries()){
      const center=toWorld(polygonCentre(plot.polygon));
      let target=null,minimum=Infinity;
      for(const street of streets)if(street.kind!=='rail'&&!street.plaza&&!street.palaceAccess)
        for(let i=1;i<street.points.length;i++){
          const point=project(center,street.points[i-1],street.points[i]),d=distance(center,point);
          if(d<minimum-1e-9){minimum=d;target=point;}
        }
      if(!target||minimum>.09)continue;
      // Face a service lane, rotating whole compounds rather than stretching
      // their roofs when row and column grid cells have different lengths.
      const direction=Math.atan2((target.row-center.row)*m.row,(target.column-center.column)*m.column),
        facing=angle+Math.round((direction-angle-Math.PI/2)/(Math.PI/2))*Math.PI/2,
        at=(x,y)=>({column:center.column+(Math.cos(facing)*x-Math.sin(facing)*y)/m.column,
          row:center.row+(Math.sin(facing)*x+Math.cos(facing)*y)/m.row}),
        local=plot.polygon.map(toWorld).map(p=>({x:((p.column-center.column)*m.column*Math.cos(facing)+(p.row-center.row)*m.row*Math.sin(facing)),
          y:-(p.column-center.column)*m.column*Math.sin(facing)+(p.row-center.row)*m.row*Math.cos(facing)})),
        half=Math.min(.025,Math.min(...local.map(p=>Math.abs(p.x)))/1.35*.72,Math.min(...local.map(p=>Math.abs(p.y)))*.72);
      if(half<.012)continue;
      const square=[[-1.35,-1],[1.35,-1],[1.35,1],[-1.35,1]].map(([x,y])=>at(x*half,y*half)),
        gate=at(0,half),access=[gate,target],
        [civicRole,kind,suffix]=roles[plotIndex%roles.length],
        parts=global.WorldAtlasCityCharacter.template(kind,character.style,request.population,character.palace),
        roofs=parts.map(part=>part.points.map(([x,y])=>at(x*half,y*half)));
      if(!constraints.fits(square)||!completeBuildingGround(square,recipe)||roadIndex.intersects(square)
        ||!square.every(p=>containsPoint(plot.polygon,toLocal(p)))
        ||plazas.some(plaza=>polygonsOverlap(square,constraints.padding(plaza.points,5)))
        ||!constraints.access(access)||!segmentOnLand(gate,target,recipe)
        ||plazas.some(plaza=>polygonNearRoute(plaza.points,access,widths.local*.6))
        ||roofs.some(points=>!completeBuildingGround(points,recipe)||foundationAt(points,recipe).reliefMetres>3.5))continue;
      const compoundId='civic-compound-'+plot.channel;
      plazas.push({points:square,role:'administrative-support',civicRole,compoundId,gate,name:character.prefix+suffix,
        nameType:kind,nameSuffix:suffix,market:false});
      streets.push({id:'civic-service-access-'+plot.channel,kind:'local',service:true,access:true,points:access});
      for(const [index,part] of parts.entries())landmarks.push({points:roofs[index],kind:index?kind+'-wing':kind,civicRole,
        compoundId,compoundPoints:square,name:character.prefix+suffix,nameType:kind,nameSuffix:suffix,
        material:character.material.name,wallMaterial:character.material.wallName,
        roof:part.roof,roofLines:roofLines(roofs[index],null,part.roof),fill:character.roof[index%character.roof.length],
        foundation:foundationAt(roofs[index],recipe)});
    }
  }

  function createPublicSpaces(request, metric, streets,districts,constraints) {
    const plazas = [], landmarks = [];
    const used=new Set(),placedKinds=new Set(),character=request.character;
    const m=request.recipe.urban.gridCellKilometres;
    const civicPlots=character.small&&!character.mobile?villagePublicPlots(request,streets,districts):districts;
    let cores = request.recipe.urban.coreZones?.length ? request.recipe.urban.coreZones.map(core=>({...core}))
      : [{...request.center, role:"central-core", radiusKm:request.recipe.urban.radiusKm * 0.22}];
    // An untyped world-scale centre is an anchor, not an extra market that
    // consumes the market slot before the cultural and water constraints run.
    cores=cores.filter(core=>core.role!=='central-core');
    const civicSite=(x,y,role)=>{
      const angle=request.plannedCity?.angle||0;
      // An industrial city keeps its palace, hall and temple in the old core.
      if(request.industrialCity&&role!=='military-core'){const k=request.industrialCity.coreScale;x*=k;y*=k;}
      return {row:request.center.row+request.radiusRows*(Math.sin(angle)*x+Math.cos(angle)*y),
        column:request.center.column+request.radiusColumns*(Math.cos(angle)*x-Math.sin(angle)*y),
        role,radiusKm:request.recipe.urban.radiusKm*.2};
    };
      const military=['fortress','border-pass'].includes(character.kind),maritime=['seaport','lake-port','river-port'].includes(character.kind);
    if(character.capital&&!cores.some(c=>c.role==='government-core'))cores.unshift(civicSite(0,-.36,'government-core'));
    if(!cores.some(c=>c.role==='government-core'))cores.unshift(civicSite(-.18,-.12,'local-government'));
    if(request.plannedCity?.governmentCenter)for(const core of cores)if(['government-core','local-government'].includes(core.role))
      Object.assign(core,request.plannedCity.governmentCenter);
    if(request.recipe.culture?.holyReligion&&!cores.some(c=>c.role==='sacred-core'))cores.unshift(civicSite(.2,-.25,'sacred-core'));
    const mechanisms=character.mechanisms;
    const waterMarket=()=>{
      let anchor=request.recipe.harbor?.shore;
      if(!anchor){
        let best=Infinity;
        for(const channel of request.recipe.localSite?.channels||[])for(let i=1;i<channel.points.length;i++){
          const p=nearestPoint(request.center,channel.points[i-1],channel.points[i]),
            distance=Math.hypot((p.column-request.center.column)*m.column,(p.row-request.center.row)*m.row);
          if(distance<best){best=distance;anchor=p;}
        }
      }
      return anchor?{column:request.center.column+(anchor.column-request.center.column)*.67,
        row:request.center.row+(anchor.row-request.center.row)*.67,role:'market-core',radiusKm:request.recipe.urban.radiusKm*.2}:civicSite(.34,.1,'market-core');
    };
    if(!character.small&&!military){
      if(mechanisms.wards)cores.push({...civicSite(-.43,.24,'market-core'),marketSide:'西'},
        {...civicSite(.43,.24,'market-core'),marketSide:'东'});
      else cores.push(mechanisms.waterfront?waterMarket():civicSite(mechanisms.multiPhase?.40:.34,mechanisms.multiPhase?.28:.1,'market-core'));
      if(mechanisms.waterfront){const market=waterMarket();cores.push({...market,role:'harbor-core',
        column:market.column+(request.center.column-market.column)*.16,row:market.row+(request.center.row-market.row)*.16});}
      if(mechanisms.multiPhase&&request.population>=15000)cores.push({...civicSite(-.22,-.05,'market-core'),marketSide:'旧城'});
    }
    if(!character.small&&request.population>7000&&!military)cores.push(civicSite(-.38,.24,'military-core'));
    if(!character.small&&request.population>3000&&!cores.some(c=>['sacred-core','pilgrimage-core'].includes(c.role)))
      cores.push(civicSite(mechanisms.ceremonial?0:mechanisms.sacredMarket?-.38:.28,
        mechanisms.ceremonial?.50:mechanisms.sacredMarket?-.31:-.3,'sacred-core'));
    if(character.small&&!character.mobile){
      const government=cores.find(core=>['government-core','local-government'].includes(core.role)),
        sacred=cores.find(core=>['sacred-core','pilgrimage-core'].includes(core.role)),
        landing=cores.find(core=>!['government-core','local-government','sacred-core','pilgrimage-core'].includes(core.role));
      cores=[government,sacred,maritime?landing:request.population>450?{...(landing||civicSite(.18,.12,'market-core')),role:'market-core'}:null].filter(Boolean);
    }
    for (const [coreIndex,core] of cores.entries()) {
      const sacred=['sacred-core','pilgrimage-core'].includes(core.role),government=['government-core','local-government'].includes(core.role);
      const regime=request.recipe.culture?.government,royal=['bureaucratic-monarchy','court-monarchy','estate-monarchy','hereditary-feudalism'].includes(regime),
        imperial=/帝国|王朝/.test(request.recipe.culture?.stateName||''),holy=request.recipe.culture?.holyReligion,
        holyKind={'ancestral-rite':'holy-tomb','river-mysteries':'water-sanctuary','sky-law':'observatory-sanctuary',
          'mountain-vow':'pilgrimage-monastery','tide-covenant':'harbor-shrine','pilgrim-way':'great-sanctuary'}[holy?.tradition];
      const kind=character.mobile?'assembly-tent':character.small?(government?'common-house':sacred?'village-shrine':maritime?'landing-store':'village-market'):sacred?(holyKind||'sanctuary'):government?(core.role==='government-core'?
        royal?imperial?'imperial-palace':'royal-palace':'council-house':regime==='hereditary-feudalism'?'lord-manor':'town-hall')
        :core.role==='military-core'?'barracks':core.role==='market-core'?'market-hall':character.kind==='oasis'?'caravanserai':maritime?'customs-house'
        :military?'barracks':coreIndex<2?'market-hall':'granary';
      if(placedKinds.has(kind)&&!(kind==='market-hall'&&(mechanisms.wards||mechanisms.multiPhase)))continue;
      const typeName={'common-house':'议事屋','village-shrine':'小祠','landing-store':'埠头仓','village-market':'集场','imperial-palace':'皇宫','royal-palace':'王宫','council-house':'议会宫', 'holy-tomb':'先圣陵寝',
        'water-sanctuary':'圣水神殿','observatory-sanctuary':'天律观星院','pilgrimage-monastery':'圣山修院','harbor-shrine':'潮汐圣祠','great-sanctuary':'巡礼大圣殿',
        'assembly-tent':'议事大帐',sanctuary:character.tradition.temple, 'lord-manor':'领主府','town-hall':character.tradition.hall,caravanserai:'商旅驿馆',
        'customs-house':'海关商馆',barracks:'卫戍营', 'market-hall':'市集大厅',granary:'公仓'}[kind];
      const marketName=kind==='market-hall'?(core.marketSide?core.marketSide+'市':'市集广场'):null;
      const civicName=character.small&&government&&!character.capital?'议事屋':marketName||typeName;
      const palace=['royal-palace','imperial-palace'].includes(kind),design=character.palace,
        templeGate=sacred&&!!design.templeFamily&&design.templeFamily!=='vernacular',
        axialGovernment=government&&!!request.plannedCity?.governmentCenter;
      const enclosedPalace=palace&&character.defence.layers>1;
      const candidates=civicPlots.map((points,index)=>({points,index,center:polygonCentre(points.map(p=>({x:p.column,y:p.row})))}))
        .filter(p=>!used.has(p.index)&&(!enclosedPalace||constraints.insideInner({column:p.center.x,row:p.center.y}))
          &&!(request.reservedWorld||[]).some(polygon=>containsPoint(polygon.map(q=>({x:q.column,y:q.row})),p.center)))
        .sort((a,b)=>Math.hypot(a.center.x-core.column,a.center.y-core.row)-Math.hypot(b.center.x-core.column,b.center.y-core.row));
      const parts=global.WorldAtlasCityCharacter.template(kind,character.style,request.population,design);
      const aspect=palace?design.aspect:kind==='market-hall'?[1.65,.80]:[1.35,1];
      const frame=(parcel,half)=>{
        const center={row:parcel.center.y,column:parcel.center.x};
        let angle=request.recipe.localSite?.form.axisRadians||0,nearest=Infinity,target=null;
        for(const street of streets)if(street.kind!=='rail'&&!street.alley&&!street.palacePerimeter)for(let i=1;i<street.points.length;i++){
          const a=street.points[i-1],b=street.points[i],q=nearestPoint(center,a,b),distance=Math.hypot((q.column-center.column)*m.column,(q.row-center.row)*m.row);
          // Opposite sides of a rectangular block can be equidistant. Keep
          // the first street for submillimetre ties so translating the city
          // across the longitude seam cannot reverse the compound frontage.
          if(distance<nearest-1e-9){nearest=distance;target=q;angle=Math.atan2((b.row-a.row)*m.row,(b.column-a.column)*m.column);}
        }
        if(target&&-(target.column-center.column)*m.column*Math.sin(angle)+(target.row-center.row)*m.row*Math.cos(angle)<0)angle+=Math.PI;
        if(templeGate&&target&&!mechanisms.ceremonial)angle=Math.atan2((target.row-center.row)*m.row,
          (target.column-center.column)*m.column)-Math.PI/2;
        // A north precinct faces the ceremonial approach. Its internal halls
        // follow that same axis; proximity to a side lane cannot turn it 90°.
        if(axialGovernment||sacred&&mechanisms.ceremonial)angle=request.plannedCity.angle;
        const at=(x,y)=>({column:center.column+(Math.cos(angle)*x-Math.sin(angle)*y)*metric/m.column,
          row:center.row+(Math.sin(angle)*x+Math.cos(angle)*y)*metric/m.row});
        let corners=[[-1,-1],[1,-1],[1,1],[-1,1]];
        if(palace&&design.fortified)corners=[[-.84,-1],[.81,-1],[1,-.68],[1,1],[-1,1],[-1,-.71]];
        const square=corners.map(([x,y])=>at(x*aspect[0]*half,y*aspect[1]*half));
        return {center,half,square,index:parcel.index,at,angle,gate:at(0,aspect[1]*half)};
      };
      const componentPoints=chosen=>{
        // Fit the canonical 2.7 by 2 compound frame with one physical scale.
        // A long or narrow precinct changes its open courts, never the aspect
        // ratio of a hall, wing, tower or dome.
        const scale=chosen.half*Math.min(aspect[0]/1.35,aspect[1]);
        return parts.map(part=>part.points.map(([x,y])=>chosen.at(x*scale,y*scale)));
      };
      const fitsInnerEnclosure=chosen=>{
        if(!enclosedPalace)return true;
        const reserved=chosen.square.map(p=>({column:chosen.center.column+(p.column-chosen.center.column)*1.04,
          row:chosen.center.row+(p.row-chosen.center.row)*1.04}));
        return constraints.fits(reserved,25,true);
      };
      const fitsGround=chosen=>(!request.recipe.harbor?.reservedLand||!polygonsOverlap(chosen.square,request.recipe.harbor.reservedLand))
        &&(!request.garrisonReservation||!polygonsOverlap(constraints.padding(chosen.square,5),request.garrisonReservation))
        &&fitsInnerEnclosure(chosen)
        &&constraints.fits(chosen.square)
        &&chosen.square.every((p,i)=>segmentOnLand(p,chosen.square[(i+1)%chosen.square.length],request.recipe))
        &&componentPoints(chosen).every(points=>points.every(p=>segmentOnLand(p,p,request.recipe))&&foundationAt(points,request.recipe).reliefMetres<=4);
      let chosen=null;
      if(palace&&character.capital&&request.population>=30000&&!axialGovernment){
        const groundsKm2=Math.min(2.4,.04+request.population*(imperial?3e-6:2e-6)),desired=Math.sqrt(groundsKm2/(4*aspect[0]*aspect[1]))/metric;
        for(const factor of [1,.85,.7,.55]){
          for(const parcel of candidates.slice(0,36)){
            const candidate=frame(parcel,desired*factor),{half,square,at}=candidate,
              interior=Array.from({length:49},(_,i)=>at(((i%7)/6*2-1)*half*aspect[0],(Math.floor(i/7)/6*2-1)*half*aspect[1]));
            if(!interior.every(p=>districts.some(d=>containsPoint(d.map(q=>({x:q.column,y:q.row})),{x:p.column,y:p.row})))
              ||!fitsGround(candidate)
              ||plazas.some(p=>polygonsOverlap(square,p.points))
              ||streets.some(s=>s.authoritative&&polygonNearRoute(square,s.points,streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns).arterial)))continue;
            chosen={...candidate,precinct:true};break;
          }if(chosen)break;
        }
      }
      for(const parcel of chosen?[]:axialGovernment?candidates.slice(0,1):candidates){
        const palaceHalf=Math.sqrt(Math.min(2.4,.04+request.population*(imperial?3e-6:2e-6))/(4*aspect[0]*aspect[1]));
        let half=(character.small?Math.min(sacred?.009:maritime&&!government?.010:.011+Math.min(.004,request.population/1000000),Math.max(.008,core.radiusKm*.28)):
          Math.min(government&&character.capital?palaceHalf:sacred&&holy?.18:.12,Math.max(.025,core.radiusKm*(government&&character.capital?.4:.28))))/metric;
        if(axialGovernment){
          const center={column:parcel.center.x,row:parcel.center.y},angle=request.plannedCity.angle,
            local=parcel.points.map(p=>({x:(p.column-center.column)*m.column*Math.cos(angle)+(p.row-center.row)*m.row*Math.sin(angle),
              y:-(p.column-center.column)*m.column*Math.sin(angle)+(p.row-center.row)*m.row*Math.cos(angle)})),
            available=Math.min((Math.max(...local.map(p=>p.x))-Math.min(...local.map(p=>p.x)))/(2*aspect[0]),
              (Math.max(...local.map(p=>p.y))-Math.min(...local.map(p=>p.y)))/(2*aspect[1]));
          half=Math.min(palace?palaceHalf/metric:available*.70/metric,available*.70/metric);
        }
        for(let i=0;i<8;i++,half*=.8){
          const candidate=frame(parcel,half),{square}=candidate;
          if(!square.every(p=>containsPoint(parcel.points.map(q=>({x:q.column,y:q.row})),{x:p.column,y:p.row}))
            ||!fitsGround(candidate)
            ||plazas.some(p=>polygonsOverlap(square,p.points))
            ||streets.some(street=>polygonNearRoute(square,street.points,streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns).collector)))continue;
          chosen={...candidate,precinct:palace};break;
        }
        if(chosen)break;
      }
      if(!chosen)continue;
      const {center,half,square,at}=chosen;used.add(chosen.index);placedKinds.add(kind);
      const name=character.prefix+civicName;
      const civicWidths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),gateHalf=civicWidths.arterial*metric*1.2,
        distance=(a,b)=>Math.hypot((b.column-a.column)*m.column,(b.row-a.row)*m.row);
      const wallPieces=square.flatMap((p,i)=>{
        const z=square[(i+1)%square.length],q=nearestPoint(chosen.gate,p,z);
        if(Math.hypot(q.row-chosen.gate.row,q.column-chosen.gate.column)>1e-8)return [[p,z]];
        const len=distance(p,z),delta=Math.min(.18,gateHalf/len),t=distance(p,q)/len;
        const at=v=>({column:p.column+(z.column-p.column)*v,row:p.row+(z.row-p.row)*v});
        return [[p,at(t-delta)],[at(t+delta),z]];
      });
      if(chosen.precinct&&masonryBlocksTransport(wallPieces,civicWidths.collector*1.9,request,civicWidths))continue;
      plazas.push({points:square,role:core.role,name,compoundId:'compound-'+coreIndex,nameType:kind,nameSuffix:civicName,market:kind==='market-hall'||kind==='village-market',precinct:chosen.precinct,
        phase:mechanisms.multiPhase&&core.marketSide==='旧城'?'historic-core':mechanisms.multiPhase?'preindustrial-extension':null,
        walls:wallPieces,gate:chosen.gate,design:palace?design.family:null});
      if(chosen.precinct){
        // Reserve the entire civic compound before walls, houses and lanes.
        const setback=civicWidths.collector*metric*(1.9*.5+.5)+.001,
          ring=expandConvexPolygon(square.map(p=>({x:(p.column-center.column)*m.column,y:(p.row-center.row)*m.row})),setback)
            .map(p=>({column:center.column+p.x/m.column,row:center.row+p.y/m.row}));
        const old=streets.splice(0);streets.push(...old.flatMap(street=>streetOutsidePolygon(street,ring)));
        for(let i=0;i<ring.length;i++)streets.push({id:'palace-perimeter-'+coreIndex+'-'+i,kind:'collector',points:[ring[i],ring[(i+1)%ring.length]],access:true,palacePerimeter:true});
      }
      let access = null;
      for (const street of streets) if (street.kind !== "rail") for (let index=1;index<street.points.length;index++) {
        const target=nearestPoint(chosen.precinct||templeGate?chosen.gate:center,street.points[index-1],street.points[index]);
        const entrance=chosen.precinct||templeGate?chosen.gate:square.map((p,i)=>nearestPoint(target,p,square[(i+1)%square.length])).sort((a,b)=>
          Math.hypot(a.row-target.row,a.column-target.column)-Math.hypot(b.row-target.row,b.column-target.column))[0];
        const distance=Math.hypot((target.column-entrance.column)*m.column,(target.row-entrance.row)*m.row)/metric;
        if(templeGate&&clipToDistricts({points:[entrance,target]},[square]).some(part=>
          Math.hypot(part.points.at(-1).column-part.points[0].column,part.points.at(-1).row-part.points[0].row)>1e-8))continue;
        if(plazas.some(plaza=>plaza.precinct&&clipToDistricts({points:[entrance,target]},[plaza.points]).some(part=>
          Math.hypot(part.points.at(-1).column-part.points[0].column,part.points.at(-1).row-part.points[0].row)>1e-8)))continue;
        if((!access || distance<access.distance-1e-10) && segmentOnLand(entrance,target,request.recipe)&&constraints.access([entrance,target]))access={points:[entrance,target],distance};
      }
      if(access && access.distance<Math.max(request.radiusRows,request.radiusColumns)*0.5){
        streets.push({id:'public-access-'+coreIndex,kind:character.small?"local":"collector",points:access.points,access:true,plaza:true,palaceAccess:!!chosen.precinct});
        if(chosen.precinct)plazas.at(-1).walls=fitWallOpenings(plazas.at(-1).walls,
          [{points:access.points,halfWidthKm:civicWidths[character.small?'local':'collector']*metric*.5+.001}],civicWidths.collector*1.9,request);
      }
      for(const [index,part] of parts.entries()){
        const points=componentPoints(chosen)[index];
        const roof=part.roof==='dome'?[points.map((p,i)=>i%4===0?[center,p]:null).filter(Boolean)].flat():roofLines(points,null,part.roof);
        const fill=part.roof==='terrace'?character.material.wall.base:part.feature==='processional-stair'?character.material.wall.highlight:
          part.roof==='awning'?['#b47c55','#bfaa70','#82988a'][index%3]:
          palace?character.material.palace[index%3]:character.roof[index%character.roof.length];
        landmarks.push({points,kind:index===0?kind:kind+'-wing',fill,roofLines:roof,roof:part.roof,feature:part.feature,
          material:part.roof==='awning'?'felt':character.material.name,wallMaterial:part.roof==='awning'?'felt':character.material.wallName,
          design:palace?design.family:sacred?design.templeFamily:null,foundation:foundationAt(points,request.recipe),
          compoundId:'compound-'+coreIndex,compoundPoints:square,name:character.prefix+civicName,nameType:kind,nameSuffix:civicName});
      }
    }
    return {plazas,landmarks};
  }


  function foundationAt(points,recipe){
    const f=recipe.localSite?.surface;if(!f)return {elevationMetres:0,reliefMetres:0};
    let minimum=Infinity,maximum=-Infinity;
    // Height is affine on each rendered terrain triangle. Its extrema over a
    // footprint occur at the vertices of the footprint/triangle intersection,
    // including mesh edges and interior terrain nodes missed by point samples.
    for(const triangle of global.WorldAtlasCitySite.surfaceTriangles(f,polygonBounds(points))){
      const a=triangle[0],dx=Math.max(...triangle.map(p=>p.column))-Math.min(...triangle.map(p=>p.column)),
        dy=Math.max(...triangle.map(p=>p.row))-Math.min(...triangle.map(p=>p.row)),
        local=triangle.map(p=>({x:(p.column-a.column)/dx,y:(p.row-a.row)/dy}));
      let clipped=points.map(p=>({x:(p.column-a.column)/dx,y:(p.row-a.row)/dy}));
      for(let edge=0;edge<3&&clipped.length;edge++){
        const p=local[edge],q=local[(edge+1)%3],nx=q.y-p.y,ny=p.x-q.x;
        clipped=clipHalfPlane(clipped,nx,ny,p.x*nx+p.y*ny);
      }
      const b=local[1],c=local[2],det=b.x*c.y-b.y*c.x;
      for(const p of clipped){
        const v=(p.x*c.y-p.y*c.x)/det,w=(b.x*p.y-b.y*p.x)/det,
          height=a.height+(triangle[1].height-a.height)*v+(triangle[2].height-a.height)*w;
        minimum=Math.min(minimum,height);maximum=Math.max(maximum,height);
      }
    }
    if(!Number.isFinite(minimum)||!Number.isFinite(maximum))throw new RangeError('Building footprint has no terrain triangle');
    return {elevationMetres:maximum,reliefMetres:maximum-minimum};
  }

  function chamferPolygon(points, fraction) {
    return points.flatMap((point,index)=>{
      const previous=points[(index+points.length-1)%points.length],next=points[(index+1)%points.length];
      return [{x:point.x+(previous.x-point.x)*fraction,y:point.y+(previous.y-point.y)*fraction},
        {x:point.x+(next.x-point.x)*fraction,y:point.y+(next.y-point.y)*fraction}];
    });
  }

  function roofLines(points, courtyard, roof='hip') {
    if(['flat','terrace'].includes(roof))return [];
    if(roof==='tiered'){
      const polygon=points.map(p=>({x:p.column,y:p.row})),depth=Math.sqrt(polygonArea(polygon));
      return [.10,.22,.34].map(factor=>insetPolygon(polygon,depth*factor)).filter(polygon=>polygon.length>=3)
        .map(polygon=>polygon.concat(polygon[0]).map(p=>({column:p.x,row:p.y})));
    }
    if(roof==='sawtooth'){
      const [a,b,c,d]=points,at=(p,q,t)=>({column:p.column+(q.column-p.column)*t,row:p.row+(q.row-p.row)*t});
      return [.25,.5,.75].map(t=>[at(a,b,t),at(d,c,t)]);
    }
    const polygon=points.map(point=>({x:point.column,y:point.row}));
    if(courtyard){
      const ring=insetPolygon(polygon,Math.sqrt(polygonArea(polygon))*0.10).map(point=>({column:point.x,row:point.y}));
      return ring.length>=3?[ring.concat(ring[0])]:[];
    }
    const center=polygonCentre(polygon);
    let direction=null,longest=0;
    for(let index=0;index<polygon.length;index++){
      const a=polygon[index],b=polygon[(index+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
      if(length>longest){longest=length;direction={x:dx/length,y:dy/length};}
    }
    if(!direction)return [];
    const intersections=[];
    for(let index=0;index<polygon.length;index++){
      const a=polygon[index],b=polygon[(index+1)%polygon.length],dx=b.x-a.x,dy=b.y-a.y;
      const denominator=direction.x*dy-direction.y*dx;
      if(Math.abs(denominator)<1e-12)continue;
      const t=((a.x-center.x)*dy-(a.y-center.y)*dx)/denominator;
      const u=((a.x-center.x)*direction.y-(a.y-center.y)*direction.x)/denominator;
      if(u>=-1e-9&&u<=1+1e-9)intersections.push(t);
    }
    if(intersections.length<2)return [];
    const minimum=Math.min(...intersections),maximum=Math.max(...intersections),inset=(maximum-minimum)*(roof==='gable'?0:.15);
    return [[minimum+inset,maximum-inset].map(t=>({column:center.x+direction.x*t,row:center.y+direction.y*t}))];
  }

  // Walk whole physical wall chains; input direction, ordering and collinear
  // subdivisions cannot restart the tower cadence. Junctions terminate runs.
  function wallChains(walls,request){
    const {m,distance}=defenceMetric(request),epsilon=1e-7,vertices=new Map(),edges=new Map(),
      compare=(a,b)=>a.x-b.x||a.y-b.y,
      vertex=p=>{const x=Math.round((p.column-request.center.column)*m.column/epsilon),y=Math.round((p.row-request.center.row)*m.row/epsilon),key=x+','+y;
        if(!vertices.has(key))vertices.set(key,{key,x,y,point:{column:request.center.column+x*epsilon/m.column,row:request.center.row+y*epsilon/m.row},edges:[]});
        return vertices.get(key);};
    for(const [p,q] of walls){let a=vertex(p),b=vertex(q);if(a===b)continue;if(compare(a,b)>0)[a,b]=[b,a];
      const key=a.key+'|'+b.key;if(edges.has(key))continue;
      const edge={a,b,used:false};edges.set(key,edge);a.edges.push(edge);b.edges.push(edge);
    }
    const other=(edge,node)=>edge.a===node?edge.b:edge.a,nodes=Array.from(vertices.values()).sort(compare),chains=[];
    for(const node of nodes)node.edges.sort((a,b)=>compare(other(a,node),other(b,node)));
    const walk=(start,first)=>{const points=[start.point];let node=start,edge=first;
      while(edge&&!edge.used){edge.used=true;node=other(edge,node);points.push(node.point);
        if(node===start||node.edges.length!==2)break;edge=node.edges.find(next=>!next.used);
      }
      const distances=[0];for(let i=1;i<points.length;i++)distances.push(distances[i-1]+distance(points[i-1],points[i]));
      chains.push({points,distances,length:distances.at(-1),closed:node===start});
    };
    for(const node of nodes)if(node.edges.length!==2)for(const edge of node.edges)if(!edge.used)walk(node,edge);
    for(const node of nodes)for(const edge of node.edges)if(!edge.used)walk(node,edge);
    return chains;
  }

  function wallChainPoint(chain,position,request){
    const {at}=defenceMetric(request),length=chain.length;
    position=chain.closed?(position%length+length)%length:Math.max(0,Math.min(length,position));
    for(let i=1;i<chain.points.length;i++)if(position<=chain.distances[i]){
      const start=chain.distances[i-1],span=chain.distances[i]-start;return at(chain.points[i-1],chain.points[i],(position-start)/span);
    }
    return chain.points.at(-1);
  }

  function wallTowerPolicy(request){
    const {m,shift}=defenceMetric(request),site=request.recipe.localSite,
      military=['fortress','pass'].includes(request.recipe.siteType)||['fortress','border-pass'].includes(request.character.kind),
      bank=center=>(site?.channels||[]).some(channel=>{const near=global.WorldAtlasCitySite.distanceToChannel(center,channel,m);
        return near.distance<near.widthMetres/2000+.045;})||!!site?.surface&&Array.from({length:8},(_,i)=>{
          const angle=i*Math.PI/4,p=shift(center,Math.cos(angle)*.045,Math.sin(angle)*.045),bounds=site.surface.bounds;
          return p.column>=bounds.west&&p.column<=bounds.east&&p.row>=bounds.north&&p.row<=bounds.south&&!global.WorldAtlasCitySite.isDry(site.surface,p);
        }).some(Boolean);
    return {radius:Math.max(.004,Math.min(.008,request.recipe.urban.radiusKm*.01)),lookahead:military?.03:.05,
      spacing:center=>military?(bank(center)?.08:.065):(bank(center)?.15:.10),
      minimum:center=>military?(bank(center)?.05:.045):(bank(center)?.11:.075)};
  }

  function completeWallTower(points,request){
    const {m}=defenceMetric(request),physical=polygon=>polygon.map(p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row})),
      area=polygonArea(physical(points)),remaining=clipToLand(points,request.recipe).reduce((sum,piece)=>sum+polygonArea(physical(piece)),0);
    return Math.abs(remaining-area)<=area*1e-5&&points.every((p,i)=>segmentOnLand(p,points[(i+1)%points.length],request.recipe));
  }

  // The first planning call has complete ungated spans. Gate cuts may remove
  // these reserved sites, but cannot reveal a new unreserved corner later.
  const wallCornerReservations=new WeakMap();
  function cornerTowerSites(walls,request,metric){
    const {m,distance}=defenceMetric(request),policy=wallTowerPolicy(request),{radius,lookahead}=policy,
      shape=(center,scale)=>rectangle(center,radius*scale/m.column,radius*scale/m.row);
    if(!wallCornerReservations.has(request)){
      const site=request.recipe.localSite,source=site?.wallSpans?[...site.wallSpans,...site.innerWallSpans||[]]:walls,candidates=[];
      for(const chain of wallChains(source,request))for(let i=chain.closed?0:1;i<chain.points.length-1;i++){
        const center=chain.points[i],previous=chain.points[(i+chain.points.length-2)%(chain.points.length-1)],next=chain.points[i+1],
          ax=(center.column-previous.column)*m.column,ay=(center.row-previous.row)*m.row,bx=(next.column-center.column)*m.column,by=(next.row-center.row)*m.row;
        if(Math.abs(ax*by-ay*bx)<=Math.hypot(ax,ay)*Math.hypot(bx,by)*1e-6)continue;
        const position=chain.distances[i],a=wallChainPoint(chain,position-lookahead,request),b=wallChainPoint(chain,position+lookahead,request),
          x=(center.column-a.column)*m.column,y=(center.row-a.row)*m.row,u=(b.column-center.column)*m.column,v=(b.row-center.row)*m.row,
          angle=Math.atan2(Math.abs(x*v-y*u),x*u+y*v);
        if(angle<Math.PI/6)continue;const points=shape(center,1);
        if(completeWallTower(points,request))candidates.push({center,points,clearance:shape(center,1.75),angle,minimum:policy.minimum(center)});
      }
      candidates.sort((a,b)=>b.angle-a.angle||a.center.column-b.center.column||a.center.row-b.center.row);
      const chosen=[];for(const candidate of candidates)if(!chosen.some(other=>distance(candidate.center,other.center)<Math.max(candidate.minimum,other.minimum)))chosen.push(candidate);
      wallCornerReservations.set(request,chosen);
    }
    const supported=wallChains(walls,request).flatMap(chain=>chain.points.slice(0,-1).filter((p,i)=>chain.closed||
      chain.distances[i]>=radius&&chain.length-chain.distances[i]>=radius));
    return wallCornerReservations.get(request).filter(corner=>supported.some(p=>distance(corner.center,p)<2e-6));
  }

  function wallTowers(walls, request, metric, streets,gates) {
    const towers=[],centers=[],{m,distance}=defenceMetric(request),policy=wallTowerPolicy(request),{radius}=policy,
      widths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),
      local=p=>({column:(p.column-request.center.column)*m.column,row:(p.row-request.center.row)*m.row}),
      emit=(center,points,kind)=>{
        const minimum=policy.minimum(center),bodies=towerMasonryPolygons(points,.000325,request);
        if(centers.some(other=>distance(center,other.center)<Math.max(minimum,other.minimum))
          ||gates.some(gate=>distance(center,gate.center)<gate.widthKm+radius*Math.SQRT2||gate.towers.some(tower=>polygonsOverlap(points,tower)))
          ||streets.some(street=>street.kind!=='rail'&&bodies.some(body=>polygonNearRoute(body,street.points.map(local),
            (widths[street.kind]||widths.local)*metric*.5)))
          ||masonryBlocksTransport([],0,request,widths,[{points,border:.000325}])
          ||!completeWallTower(points,request))return;
        centers.push({center,minimum});towers.push({points,kind,roofLines:roofLines(points)});
      };
    for(const corner of cornerTowerSites(walls,request,metric))emit(corner.center,corner.points,'corner-tower');
    for(const chain of wallChains(walls,request)){
      // A rejected location still consumes its distance interval. No segment
      // endpoint or failed water/street check restarts the sequence.
      let position=policy.spacing(chain.points[0])*.5;
      while(position<chain.length-radius){
        const center=wallChainPoint(chain,position,request);emit(center,rectangle(center,radius/m.column,radius/m.row),'wall-tower');
        position+=policy.spacing(center);
      }
    }
    return towers;
  }

  function countryHouses(request, corridors, districts, metric, widths, walls=[]) {
    const houses=[],lanes=[],hamlets=[],recipe=request.recipe,m=recipe.urban.gridCellKilometres||{},
      rowMetric=m.row||metric,columnMetric=m.column||metric,
      distance=(a,b)=>Math.hypot((a.column-b.column)*columnMetric,(a.row-b.row)*rowMetric),
      roads=corridors.filter(road=>road.kind!=='rail'&&road.points.length>1),
      metricPoint=p=>({column:(p.column-request.center.column)*columnMetric,row:(p.row-request.center.row)*rowMetric}),
      metricWidths=Object.fromEntries(Object.entries(widths).map(([kind,width])=>[kind,width*metric])),
      roadIndex=streetClearanceIndex(roads.map(route=>({...route,points:route.points.map(metricPoint),kind:route.local?'collector':'arterial'})),metricWidths,{column:0,row:0},.075),
      anchors=recipe.localSite?.ruralSettlements||[];
    // Village lanes and the common are planned on habitable land first.
    // Crofts address those short internal lanes; the regional approach is
    // a connection to the settlement, not a frontage generator.
    const budget=Math.min(220,Math.max(anchors.length*18,Math.floor(request.character.buildingCount*.08))),
      usedNames=new Set([recipe.name,global.WorldAtlasCitySite.namingCore(recipe.name,'cities'),
        ...(recipe.localSite?.annotations||[]).map(item=>item.name),...Object.values(recipe.localNames||{})]);
    for(const [anchorIndex,site] of anchors.entries()){
      if(houses.length+6>budget)break;
      const channel=48000+anchorIndex*997,
        desired=Math.min(site.householdTarget,budget-houses.length-(anchors.length-anchorIndex-1)*6),members=[],candidates=[];
      for(const [laneIndex,lane]of site.localLanes.entries()){
        const cumulative=[0];for(let i=1;i<lane.points.length;i++)cumulative.push(cumulative.at(-1)+distance(lane.points[i-1],lane.points[i]));
        for(let station=.009+random(request.seed,channel+laneIndex*271)*.009,plotIndex=0;station<cumulative.at(-1)-.008;
          station+=.009+random(request.seed,channel+laneIndex*271+plotIndex++*17)*.007){
          let segment=1;while(cumulative[segment]<station)segment++;
          const p=lane.points[segment-1],q=lane.points[segment],part=cumulative[segment]-cumulative[segment-1],t=(station-cumulative[segment-1])/part,
            roadPoint={column:p.column+(q.column-p.column)*t,row:p.row+(q.row-p.row)*t};
          for(const side of [-1,1])candidates.push({lane,roadPoint,side,ux:(q.column-p.column)*columnMetric/part,
            uy:(q.row-p.row)*rowMetric/part,rank:distance(roadPoint,site.center)+random(request.seed,channel+laneIndex*271+Math.round(station*10000)+side)*.025});
        }
      }
      candidates.sort((a,b)=>a.rank-b.rank);
      for(const [index,candidate]of candidates.entries()){
        const {roadPoint,ux,uy,side}=candidate,clear=widths.collector*metric*.65+.002,
          front=.008+random(request.seed,channel+index*31)*.003,depth=.009+random(request.seed,channel+index*31+1)*.004,
          frontYard=.003+random(request.seed,channel+index*31+2)*.005,plotFront=.015+random(request.seed,channel+index*31+3)*.011,
          gardenDepth=.016+random(request.seed,channel+index*31+4)*.018,plotDepth=frontYard+depth+gardenDepth,
          plot=(x,y)=>({column:roadPoint.column+(ux*x-uy*side*(clear+y))/columnMetric,row:roadPoint.row+(uy*x+ux*side*(clear+y))/rowMetric}),center=plot(0,frontYard+depth*.5),
          yard=[plot(-plotFront*.5,0),plot(plotFront*.5,0),plot(plotFront*.5,plotDepth),plot(-plotFront*.5,plotDepth)],
          points=[plot(-front*.5,frontYard),plot(front*.5,frontYard),plot(front*.5,frontYard+depth),plot(-front*.5,frontYard+depth)];
        if(side<0){yard.reverse();points.reverse();}
        if(polygonsOverlap(yard,site.common)||districts.some(district=>polygonsOverlap(yard,district))||roadIndex.intersects(yard.map(metricPoint))
          ||walls.some(wall=>polygonNearRoute(yard.map(metricPoint),wall.map(metricPoint),.018))
          ||recipe.harbor?.reservedLand&&polygonsOverlap(yard,recipe.harbor.reservedLand)
          ||houses.concat(members).some(house=>polygonsOverlap(yard,house.yard))
          ||!completeBuildingGround(yard,recipe)||!completeBuildingGround(points,recipe))continue;
        const foundation=foundationAt(points,recipe);if(foundation.reliefMetres>3.5)continue;
        const entrance=plot(0,frontYard),gate=plot(0,0),access=[entrance,gate,roadPoint];
        if(!access.every((p,i)=>!i||segmentOnLand(access[i-1],p,recipe)))continue;
        const roof=request.character.dwellingRoof||(request.character.style==='terraced'?'flat':request.character.court?'hip':'gable'),
          gardenLines=[.25,.5,.75].map(t=>[plot(-plotFront*.37,frontYard+depth+.002+t*(gardenDepth-.004)),plot(plotFront*.37,frontYard+depth+.002+t*(gardenDepth-.004))]);
        members.push({points,yard,yardGate:gate,yardFill:['#dce1c7','#d6dfc0','#e3e4ce'][Math.floor(random(request.seed,channel+index*31+9)*3)],
          gardenLines,roofLines:roofLines(points,null,roof),roof,material:request.character.fixedMaterial.name,wallMaterial:request.character.fixedMaterial.wallName,
          fill:request.character.fixedMaterial.roof[Math.floor(random(request.seed,channel+index*31+10)*request.character.fixedMaterial.roof.length)],
          entrance,access,foundation,center,settlementId:site.id,villageLaneId:candidate.lane.id});
      }
      // Courtyard groups may face each other across the common, but each home
      // still needs an occupied neighbour rather than an isolated remote croft.
      const selected=members.slice(0,desired),retained=selected.filter(home=>selected.some(other=>other!==home&&distance(home.center,other.center)<.055));
      members.splice(0,members.length,...retained);
      // A failed site leaves no invented village label. A rural road endpoint
      // also receives its actual occupied group rather than a decorative name.
      if(members.length<6)continue;
      houses.push(...members);lanes.push(...site.localLanes.map(lane=>lane.points),...members.map(home=>home.access));
      const center={column:members.reduce((sum,home)=>sum+home.center.column,0)/members.length,row:members.reduce((sum,home)=>sum+home.center.row,0)/members.length},
        name=global.WorldAtlasCitySite.nameFromComposition(recipe.namePool,'cities',{composition:recipe.naming.composition,
          seed:request.seed,salt:4180+hamlets.length,used:usedNames,suffix:'村',libraryId:recipe.naming.libraryId});
      hamlets.push({id:site.id,points:members.flatMap(home=>home.yard),common:site.common,center,households:members.length,name});
    }
    return {houses,lanes,hamlets};
  }

  const polygonBoundsCache=new WeakMap();
  function polygonBounds(points){
    let b=polygonBoundsCache.get(points);if(!b){b={west:Math.min(...points.map(p=>p.column)),east:Math.max(...points.map(p=>p.column)),
      north:Math.min(...points.map(p=>p.row)),south:Math.max(...points.map(p=>p.row))};polygonBoundsCache.set(points,b);}return b;
  }
  function polygonsOverlap(first, second) {
    const a=polygonBounds(first),b=polygonBounds(second);
    if(a.west>=b.east||a.east<=b.west||a.north>=b.south||a.south<=b.north)return false;
    let polygon = first.map(point => ({x: point.column, y: point.row}));
    for (let index = 0; index < second.length; index++) {
      const a = second[index], b = second[(index + 1) % second.length];
      const nx = b.row - a.row, ny = a.column - b.column;
      polygon = clipHalfPlane(polygon, nx, ny, a.column * nx + a.row * ny);
    }
    return polygon.length >= 3 && polygonArea(polygon) > 1e-12;
  }

  function defenceMetric(request){
    const m=request.recipe.urban.gridCellKilometres;
    const distance=(a,b)=>Math.hypot((b.column-a.column)*m.column,(b.row-a.row)*m.row);
    const at=(a,b,t)=>({column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t});
    const shift=(p,x,y)=>({column:p.column+x/m.column,row:p.row+y/m.row});
    const project=(p,a,b)=>{const x=(b.column-a.column)*m.column,y=(b.row-a.row)*m.row,s=x*x+y*y;
      return at(a,b,s?Math.max(0,Math.min(1,((p.column-a.column)*m.column*x+(p.row-a.row)*m.row*y)/s)):0);};
    return {m,distance,at,shift,project};
  }

  // Extract one exact shared polygon union. Parcel intersections and short
  // bank returns remain closed through the same geometry library as dry land.
  function simplifyDefenceRing(closed,tolerance,minimumWidth,clearChord){
    const points=closed.slice(0,-1);if(points.length<4)return closed;
    // A thin return has a distant tip even when its two faces coincide.
    // Remove its unsupported width before the distance-based simplification.
    let changed=true;
    while(changed&&points.length>3){
      changed=false;
      for(let i=0;i<points.length;i++){
        const a=points[(i+points.length-1)%points.length],b=points[i],c=points[(i+1)%points.length],
          ux=b[0]-a[0],uy=b[1]-a[1],vx=c[0]-b[0],vy=c[1]-b[1],
          first=Math.hypot(ux,uy),second=Math.hypot(vx,vy),width=Math.abs(ux*vy-uy*vx)/Math.max(first,second,1);
        const turn=ux*vy-uy*vx,dot=ux*vx+uy*vy;
        let narrowTip=turn>0&&dot<=0&&width<minimumWidth;
        if(narrowTip){
          const dx=c[0]-a[0],dy=c[1]-a[1];
          // Contract only a convex tip. A replacement must remain inside the
          // shell and must not cut through another return of the perimeter.
          for(let j=0;j<points.length&&narrowTip;j++){
            const p=points[j],q=points[(j+1)%points.length];
            if(p===a||p===b||p===c||q===a||q===b||q===c)continue;
            const sx=q[0]-p[0],sy=q[1]-p[1],den=dx*sy-dy*sx;
            if(Math.abs(den)<1e-9)continue;
            const px=p[0]-a[0],py=p[1]-a[1],t=(px*sy-py*sx)/den,u=(px*dy-py*dx)/den;
            if(t>1e-9&&t<1-1e-9&&u>=-1e-9&&u<=1+1e-9)narrowTip=false;
          }
          if(narrowTip)narrowTip=clearChord(a,c);
        }
        if(Math.min(first,second)<1||dot<0&&width<tolerance||narrowTip){points.splice(i,1);changed=true;break;}
      }
    }
    const squared=(a,b)=>(a[0]-b[0])**2+(a[1]-b[1])**2,
      first=points.reduce((best,p,i)=>p[0]<points[best][0]||p[0]===points[best][0]&&p[1]<points[best][1]?i:best,0);
    let opposite=first;for(let i=0;i<points.length;i++)if(squared(points[i],points[first])>squared(points[opposite],points[first]))opposite=i;
    const simplify=part=>{
      const kept=new Set([0,part.length-1]),pending=[[0,part.length-1]];
      while(pending.length){
        const [low,high]=pending.pop(),a=part[low],b=part[high],dx=b[0]-a[0],dy=b[1]-a[1],length=dx*dx+dy*dy;
        let furthest=-1,maximum=tolerance*tolerance;
        for(let i=low+1;i<high;i++){
          const p=part[i],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(length||1))),
            distance=(p[0]-a[0]-dx*t)**2+(p[1]-a[1]-dy*t)**2;
          if(distance>maximum){maximum=distance;furthest=i;}
        }
        if(furthest>=0){kept.add(furthest);pending.push([low,furthest],[furthest,high]);}
      }
      return Array.from(kept).sort((a,b)=>a-b).map(i=>part[i]);
    },arc=(start,end)=>{
      const part=[points[start]];for(let i=(start+1)%points.length;i!==end;i=(i+1)%points.length)part.push(points[i]);
      part.push(points[end]);return simplify(part);
    },result=arc(first,opposite).slice(0,-1).concat(arc(opposite,first).slice(0,-1));
    return result.length>=3?result.concat([result[0]]):closed;
  }

  function enclosureBoundary(enclosures,request){
    const {m}=defenceMetric(request),
      local=p=>[(p.column-request.center.column)*m.column,(p.row-request.center.row)*m.row],
      world=([x,y])=>({column:request.center.column+x/1e6/m.column,row:request.center.row+y/1e6/m.row}),
      metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      widths=streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),
      minimumWidth=((defenceWallWidth(widths)*.5+widths.local*.5)*metric+.001)*2e6,
      clearChord=(a,b)=>{
        const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);if(length<1)return false;
        const x=-dy/length*minimumWidth*.5,y=dx/length*minimumWidth*.5,
          body=[[a[0]+x,a[1]+y],[b[0]+x,b[1]+y],[b[0]-x,b[1]-y],[a[0]-x,a[1]-y]].map(world);
        return completeWallTower(body,request);
      };
    const polygons=enclosures.map(polygon=>{
      const points=polygon.map(local).map(([x,y])=>({x,y}));
      if(points.length<3)return [];
      const signed=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+p.x*q.y-q.x*p.y;},0);
      const perimeter=points.reduce((sum,p,i)=>{const q=points[(i+1)%points.length];return sum+Math.hypot(q.x-p.x,q.y-p.y);},0);
      // Zero-width subtraction remnants cannot support masonry. Expanding
      // them would turn a numerical cut into a long attached wall spur.
      if(Math.abs(signed)/Math.max(perimeter,1e-12)<.00005)return [];
      if(signed<0)points.reverse();
      // Weld submillimetre errors from world-coordinate round trips before
      // unioning shared parcel faces. A one-centimetre outward tolerance is
      // far below a wall's masonry width and prevents numerical hairline loops.
      const tolerance=.00001,xs=points.map(p=>p.x),ys=points.map(p=>p.y),
        west=Math.min(...xs)-tolerance,east=Math.max(...xs)+tolerance,north=Math.min(...ys)-tolerance,south=Math.max(...ys)+tolerance;
      let welded=[{x:west,y:north},{x:east,y:north},{x:east,y:south},{x:west,y:south}];
      for(let i=0;i<points.length;i++){
        const a=points[i],b=points[(i+1)%points.length],length=Math.hypot(b.x-a.x,b.y-a.y);
        if(length<1e-10)continue;
        const nx=(b.y-a.y)/length,ny=(a.x-b.x)/length;
        welded=clipHalfPlane(welded,nx,ny,a.x*nx+a.y*ny+tolerance);
      }
      return welded.map(p=>[Math.round(p.x*1e6),Math.round(p.y*1e6)]);
    }).filter(polygon=>polygon.length>=3);
    // A hole describes open land or water inside the town. Only the shell is
    // its exterior defence; the interior land and water masks remain intact.
    return global.WorldAtlasCitySite.unionPolygons(polygons).flatMap(polygon=>polygon.slice(0,1).filter(ring=>
      Math.abs(ring.reduce((sum,p,i)=>{const q=ring[(i+1)%ring.length];return sum+p[0]*q[1]-q[0]*p[1];},0))>200)
      // A five-centimetre geometric tolerance removes boolean needles and
      // microedges while retaining physical corners and the fitted bank.
      .map(ring=>simplifyDefenceRing(ring,50,minimumWidth,clearChord))
      .flatMap(ring=>ring.slice(1).map((p,i)=>[world(ring[i]),world(p)])));
  }

  function defenceSpans(enclosures,request,plazas,layer){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      halfWidth=defenceWallWidth(streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),layer)*metric*.5,
      towerRadius=Math.max(.004,Math.min(.008,request.recipe.urban.radiusKm*.01)),setback=Math.max(halfWidth,towerRadius)*Math.SQRT2+.004,
      toLocal=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),
      toWorld=p=>({column:request.center.column+p.x/m.column,row:request.center.row+p.y/m.row});
    let fitted=enclosures.map(polygon=>polygon.map(toLocal));
    // The working waterfront occupies a real extramural apron. Fit the wall
    // behind that reserved district, keeping its continuous landward face and
    // letting the port approach establish the actual gate through it.
    const port=request.recipe.harbor?.reservedLand?.map(toLocal);
    if(port?.length>=3){
      const signed=port.reduce((sum,a,i)=>{const b=port[(i+1)%port.length];return sum+a.x*b.y-a.y*b.x;},0);
      if(signed<0)port.reverse();
      const planes=port.map((a,i)=>{const b=port[(i+1)%port.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
        return [dy/length,-dx/length,(a.x*dy-a.y*dx)/length];});
      fitted=fitted.flatMap(polygon=>subtractPlanes(polygon,planes));
    }
    // A bridge abutment is an engineered apron, not free space for a wall.
    // Reserve its complete deck plus the real masonry half-width and verge.
    // This also keeps a near-tangent bridge from requiring an enormous gate.
    for(const bridge of request.recipe.localSite?.bridges||[])for(let i=1;i<bridge.points.length;i++){
      const a=toLocal(bridge.points[i-1]),b=toLocal(bridge.points[i]),length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-12)continue;
      const x=(b.x-a.x)/length,y=(b.y-a.y)/length,reach=halfWidth+.001,half=bridge.widthMetres/2000+reach,
        apron=[[a,-reach,half],[a,-reach,-half],[b,reach,-half],[b,reach,half]].map(([p,end,side])=>({x:p.x+x*end-y*side,y:p.y+y*end+x*side})),
        planes=apron.map((p,index)=>{const q=apron[(index+1)%apron.length],dx=q.x-p.x,dy=q.y-p.y,len=Math.hypot(dx,dy);
          return [dy/len,-dx/len,(p.x*dy-p.y*dx)/len];});
      fitted=fitted.flatMap(polygon=>subtractPlanes(polygon,planes));
    }
    // Fit one shared dry defence face around every channel. Applying this
    // common obstacle to parcels before extracting the union keeps the bank
    // wall continuous and leaves room for complete masonry and towers.
    for(const channel of request.recipe.localSite?.channels||[]){
      const samples=channel.points.filter((p,i,all)=>!i||Math.hypot((p.column-all[i-1].column)*m.column,(p.row-all[i-1].row)*m.row)>1e-7),
        points=samples.map(toLocal),units=points.slice(1).map((b,i)=>{
        const a=points[i],length=Math.hypot(b.x-a.x,b.y-a.y);return {x:(b.x-a.x)/length,y:(b.y-a.y)/length};
      });
      if(!units.length)continue;
      const banks=points.map((p,i)=>{
        const first=units[Math.max(0,i-1)],last=units[Math.min(units.length-1,i)],nx=-first.y-last.y,ny=first.x+last.x,
          length=Math.hypot(nx,ny),normal=length>1e-8?{x:nx/length,y:ny/length}:{x:-first.y,y:first.x},
          clearance=(samples[i].widthMetres||channel.widthMetres||0)/2000+setback,
          reach=clearance/Math.max(.5,normal.x*-first.y+normal.y*first.x),
          extension=i===0?-clearance:i===points.length-1?clearance:0,
          center={x:p.x+last.x*extension,y:p.y+last.y*extension};
        return [-1,1].map(side=>({x:center.x+normal.x*reach*side,y:center.y+normal.y*reach*side}));
      });
      // Adjacent bank faces share the same offset junction. Independent
      // segment end caps make a comb of tiny corners along a winding creek.
      for(let i=1;i<banks.length;i++){
        const obstacle=[banks[i-1][0],banks[i][0],banks[i][1],banks[i-1][1]],
          planes=obstacle.map((a,j)=>{const b=obstacle[(j+1)%obstacle.length],dx=b.x-a.x,dy=b.y-a.y,length=Math.hypot(dx,dy);
            return [dy/length,-dx/length,(a.x*dy-a.y*dx)/length];}),
          west=Math.min(...obstacle.map(p=>p.x)),east=Math.max(...obstacle.map(p=>p.x)),north=Math.min(...obstacle.map(p=>p.y)),south=Math.max(...obstacle.map(p=>p.y));
        fitted=fitted.flatMap(polygon=>{
          if(polygon.every(p=>p.x<west)||polygon.every(p=>p.x>east)||polygon.every(p=>p.y<north)||polygon.every(p=>p.y>south))return [polygon];
          return subtractPlanes(polygon,planes);
        });
      }
    }
    const fittedEnclosures=fitted.map(polygon=>polygon.map(toWorld));
    const spans=enclosureBoundary(fittedEnclosures,request).flatMap(points=>{
      // The fitted polygon union is already on local dry ground. Reapplying
      // the street channel clip to its exact bank edges creates broken stubs.
      let pieces=request.recipe.localSite?[{points}]:clipStreetToLand({points},request.recipe);
      for(const plaza of plazas)pieces=pieces.flatMap(piece=>streetOutsidePolygon(piece,plaza.points));
      // Water does not replace masonry. The shared fitted enclosure already
      // leaves structural clearance from the bank; only actual gate passages
      // interrupt this perimeter later, when their streets are known.
      return pieces.map(piece=>piece.points);
    });
    return supportedWallSpans(spans,request,layer);
  }

  // Land clipping can leave millimetre stubs. Short spans are structural only
  // when they join substantial walls; isolated tips cannot support a tower.
  function supportedWallSpans(spans,request,layer){
    const {m,distance}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      minimum=defenceWallWidth(streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),layer)*metric,
      key=p=>Math.round((p.column-request.center.column)*m.column/1e-7)+','+Math.round((p.row-request.center.row)*m.row/1e-7),nodes=new Map();
    const entries=spans.map((points,index)=>({points,index,ends:points.map(key),long:distance(...points)>=minimum}))
      .filter(edge=>edge.ends[0]!==edge.ends[1]);
    for(const edge of entries)for(const end of edge.ends){
      if(!nodes.has(end))nodes.set(end,{long:false,short:new Set()});const node=nodes.get(end);
      if(edge.long)node.long=true;else node.short.add(edge);
    }
    const remaining=new Set(entries.filter(edge=>!edge.long)),seen=new Set(),kept=new Set(entries.filter(edge=>edge.long));
    for(const edge of remaining){if(seen.has(edge))continue;
      const component=[],attachments=new Set(),pending=[edge];
      while(pending.length){const current=pending.pop();if(seen.has(current))continue;seen.add(current);component.push(current);
        for(const end of current.ends){const node=nodes.get(end);if(node.long)attachments.add(end);for(const neighbor of node.short)if(!seen.has(neighbor))pending.push(neighbor);}
      }
      if(attachments.size<2)continue;
      const active=new Set(component),queue=component.flatMap(current=>current.ends).filter(end=>!nodes.get(end).long&&nodes.get(end).short.size===1);
      while(queue.length){const end=queue.pop(),node=nodes.get(end);if(node.long)continue;
        const neighbors=Array.from(node.short).filter(current=>active.has(current));if(neighbors.length!==1)continue;
        const current=neighbors[0];active.delete(current);
        for(const other of current.ends)if(other!==end&&!nodes.get(other).long)queue.push(other);
      }
      for(const current of active)kept.add(current);
    }
    const supported=entries.filter(edge=>kept.has(edge)).map(edge=>edge.points),unsupported=new Set(),
      edgeKey=(a,b)=>[key(a),key(b)].sort().join('|');
    // Clipping can leave a closed ribbon narrower than the masonry itself.
    // Test whole loops, not individual curved-bank spans. The conservative
    // half-footprint threshold preserves compact forts and all open chains.
    for(const chain of wallChains(supported,request)){
      if(!chain.closed)continue;const origin=chain.points[0];let twiceArea=0;
      for(let i=1;i<chain.points.length;i++){
        const a=chain.points[i-1],b=chain.points[i];
        twiceArea+=(a.column-origin.column)*m.column*(b.row-origin.row)*m.row
          -(b.column-origin.column)*m.column*(a.row-origin.row)*m.row;
      }
      if(Math.abs(twiceArea)>=chain.length*minimum*.5)continue;
      for(let i=1;i<chain.points.length;i++)unsupported.add(edgeKey(chain.points[i-1],chain.points[i]));
    }
    return supported.filter(([a,b])=>!unsupported.has(edgeKey(a,b)));
  }

  function planDefences(request,enclosures,innerEnclosures,streets,plazas,widths,metric,defenceGeometry){
    const {wallSpans,innerWallSpans}=defenceGeometry;
    const allSpans=[...wallSpans,...innerWallSpans],safeBase=streetsClearOfWalls(streets,allSpans,request,widths);
    const reservations=[...plazas,...cornerTowerSites(allSpans,request,metric).map(tower=>({points:tower.clearance}))];
    const {distance}=defenceMetric(request),radius=request.recipe.urban.radiusKm,
      bridgeheads=(request.recipe.localSite?.bridges||[]).filter(bridge=>bridge.kind!=='rail').flatMap(bridge=>bridge.points).concat(request.recipe.harbor?[request.recipe.harbor.landPoint]:[]),
      approaches=(request.recipe.transport?.corridors||[]).filter(road=>road.kind==='road').flatMap(road=>[road.points[0],road.points.at(-1)])
        .filter(p=>distance(p,request.center)>radius*.9),population=request.population,
      capacity=population<1500?1:population<7000?2:population<30000?3:population<100000?4:population<300000?6:8,
      targets=bridgeheads.concat(request.plannedCity?.gateTargets||[],approaches.length?approaches:Array.from({length:capacity},(_,i)=>({column:request.center.column+Math.cos(i*Math.PI*2/capacity)*request.radiusColumns*2,
        row:request.center.row+Math.sin(i*Math.PI*2/capacity)*request.radiusRows*2})));
    const innerTargets=request.plannedCity?.governmentCenter?targets:Array.from({length:4},(_,i)=>({
      column:request.center.column+Math.cos(i*Math.PI/2)*request.radiusColumns*2,
      row:request.center.row+Math.sin(i*Math.PI/2)*request.radiusRows*2}));
    const inner=plannedGates(innerWallSpans,safeBase,reservations,request,widths.arterial*metric*1.4,
      request.plannedCity?.governmentCenter?1:Math.min(4,capacity),innerTargets,'inner',allSpans);
    // Build outward from the existing inner passages. An outer gate may join
    // the real inner gate approach instead of cutting a second hole in the keep.
    const outer=plannedGates(wallSpans,safeBase.concat(inner.streets),reservations,request,widths.arterial*metric*1.4,
      request.plannedCity?Math.min(8,Math.max(4,capacity+bridgeheads.length)):
        Math.min(capacity+bridgeheads.length,Math.max(1,approaches.length+bridgeheads.length)),targets,'outer',allSpans);
    for(const gate of outer.gates)if(innerWallSpans.some(span=>gateOpeningInterval(...span,gate,request)))
      gate.sharedLayers=['inner'];
    return {wallSpans,innerWallSpans,enclosures,innerEnclosures,gates:[...outer.gates,...inner.gates],gateStreets:[...outer.streets,...inner.streets]};
  }

  function plannedGates(spans,streets,plazas,request,widthKm,count,targets,layer,allSpans){
    const {m,distance,at,shift,project}=defenceMetric(request),chains=wallChains(spans,request),
      chainIndex=span=>chains.reduce((best,chain,index)=>{
        const p=at(...span,.5),gap=Math.min(...chain.points.slice(1).map((b,i)=>distance(p,project(p,chain.points[i],b))));
        return gap<best.gap?{index,gap}:best;
      },{index:-1,gap:Infinity}).index,
      gates=[],gateStreets=[],candidates=[],faces=spans.map(span=>({span,chainIndex:chainIndex(span),widthKm,cornerMarginKm:widthKm*2.9+.012})),
      inside=p=>{let yes=false;for(const [a,b] of spans)if((a.row>p.row)!==(b.row>p.row)
        &&p.column<(b.column-a.column)*(p.row-a.row)/(b.row-a.row)+a.column)yes=!yes;return yes;},
      roadSegments=streets.filter(street=>street.kind!=='rail'&&!street.palacePerimeter).flatMap(street=>street.points.slice(1).map((b,i)=>({a:street.points[i],b,kind:street.kind,street}))),
      blocked=(a,b)=>plazas.some(plaza=>{const bounds=polygonBounds(plaza.points);
        return Math.max(a.column,b.column)>=bounds.west&&Math.min(a.column,b.column)<=bounds.east
          &&Math.max(a.row,b.row)>=bounds.north&&Math.min(a.row,b.row)<=bounds.south
          &&clipToDistricts({points:[a,b]},[plaza.points]).some(piece=>distance(piece.points[0],piece.points.at(-1))>1e-6);}),
      sameFace=(span,other)=>{if(!other)return false;const [a,b]=other,x=(b.column-a.column)*m.column,y=(b.row-a.row)*m.row,length=Math.hypot(x,y);
        return span.every(p=>Math.abs((p.column-a.column)*m.column*y-(p.row-a.row)*m.row*x)<length*widthKm*.2);},
      crosses=(a,b,except=null)=>allSpans.some(span=>{
        if(span===except||sameFace(span,except))return false;const [c,d]=span,dx=b.column-a.column,dy=b.row-a.row,sx=d.column-c.column,sy=d.row-c.row,den=dx*sy-dy*sx;
        if(Math.abs(den)<1e-16)return false;const t=((c.column-a.column)*sy-(c.row-a.row)*sx)/den,u=((c.column-a.column)*dy-(c.row-a.row)*dx)/den;
        return t>1e-7&&t<1-1e-7&&u>=-1e-7&&u<=1+1e-7;
      }),
      anchor=(portal,wantInside)=>{
        const candidates=roadSegments.map(segment=>({...segment,p:project(portal,segment.a,segment.b)}))
          .filter(segment=>inside(segment.p)===wantInside&&distance(portal,segment.p)<=request.recipe.urban.radiusKm*.65)
          .sort((a,b)=>distance(portal,a.p)-distance(portal,b.p)),
          safe=(a,b)=>{const length=distance(a,b);if(blocked(a,b)||crosses(a,b)||!segmentOnLand(a,b,request.recipe))return false;
            const steps=Math.max(2,Math.ceil(length/.04));return Array.from({length:steps+1},(_,i)=>at(a,b,i/steps)).every(p=>inside(p)===wantInside);};
        return candidates.find(segment=>safe(portal,segment.p))||null;
      };
    // A short road outside an inner wall can be an isolated terrain remnant.
    // Measure the actual road components before selecting a gate, so its outer
    // approach reaches the town rather than an otherwise unreachable forecourt.
    const principal=roadSegments.map(segment=>segment.kind==='arterial'),parents=roadSegments.map((segment,i)=>i),
      root=i=>parents[i]===i?i:parents[i]=root(parents[i]),
      connect=(a,b)=>{a=root(a);b=root(b);if(a!==b){parents[a]=b;principal[b]=principal[b]||principal[a];}},
      boxes=roadSegments.map((segment,index)=>({bounds:polygonBounds([segment.a,segment.b]),segment,index})),
      nearby=boundsIndex(boxes,request.center,.075/Math.sqrt(m.row*m.column)),
      connected=(first,second)=>{
        if(first.street===second.street)return true;
        if(inside(at(first.a,first.b,.5))!==inside(at(second.a,second.b,.5)))return false;
        const dx=first.b.column-first.a.column,dy=first.b.row-first.a.row,
          sx=second.b.column-second.a.column,sy=second.b.row-second.a.row,den=dx*sy-dy*sx;
        if(Math.abs(den)>1e-18){const cx=second.a.column-first.a.column,cy=second.a.row-first.a.row,
          t=(cx*sy-cy*sx)/den,u=(cx*dy-cy*dx)/den;
          if(t>=-1e-9&&t<=1+1e-9&&u>=-1e-9&&u<=1+1e-9)return true;}
        return Math.min(distance(first.a,project(first.a,second.a,second.b)),distance(first.b,project(first.b,second.a,second.b)),
          distance(second.a,project(second.a,first.a,first.b)),distance(second.b,project(second.b,first.a,first.b)))<1e-7;
      };
    if(layer==='inner')for(let i=0;i<roadSegments.length;i++)for(const other of nearby(boxes[i].bounds)){
      if(other.index>i&&connected(roadSegments[i],other.segment))connect(i,other.index);
    }
    const reach=new Map();for(let i=0;i<roadSegments.length;i++)reach.set(root(i),(reach.get(root(i))||0)+distance(roadSegments[i].a,roadSegments[i].b));
    roadSegments.forEach((segment,i)=>{segment.reach=reach.get(root(i));segment.componentIndex=i;});
    // A curved bank is tessellated into short spans. The complete wall chain,
    // rather than one tessellation edge, supports a real bridge gate.
    if(layer==='outer')for(const bridge of request.recipe.localSite?.bridges||[]){
      if(bridge.kind==='rail')continue;
      const bridgeWidth=Math.max(.003,bridge.widthMetres/2000),
        masonryHalf=defenceWallWidth(request.defenceWidths||streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),layer)
          *gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns)*.5,
        margin=bridgeWidth+masonryHalf;
      for(const target of bridge.points){
        if(inside(target))continue;
        let nearest=null;
        for(const [chainIndex,chain] of chains.entries())for(let i=1;i<chain.points.length;i++){
          const q=project(target,chain.points[i-1],chain.points[i]),d=distance(target,q);
          if(!nearest||d<nearest.distance)nearest={chain,chainIndex,position:chain.distances[i-1]+distance(chain.points[i-1],q),distance:d};
        }
        if(!nearest||nearest.distance>request.recipe.urban.radiusKm*.35)continue;
        const {chain,position}=nearest;
        const first=chain.closed?position-margin*1.1:Math.max(0,position-margin*1.1),
          last=chain.closed?position+margin*1.1:Math.min(chain.length,position+margin*1.1),
          face=[wallChainPoint(chain,first,request),wallChainPoint(chain,last,request)],
          sample=Array.from({length:9},(_,i)=>wallChainPoint(chain,first+(last-first)*i/8,request));
        if(sample.some(p=>distance(p,project(p,...face))>bridgeWidth*.2))continue;
        faces.unshift({span:face,chainIndex:nearest.chainIndex,widthKm:bridgeWidth,cornerMarginKm:margin,bridgeTarget:target});
      }
    }
    for(const {span:[a,b],chainIndex,widthKm,cornerMarginKm,bridgeTarget} of faces){
      const length=distance(a,b);if(length<cornerMarginKm*2)continue;
      const tangent={x:(b.column-a.column)*m.column/length,y:(b.row-a.row)*m.row/length};
      const fractions=[...(bridgeTarget?[distance(a,project(bridgeTarget,a,b))/length]:[]),.5,.25,.75,...targets.map(target=>{
        const p=project(target,a,b);return distance(a,p)/length;
      })].map(t=>Math.max(cornerMarginKm/length,Math.min(1-cornerMarginKm/length,t)));
      const used=[];
      for(const t of fractions){if(used.some(value=>Math.abs(value-t)*length<widthKm*2))continue;used.push(t);
        const center=at(a,b,t),normal={x:-tangent.y,y:tangent.x},probe=shift(center,normal.x*.006,normal.y*.006);
        const outward=inside(probe)?{x:-normal.x,y:-normal.y}:normal,innerDepth=Math.max(.018,widthKm*1.25),outerDepth=Math.max(.007,widthKm*.5),
          innerPortal=shift(center,-outward.x*innerDepth,-outward.y*innerDepth),outerPortal=bridgeTarget||shift(center,outward.x*outerDepth,outward.y*outerDepth),
          face=[a,b];
        if(!inside(innerPortal)||inside(outerPortal)||crosses(innerPortal,outerPortal,face)||blocked(innerPortal,outerPortal)||!segmentOnLand(innerPortal,outerPortal,request.recipe))continue;
        let outsideApproach=outerPortal;
        if(layer==='outer'&&!bridgeTarget)for(let step=1;step<=5;step++){
          const p=shift(outerPortal,outward.x*.004*step,outward.y*.004*step);
          if(inside(p)||crosses(outerPortal,p)||blocked(outerPortal,p)||!segmentOnLand(outerPortal,p,request.recipe))break;
          outsideApproach=p;
        }
        if(layer==='outer'&&!bridgeTarget&&distance(outsideApproach,outerPortal)<.003)continue;
        const inner=anchor(innerPortal,true),outer=layer==='inner'?anchor(outerPortal,false):null;
        if(!inner||layer==='inner'&&!outer)continue;
        const points=[inner.p,innerPortal,center,outerPortal,...(layer==='outer'?[outsideApproach]:[]),...(outer?[outer.p]:[])].filter((p,i,all)=>!i||distance(p,all[i-1])>1e-8);
        const masonryHalf=defenceWallWidth(request.defenceWidths||streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns),layer)
          *gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns)*.5,
          opening=physicalWallOpeningInterval(a,b,[{points:[innerPortal,outerPortal],halfWidthKm:widthKm}],masonryHalf,request);
        if(!opening||Math.min(opening[0],1-opening[1])*length<masonryHalf)continue;
        const ox=(center.column-request.center.column)*m.column,oy=(center.row-request.center.row)*m.row,direction=Math.abs(ox)>Math.abs(oy)?ox>0?'东':'西':oy>0?'南':'北';
        candidates.push({center,towers:[],points,outward,layer,widthKm,wallSpan:[a,b],chainIndex,cornerMarginKm,bridgeTarget,outerReach:outer?.reach||0,
          innerRoad:inner.componentIndex,outerRoad:outer?.componentIndex,
          name:(layer==='inner'?'内城':'')+direction+(['fortress','pass'].includes(request.recipe.siteType)?'关门':'城门'),
          passage:[innerPortal,outerPortal],anchorLength:distance(inner.p,innerPortal)+(outer?distance(outer.p,outerPortal):0)});
      }
    }
    for(let i=0;candidates.length;i++){
      const joins=candidate=>candidate.outerRoad!==undefined&&root(candidate.innerRoad)!==root(candidate.outerRoad)?1:0,
        servesPrincipal=candidate=>joins(candidate)&&principal[root(candidate.innerRoad)]&&principal[root(candidate.outerRoad)];
      // The normal gate count describes the town's scale. A terrain-split
      // inner district still needs an actual passage to every principal road;
      // private planned palace precincts retain their single surveyed entrance.
      if(i>=count&&(layer!=='inner'||request.plannedCity?.governmentCenter||!candidates.some(servesPrincipal)))break;
      const target=targets[(request.plannedCity?i:Math.floor(i*targets.length/count))%targets.length];
      const score=candidate=>distance(candidate.center,target)/request.recipe.urban.radiusKm+candidate.anchorLength/request.recipe.urban.radiusKm*.4
        -(candidate.bridgeTarget&&distance(candidate.bridgeTarget,target)<1e-8?1:0);
      candidates.sort((a,b)=>(layer==='inner'?(i>=count?Number(servesPrincipal(b))-Number(servesPrincipal(a)):joins(b)-joins(a))
        ||(count===1?b.outerReach-a.outerReach:0):0)||score(a)-score(b));const chosen=candidates.shift(),id=layer+'-gate-'+i;
      if(chosen.outerRoad!==undefined)connect(chosen.innerRoad,chosen.outerRoad);
      const {points,anchorLength,bridgeTarget,outerReach,innerRoad,outerRoad,chainIndex,...gate}=chosen;
      gate.towers=gateTowerSites(gate,streets,plazas,request,
        streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns));
      gates.push({...gate,id});gateStreets.push({id,kind:'collector',points,gateCenter:chosen.center,
        widthKm:chosen.widthKm,wallSpan:chosen.wallSpan,outward:chosen.outward,layer});
      for(let j=candidates.length-1;j>=0;j--)if(candidates[j].chainIndex===chainIndex
        &&chosen.outward.x*candidates[j].outward.x+chosen.outward.y*candidates[j].outward.y>.5
        &&distance(chosen.center,candidates[j].center)<Math.max(chosen.widthKm*7,request.recipe.urban.radiusKm*.22))candidates.splice(j,1);
    }
    return {gates,streets:gateStreets};
  }

  const gateOpeningRoutes=new WeakMap();

  function physicalRouteBands(points,half,request){
    const {m}=defenceMetric(request),local=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),result=[];
    for(let i=1;i<points.length;i++){
      const a=local(points[i-1]),b=local(points[i]),length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-12)continue;
      const x=(b.x-a.x)/length,y=(b.y-a.y)/length;
      result.push([[a,-half,half],[b,half,half],[b,half,-half],[a,-half,-half]]
        .map(([p,end,side])=>[p.x+x*end-y*side,p.y+y*end+x*side]));
    }return result;
  }

  function transportSurfaceRoutes(request,widths){
    const recipe=request.recipe,metric=gridCellKilometres(recipe,request.radiusRows,request.radiusColumns),
      routes=[...(recipe.transport?.corridors||[]),...(recipe.localSite?.ruralRoads||[])]
        .filter(route=>route.kind==='road')
        .map(route=>({points:route.points,halfWidthKm:route.fieldTrack?.0009:(route.local?widths.collector:widths.arterial)*metric*.5}));
    routes.push(...(recipe.localSite?.bridges||[]).map(bridge=>({points:bridge.points,halfWidthKm:bridge.widthMetres/2000})));
    // Harbor access is painted at arterial width even if its routing source
    // was classified as a local road. Preserve that actual full-width surface.
    if(recipe.harbor?.access.length)routes.push({points:recipe.harbor.access,halfWidthKm:widths.arterial*metric*.5});
    return routes;
  }

  function masonryBlocksTransport(walls,width,request,widths,towers=[]){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      local=p=>({column:(p.column-request.center.column)*m.column,row:(p.row-request.center.row)*m.row}),
      routes=transportSurfaceRoutes(request,widths).map(route=>({points:route.points.map(local),half:route.halfWidthKm}));
    const bodies=wallStrokePolygons(walls,request,width).map(points=>({points:points.map(p=>({column:p.x,row:p.y})),border:0}));
    bodies.push(...towers.flatMap(tower=>towerMasonryPolygons(tower.points,tower.border,request).map(points=>({points,border:0}))));
    return bodies.some(body=>routes.some(route=>polygonNearRoute(body.points,route.points,route.half+body.border)));
  }

  // Project the complete passage footprint through the actual thick wall.
  // At an oblique entrance its opening grows by the wall's physical depth,
  // rather than assuming a perpendicular twelve-metre slot at every angle.
  function gateOpeningInterval(a,b,gate,request){
    const metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      widths=request.defenceWidths||streetWidthsInGrid(request.recipe,request.radiusRows,request.radiusColumns);
    return physicalWallOpeningInterval(a,b,gateOpeningRoutes.get(gate)||[{points:gate.passage,halfWidthKm:gate.widthKm}],
      defenceWallWidth(widths,gate.layer)*metric*.5,request);
  }

  function physicalWallOpeningInterval(a,b,routes,half,request){
    const {m,distance}=defenceMetric(request),length=distance(a,b);if(length<1e-12)return null;
    const
      x=(b.column-a.column)*m.column/length,y=(b.row-a.row)*m.row/length,
      local=p=>[(p.column-request.center.column)*m.column,(p.row-request.center.row)*m.row],first=local(a),last=local(b),
      body=[[first[0]-y*half,first[1]+x*half],[first[0]+y*half,first[1]-x*half],
        [last[0]+y*half,last[1]-x*half],[last[0]-y*half,last[1]+x*half]],
      bounds=ring=>({w:Math.min(...ring.map(p=>p[0])),e:Math.max(...ring.map(p=>p[0])),n:Math.min(...ring.map(p=>p[1])),s:Math.max(...ring.map(p=>p[1]))}),box=bounds(body);
    let low=1,high=0;
    for(const route of routes)
      for(const band of physicalRouteBands(route.points,route.halfWidthKm,request)){
        const other=bounds(band);if(other.w>box.e||other.e<box.w||other.n>box.s||other.s<box.n)continue;
        for(const polygon of global.WorldAtlasCitySite.intersectPolygons([body],[band]))for(const ring of polygon)for(const p of ring){
          const t=((p[0]-first[0])*x+(p[1]-first[1])*y)/length;low=Math.min(low,t);high=Math.max(high,t);
        }
      }
    low=Math.max(0,low);high=Math.min(1,high);return high>low?[low,high]:null;
  }

  function fitWallOpenings(walls,routes,width,request){
    const metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),{at}=defenceMetric(request);
    return walls.flatMap(([a,b])=>{
      const intervals=routes.map(route=>physicalWallOpeningInterval(a,b,[route],width*metric*.5,request)).filter(Boolean)
        .sort((a,b)=>a[0]-b[0]),result=[];let cursor=0;
      for(const [low,high]of intervals){if(low>cursor)result.push([at(a,b,cursor),at(a,b,low)]);cursor=Math.max(cursor,high);}
      if(cursor<1)result.push([at(a,b,cursor),b]);return result;
    });
  }

  function gateTowerSites(gate,streets,plazas,request,widths){
    const {m,distance,shift}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      [a,b]=gate.wallSpan,length=distance(a,b),tangent={x:(b.column-a.column)*m.column/length,y:(b.row-a.row)*m.row/length},
      normal=gate.outward,half=gate.widthKm*.48,border=.000325,
      local=p=>({column:(p.column-request.center.column)*m.column,row:(p.row-request.center.row)*m.row}),
      routes=streets.concat(transportSurfaceRoutes(request,widths),
        [{kind:'arterial',points:gate.passage}]).map(route=>({points:route.points.map(local),half:route.halfWidthKm||(widths[route.kind]||widths.local)*metric*.5})),
      interval=gateOpeningInterval(a,b,gate,request),centerPosition=((gate.center.column-a.column)*m.column*tangent.x+(gate.center.row-a.row)*m.row*tangent.y),
      limits=interval?[interval[0]*length-centerPosition,interval[1]*length-centerPosition]:[-gate.widthKm,gate.widthKm],towers=[];
    for(const side of [-1,1])for(const extra of [0,half*2]){
      const position=limits[side>0?1:0]+side*(half+border+.001+extra);
      if(centerPosition+position-half<0||centerPosition+position+half>length)continue;
      const points=[[-1,-1],[1,-1],[1,1],[-1,1]].map(([x,y])=>shift(gate.center,
        tangent.x*(position+x*half)+normal.x*y*half,tangent.y*(position+x*half)+normal.y*y*half));
      if(tangent.x*normal.y-tangent.y*normal.x<0)points.reverse();
      const bodies=towerMasonryPolygons(points,border,request);
      if(!completeWallTower(points,request)||plazas.some(plaza=>polygonsOverlap(points,plaza.points))
        ||routes.some(route=>bodies.some(body=>polygonNearRoute(body,route.points,route.half))))continue;
      towers.push(points);break;
    }return towers;
  }

  function wallSegmentsWithGates(a,b,gates,request){
    const {distance,at}=defenceMetric(request),length=distance(a,b),openings=gates.map(gate=>gateOpeningInterval(a,b,gate,request)).filter(Boolean);
    if(length<1e-8)return [];
    openings.sort((a,b)=>a[0]-b[0]);const lines=[];let cursor=0;
    for(const [low,high] of openings){if(low>cursor)lines.push([at(a,b,cursor),at(a,b,low)]);cursor=Math.max(cursor,high);}
    if(cursor<1)lines.push([at(a,b,cursor),b]);return lines;
  }

  function streetsClearOfWalls(streets,walls,request,widths){
    return wallClearanceIndex(walls,request,widths).clip(streets);
  }

  // Match the butt-ended, limited-miter masonry painted by appendWallPaint.
  // Convex pieces retain the real corners without round endpoint bulbs.
  function wallMasonryPolygons(walls,request,widths){
    return wallStrokePolygons(walls,request,defenceWallWidth(widths));
  }

  const towerMasonryCache=new WeakMap();
  function towerMasonryPolygons(points,border,request){
    if(!towerMasonryCache.has(request))towerMasonryCache.set(request,new WeakMap());
    const cache=towerMasonryCache.get(request);
    if(!cache.has(points))cache.set(points,new Map());
    const borders=cache.get(points);if(borders.has(border))return borders.get(border);
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      fill=expandConvexPolygon(points.map(p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row})),0),
      walls=points.map((p,i)=>[p,points[(i+1)%points.length]]),
      bodies=[fill,...(border?wallStrokePolygons(walls,request,border*2/metric):[])]
        .map(polygon=>polygon.map(p=>({column:p.x,row:p.y})));
    borders.set(border,bodies);return bodies;
  }

  function wallStrokePolygons(walls,request,width){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      half=width*metric*.5,
      local=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),pieces=[];
    for(const line of joinedWallLines(walls)){
      const points=line.map(local),units=[];
      for(let i=1;i<points.length;i++){
        const a=points[i-1],b=points[i],length=Math.hypot(b.x-a.x,b.y-a.y),u={x:(b.x-a.x)/length,y:(b.y-a.y)/length};
        units.push(u);const x=-u.y*half,y=u.x*half;
        pieces.push([{x:a.x+x,y:a.y+y},{x:a.x-x,y:a.y-y},{x:b.x-x,y:b.y-y},{x:b.x+x,y:b.y+y}]);
      }
      const closed=line[0]===line.at(-1);
      for(let i=closed?0:1;i<points.length-1;i++){
        const a=units[(i+units.length-1)%units.length],b=units[i],turn=a.x*b.y-a.y*b.x;
        if(Math.abs(turn)<1e-12)continue;
        const p=points[i],side=turn>0?-1:1,first={x:p.x-a.y*half*side,y:p.y+a.x*half*side},
          last={x:p.x-b.y*half*side,y:p.y+b.x*half*side},den=1+a.x*b.x+a.y*b.y,
          x=den>1e-12?-(a.y+b.y)*half*side/den:Infinity,y=den>1e-12?(a.x+b.x)*half*side/den:Infinity,
          join=[p,first];
        if(Math.hypot(x,y)<=half*wallMiterLimit*(1+1e-12))join.push({x:p.x+x,y:p.y+y});
        join.push(last);pieces.push(join);
      }
    }
    return pieces;
  }

  function expandConvexPolygon(body,margin){
    const signed=body.reduce((sum,p,i)=>{const q=body[(i+1)%body.length];return sum+p.x*q.y-q.x*p.y;},0),
      polygon=signed<0?body.slice().reverse():body;
    if(margin===0)return polygon;
    const
      bounds={west:Math.min(...polygon.map(p=>p.x))-margin,east:Math.max(...polygon.map(p=>p.x))+margin,
        north:Math.min(...polygon.map(p=>p.y))-margin,south:Math.max(...polygon.map(p=>p.y))+margin};
    let result=[{x:bounds.west,y:bounds.north},{x:bounds.east,y:bounds.north},{x:bounds.east,y:bounds.south},{x:bounds.west,y:bounds.south}];
    for(let i=0;i<polygon.length&&result.length>=3;i++){
      const a=polygon[i],b=polygon[(i+1)%polygon.length],length=Math.hypot(b.x-a.x,b.y-a.y);if(length<1e-12)continue;
      const nx=(b.y-a.y)/length,ny=(a.x-b.x)/length;
      result=clipHalfPlane(result,nx,ny,a.x*nx+a.y*ny+margin);
    }return result;
  }

  // A round road surface needs the Euclidean distance from the real masonry.
  // Offsetting every face with miter joins creates false spikes at wall caps
  // and small corner triangles, cutting otherwise legal oblique passages.
  function masonryBlockedIntervals(a,b,polygon,radius){
    const dx=b.x-a.x,dy=b.y-a.y,squared=dx*dx+dy*dy,intervals=[];
    if(squared===0){
      let inside=true;
      for(let i=0;i<polygon.length;i++){
        const p=polygon[i],q=polygon[(i+1)%polygon.length],x=q.x-p.x,y=q.y-p.y,length=x*x+y*y,
          machineEdge=Number.EPSILON*8*Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(q.x),Math.abs(q.y));
        if(length<=machineEdge*machineEdge)continue;
        const t=Math.max(0,Math.min(1,((a.x-p.x)*x+(a.y-p.y)*y)/length));
        if(Math.hypot(a.x-p.x-t*x,a.y-p.y-t*y)<radius)return [[0,1]];
        if(x*(a.y-p.y)-y*(a.x-p.x)<0)inside=false;
      }
      return inside?[[0,1]]:intervals;
    }
    const restrict=(range,value,change,low,high)=>{
      if(change===0)return value>=low&&value<=high;
      const first=(low-value)/change,last=(high-value)/change;
      range[0]=Math.max(range[0],Math.min(first,last));range[1]=Math.min(range[1],Math.max(first,last));
      return range[1]>range[0];
    },circle=p=>{
      const x=a.x-p.x,y=a.y-p.y,cross=x*dy-y*dx,delta=(radius*radius-cross*cross/squared)/squared;
      if(delta<=0)return;
      const center=-(x*dx+y*dy)/squared,half=Math.sqrt(delta),low=Math.max(0,center-half),high=Math.min(1,center+half);
      if(high>low)intervals.push([low,high]);
    },inside=[0,1];let intersects=true;
    for(let i=0;i<polygon.length;i++){
      const p=polygon[i],q=polygon[(i+1)%polygon.length],x=q.x-p.x,y=q.y-p.y,length=Math.hypot(x,y);
      // Half-plane clipping can repeat a corner a few machine ulps away.
      // Such an arithmetic edge has no stable direction for an inside test.
      if(length<=Number.EPSILON*8*Math.max(Math.abs(p.x),Math.abs(p.y),Math.abs(q.x),Math.abs(q.y)))continue;
      const ux=x/length,uy=y/length,along=(a.x-p.x)*ux+(a.y-p.y)*uy,normal=-(a.x-p.x)*uy+(a.y-p.y)*ux,
        stepAlong=dx*ux+dy*uy,stepNormal=-dx*uy+dy*ux,strip=[0,1];
      if(intersects&&!restrict(inside,normal,stepNormal,0,Infinity))intersects=false;
      if(restrict(strip,along,stepAlong,0,length)&&restrict(strip,normal,stepNormal,-radius,radius))intervals.push(strip);
      circle(p);
    }
    if(intersects&&inside[1]>inside[0])intervals.push(inside);
    return intervals;
  }

  function streetOutsideMasonry(street,polygon,radius,request){
    const {m}=defenceMetric(request),local=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),
      result=[];let run=[];
    const flush=()=>{if(run.length>1)result.push({...street,points:run});run=[];};
    for(let i=1;i<street.points.length;i++){
      const a=street.points[i-1],b=street.points[i],blocked=masonryBlockedIntervals(local(a),local(b),polygon,radius)
        .sort((a,b)=>a[0]-b[0]),merged=[];
      for(const interval of blocked){const last=merged.at(-1);
        if(last&&interval[0]<=last[1])last[1]=Math.max(last[1],interval[1]);else merged.push(interval.slice());}
      const clear=[];let cursor=0;
      for(const [low,high]of merged){if(low>cursor)clear.push([cursor,low]);cursor=Math.max(cursor,high);}
      if(cursor<1)clear.push([cursor,1]);
      const at=t=>t===0?a:t===1?b:{column:a.column+(b.column-a.column)*t,row:a.row+(b.row-a.row)*t};
      for(const [low,high]of clear){
        if(low>0)flush();if(!run.length)run.push(at(low));run.push(at(high));if(high<1)flush();
      }
      if(!clear.length)flush();
    }
    flush();return result;
  }

  function wallClearanceIndex(walls,request,widths){
    const {m}=defenceMetric(request),metric=gridCellKilometres(request.recipe,request.radiusRows,request.radiusColumns),
      local=p=>({x:(p.column-request.center.column)*m.column,y:(p.row-request.center.row)*m.row}),
      bodies=wallMasonryPolygons(walls,request,widths).map(points=>({points,margin:0})),indexes=new Map();
    const intersectsBounds=(street,bounds)=>street.points.some((p,i)=>i&&Math.max(p.column,street.points[i-1].column)>=bounds.west
      &&Math.min(p.column,street.points[i-1].column)<=bounds.east&&Math.max(p.row,street.points[i-1].row)>=bounds.north&&Math.min(p.row,street.points[i-1].row)<=bounds.south);
    for(const group of request.masonryGroups||[])bodies.push(...wallStrokePolygons(group.walls,request,group.width).map(points=>({points,margin:0})));
    const addTower=(points,border)=>bodies.push(...towerMasonryPolygons(points,border,request)
      .map(polygon=>({points:polygon.map(p=>({x:p.column,y:p.row})),margin:0})));
    for(const tower of cornerTowerSites(walls,request,metric))addTower(tower.points,.000325);
    for(const gate of request.defenceGates||[])for(const tower of gate.towers)addTower(tower,.000325);
    for(const tower of request.masonryTowers||[])addTower(tower.points,tower.border);
    const world=p=>({column:request.center.column+p.x/m.column,row:request.center.row+p.y/m.row}),
      solids=bodies.map(body=>{const polygon=expandConvexPolygon(body.points,body.margin),points=polygon.map(world);
        return {polygon,points,bounds:polygonBounds(points),physical:polygon.map(p=>({column:p.x,row:p.y}))};});
    const index=kind=>{
      const half=typeof kind==='number'?kind/2000:kind==='footpath'?.0005:kind==='country-access'?Math.min(widths.local*metric,.0018)*.5:(widths[kind]||widths.local)*metric*.5;
      if(indexes.has(half))return indexes.get(half);
      const obstacles=solids.map(body=>({polygon:body.polygon,half,bounds:{
        west:body.bounds.west-half/m.column,east:body.bounds.east+half/m.column,
        north:body.bounds.north-half/m.row,south:body.bounds.south+half/m.row}}));
      const candidates=boundsIndex(obstacles,request.center,.075/Math.sqrt(m.row*m.column));indexes.set(half,candidates);return candidates;
    };
    const footprints=boundsIndex(solids,request.center,.075/Math.sqrt(m.row*m.column));
    const clip=streets=>streets.flatMap(street=>{
      let pieces=[street];
      // Clipping is independent between streets. Keep obstacle order within
      // each original street, preserving both exact cuts and output order.
      for(const obstacle of index(street.kind)(polygonBounds(street.points)))pieces=pieces.flatMap(piece=>
        intersectsBounds(piece,obstacle.bounds)?streetOutsideMasonry(piece,obstacle.polygon,obstacle.half,request):[piece]);
      return pieces;
    });
    return {clip,intersects(points){const physical=points.map(p=>({column:(p.column-request.center.column)*m.column,row:(p.row-request.center.row)*m.row}));
      return footprints(polygonBounds(points)).some(obstacle=>polygonsOverlap(physical,obstacle.physical));
    },clearAccess(points,kind='footpath'){
      if(!points||points.length<2)return true;
      const clear=clip([{kind,points}]);return clear.length===1&&clear[0].points.length===points.length
        &&clear[0].points.every((p,i)=>Math.hypot(p.column-points[i].column,p.row-points[i].row)<1e-10);
    }};
  }

  function polygonArea(points) {
    if(points.length<3)return 0;
    const origin=points[0];
    return Math.abs(points.reduce((sum, point, index) => { const next = points[(index + 1) % points.length];
      return sum+(point.x-origin.x)*(next.y-origin.y)-(next.x-origin.x)*(point.y-origin.y); }, 0)) * 0.5;
  }

  function polygonCentre(points) {
    return {x: points.reduce((sum, point) => sum + point.x, 0) / points.length, y: points.reduce((sum, point) => sum + point.y, 0) / points.length};
  }

  function clipHalfPlane(points, nx, ny, distance) {
    const result = [];
    for (let index = 0; index < points.length; index++) {
      const first = points[index], second = points[(index + 1) % points.length];
      const a = first.x * nx + first.y * ny - distance, b = second.x * nx + second.y * ny - distance;
      if (a <= 1e-12) result.push(first);
      if ((a < 0 && b > 0) || (a > 0 && b < 0)) {
        const t = a / (a - b);
        result.push({x: first.x + (second.x - first.x) * t, y: first.y + (second.y - first.y) * t});
      }
    }
    return result;
  }

  function bisectParcel(points, seed, channel, chaos, aspect=1) {
    const xs = points.map(point => point.x), ys = points.map(point => point.y);
    const horizontal = (Math.max(...xs) - Math.min(...xs))/aspect >= Math.max(...ys) - Math.min(...ys);
    const angle = (horizontal ? 0 : Math.PI / 2) + (random(seed, channel + 1) - 0.5) * chaos;
    const nx = Math.cos(angle), ny = Math.sin(angle);
    const projections = points.map(point => point.x * nx + point.y * ny);
    const low = Math.min(...projections), high = Math.max(...projections);
    const distance = low + (high - low) * (0.38 + random(seed, channel + 2) * 0.24);
    const first = clipHalfPlane(points, nx, ny, distance), second = clipHalfPlane(points, -nx, -ny, -distance);
    if (first.length < 3 || second.length < 3 || Math.min(polygonArea(first), polygonArea(second)) < 1e-10) return null;
    const cut = first.filter(point => Math.abs(point.x * nx + point.y * ny - distance) < 1e-9);
    return cut.length >= 2 ? {first, second, cut: [cut[0], cut[cut.length - 1]]} : null;
  }

  function insetPolygon(points, margin) {
    let result = points;
    for (let index = 0; index < points.length && result.length >= 3; index++) {
      const a = points[index], b = points[(index + 1) % points.length];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      if (length < 1e-12) continue;
      const nx = (b.y - a.y) / length, ny = (a.x - b.x) / length;
      result = clipHalfPlane(result, nx, ny, a.x * nx + a.y * ny - margin);
    }
    return result;
  }

  function clipToLand(points, recipe) {
    if(recipe.localSite)return clipToLocalLand(points.map(p=>({x:p.column,y:p.row})),recipe).map(polygon=>polygon.map(p=>({column:p.x,row:p.y})));
    const local = points.map(point => ({x: point.column, y: point.row}));
    const result = [];
    for (const [row, column] of recipe.terrain.buildable.allowedCells) {
      let polygon = clipHalfPlane(local, -1, 0, -column);
      polygon = clipHalfPlane(polygon, 1, 0, column + 1);
      polygon = clipHalfPlane(polygon, 0, -1, -row);
      polygon = clipHalfPlane(polygon, 0, 1, row + 1);
      if (polygon.length >= 3 && polygonArea(polygon) > 1e-12) result.push(...clipToLocalLand(polygon,recipe)
        .map(piece=>piece.map(point => ({row: point.y, column: point.x}))));
    }
    return result;
  }

  function clipRectangle(points, west, north, east, south) {
    let result=clipHalfPlane(points,-1,0,-west);
    result=clipHalfPlane(result,1,0,east);
    result=clipHalfPlane(result,0,-1,-north);
    return clipHalfPlane(result,0,1,south);
  }

  // Cut a forbidden convex area into disjoint convex remnants. Streets,
  // buildings and public squares share the same stream and slope mask.
  function subtractPlanes(polygon, planes) {
    const outside=[];let inside=polygon;
    for(const [nx,ny,distance] of planes){
      const piece=clipHalfPlane(inside,-nx,-ny,-distance);
      if(piece.length>=3&&polygonArea(piece)>1e-12)outside.push(piece);
      inside=clipHalfPlane(inside,nx,ny,distance);
      if(inside.length<3)break;
    }
    return outside;
  }

  function clipToLocalLand(polygon, recipe) {
    const site=recipe.localSite;if(!site)return [polygon];
    let pieces=[polygon];const surface=site.surface;
    if(surface){
      const {west,north,east,south}=surface.bounds,columns=surface.columns-1,rows=surface.rows-1;
      const dx=(east-west)/columns,dy=(south-north)/rows;
      const clipped=clipRectangle(polygon,west,north,east,south);
      if(clipped.length<3)return [];
      pieces=[clipped];
      const xs=clipped.map(point=>point.x),ys=clipped.map(point=>point.y);
      const box={west:Math.min(...xs),east:Math.max(...xs),north:Math.min(...ys),south:Math.max(...ys)};
      // Terrain triangles measure water and slopes; they are not private plots.
      // Subtract only their forbidden part. Entirely dry refinement must leave
      // the original convex parcel intact, including its street frontage.
      for(const vertices of global.WorldAtlasCitySite.surfaceTriangles(surface,box)){
          const triangle=vertices.map(p=>{
            const x=(p.column-west)/dx,y=(p.row-north)/dy,i=Math.min(columns-1,Math.floor(x)),j=Math.min(rows-1,Math.floor(y)),u=x-i,v=y-j,k=j*surface.columns+i,z=surface.slopes,
              slope=z[k]*(1-u)*(1-v)+z[k+1]*u*(1-v)+z[k+surface.columns]*(1-u)*v+z[k+surface.columns+1]*u*v;
            return {x:p.column,y:p.row,clearance:p.clearance,depth:-p.depth,slope:.20-slope};
          });
          // Each field has its own units and zero contour. Taking their
          // minimum before interpolation moves a legal slope boundary when a
          // small positive shoreline value truncates its positive endpoints.
          for(const field of ['clearance','depth','slope']){
          if(triangle.every(point=>point[field]>0))continue;
          const wet=[];
          for(let edge=0;edge<3;edge++){const a=triangle[edge],b=triangle[(edge+1)%3],va=a[field],vb=b[field];
            if(va<=0)wet.push(a);if((va>0)!==(vb>0)){const t=va/(va-vb);wet.push({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t});}}
          if(wet.length<3||polygonArea(wet)<=1e-12)continue;
          const planes=wet.map((a,i)=>{const b=wet[(i+1)%wet.length],nx=b.y-a.y,ny=a.x-b.x;return [nx,ny,a.x*nx+a.y*ny];});
          pieces=pieces.flatMap(piece=>{
            let overlap=piece;
            for(const [nx,ny,d] of planes)overlap=clipHalfPlane(overlap,nx,ny,d);
            return overlap.length<3||polygonArea(overlap)<=1e-12?[piece]:subtractPlanes(piece,planes);
          });
          if(!pieces.length)break;
          }
          if(!pieces.length)break;
      }
    }
    for(const channel of site.channels || [])for(let index=1;index<channel.points.length;index++){
      const a=channel.points[index-1],b=channel.points[index],exclusion=localChannelExclusion(a,b,channel,recipe);
      if(!exclusion)continue;const {planes,columnClearance,rowClearance}=exclusion;
      pieces=pieces.flatMap(piece=>{
        if(piece.every(point=>point.x<Math.min(a.column,b.column)-columnClearance)||piece.every(point=>point.x>Math.max(a.column,b.column)+columnClearance)
          ||piece.every(point=>point.y<Math.min(a.row,b.row)-rowClearance)||piece.every(point=>point.y>Math.max(a.row,b.row)+rowClearance))return [piece];
        return subtractPlanes(piece,planes);
      });
    }
    return pieces;
  }

  const channelExclusionCache=new WeakMap();
  function channelExclusionIndex(recipe){
    const site=recipe.localSite;let cached=channelExclusionCache.get(site);
    if(cached&&cached.metric===recipe.urban.gridCellKilometres)return cached;
    const entries=[];
    for(const channel of site.channels||[])for(let index=1;index<channel.points.length;index++){
      const a=channel.points[index-1],b=channel.points[index],exclusion=localChannelExclusion(a,b,channel,recipe);
      if(!exclusion)continue;
      entries.push({planes:exclusion.planes,order:entries.length,bounds:{west:Math.min(a.column,b.column)-exclusion.columnClearance,
        east:Math.max(a.column,b.column)+exclusion.columnClearance,north:Math.min(a.row,b.row)-exclusion.rowClearance,
        south:Math.max(a.row,b.row)+exclusion.rowClearance}});
    }
    const m=recipe.urban.gridCellKilometres,size={column:.06/m.column,row:.06/m.row},origin=recipe.location,bins=new Map(),
      keys=b=>{const out=[];for(let y=Math.floor((b.north-origin.row)/size.row);y<=Math.floor((b.south-origin.row)/size.row);y++)
        for(let x=Math.floor((b.west-origin.column)/size.column);x<=Math.floor((b.east-origin.column)/size.column);x++)out.push(x+','+y);return out;};
    for(const entry of entries)for(const key of keys(entry.bounds)){if(!bins.has(key))bins.set(key,[]);bins.get(key).push(entry);}
    cached={metric:m,query(b){
      const found=new Set();
      for(const key of keys(b))for(const entry of bins.get(key)||[])
        if(entry.bounds.east>=b.west&&entry.bounds.west<=b.east&&entry.bounds.south>=b.north&&entry.bounds.north<=b.south)found.add(entry);
      return Array.from(found).sort((x,y)=>x.order-y.order);
    }};
    channelExclusionCache.set(site,cached);return cached;
  }

  function localChannelExclusion(a,b,channel,recipe){
    const m=recipe.urban.gridCellKilometres,dx=(b.column-a.column)*m.column,dy=(b.row-a.row)*m.row,length=Math.hypot(dx,dy);
    if(length<1e-12)return null;
    const clearance=(Math.max(a.widthMetres||channel.widthMetres||0,b.widthMetres||channel.widthMetres||0)*.5+3)/1000,
      nx=dy/length*m.column,ny=-dx/length*m.row,tx=dx/length*m.column,ty=dy/length*m.row;
    return {columnClearance:clearance/m.column,rowClearance:clearance/m.row,
      planes:[[nx,ny,a.column*nx+a.row*ny+clearance],[-nx,-ny,-a.column*nx-a.row*ny+clearance],
        [-tx,-ty,-a.column*tx-a.row*ty+clearance],[tx,ty,b.column*tx+b.row*ty+clearance]]};
  }

  function nearestPoint(point, a, b) {
    const dx = b.column - a.column, dy = b.row - a.row;
    const t = Math.max(0, Math.min(1, ((point.column - a.column) * dx + (point.row - a.row) * dy) / (dx * dx + dy * dy || 1)));
    return {column: a.column + dx * t, row: a.row + dy * t};
  }

  function appendFortress(geometry, cityPlan) {
    const fort = cityPlan.fortress;
    const group = svg("g", {class: "city-fortress", "data-fortress-era": fort.era,'data-fortress-kind':fort.kind});
    group.appendChild(svg("path", {d: pathData(fort.points, true), fill: "#e9e2cf"}));
    appendWallPaint(group,fort.walls,cityPlan,cityPlan.streetWidths.collector*2.3,'city-fortress-walls');
    group.appendChild(svg("path", {d: fort.towers.map(points => pathData(points, true)).join(" "), fill: cityPlan.character.material.wall.base, stroke: cityPlan.character.material.wall.edge, "stroke-width": cityPlan.streetWidths.local * 0.4}));
    if(fort.kind==='castle')group.appendChild(svg("path", {d: pathData(fort.keep, true), fill: cityPlan.character.roof[0], stroke: cityPlan.character.material.wall.edge, "stroke-width": cityPlan.streetWidths.local}));
    else {
      for(const building of fort.interiors)group.appendChild(svg('path',{d:pathData(building.points,true),fill:cityPlan.character.roof[0],stroke:cityPlan.character.material.wall.edge,
        'stroke-width':.55,'vector-effect':'non-scaling-stroke','data-fort-building':building.kind}));
      group.appendChild(svg('path',{d:fort.interiors.flatMap(b=>roofLines(b.points)).map(p=>pathData(p,false)).join(' '),fill:'none',stroke:'#f4ead6',
        'stroke-width':.6,'vector-effect':'non-scaling-stroke'}));
    }
    geometry.appendChild(group);
  }

  function containsPoint(polygon, point) {
    return polygon.every((a, index) => { const b = polygon[(index + 1) % polygon.length]; return (b.x - a.x) * (point.y - a.y) - (b.y - a.y) * (point.x - a.x) >= -1e-12; });
  }

  function clipStreetToLand(street, recipe) {
    if(recipe.localSite)return street.points.slice(1).flatMap((point,index)=>clipStreetToLocalLand({...street,points:[street.points[index],point]},recipe));
    const result = [];
    for (let index = 1; index < street.points.length; index++) {
      const a = street.points[index - 1], b = street.points[index];
      for (const [row, column] of recipe.terrain.buildable.allowedCells) {
        let minimum = 0, maximum = 1;
        for (const [start, delta, low, high] of [[a.row, b.row - a.row, row, row + 1], [a.column, b.column - a.column, column, column + 1]]) {
          if (Math.abs(delta) < 1e-12) { if (start < low || start > high) maximum = -1; continue; }
          const t1 = (low - start) / delta, t2 = (high - start) / delta;
          minimum = Math.max(minimum, Math.min(t1, t2)); maximum = Math.min(maximum, Math.max(t1, t2));
        }
        if (maximum - minimum > 1e-10) result.push(...clipStreetToLocalLand({...street, points: [minimum, maximum].map(t => ({row: a.row + (b.row - a.row) * t, column: a.column + (b.column - a.column) * t}))},recipe));
      }
    }
    return result;
  }

  function clipStreetToLocalLand(street, recipe) {
    if(!recipe.localSite)return [street];
    const a=street.points[0],b=street.points[1],dx=b.column-a.column,dy=b.row-a.row;
    let intervals=[[0,1]];
    const remove=planes=>{
      let minimum=0,maximum=1;
      for(const [nx,ny,distance] of planes){
        const start=a.column*nx+a.row*ny,delta=dx*nx+dy*ny;
        if(Math.abs(delta)<1e-12){if(start>distance+1e-12)return;continue;}
        const fraction=(distance-start)/delta;
        if(delta>0)maximum=Math.min(maximum,fraction);else minimum=Math.max(minimum,fraction);
      }
      if(maximum-minimum<1e-10)return;
      intervals=intervals.flatMap(([first,last])=>{
        if(maximum<=first||minimum>=last)return [[first,last]];
        const pieces=[];if(minimum-first>1e-10)pieces.push([first,Math.min(last,minimum)]);
        if(last-maximum>1e-10)pieces.push([Math.max(first,maximum),last]);return pieces;
      });
    };
    const surface=recipe.localSite.surface;
    if(surface){
      const cell=Math.min((surface.bounds.east-surface.bounds.west)/(surface.columns-1),(surface.bounds.south-surface.bounds.north)/(surface.rows-1)),
        steps=Math.max(2,Math.ceil(Math.hypot(dx,dy)/cell*5)),valid=[],at=t=>({column:a.column+dx*t,row:a.row+dy*t});
      let previous=surfaceAllows(a,surface,.20),start=0;
      for(let i=1;i<=steps;i++){
        const t=i/steps,allowed=surfaceAllows(at(t),surface,.20);
        if(allowed!==previous){let low=(i-1)/steps,high=t;for(let j=0;j<18;j++){
          const middle=(low+high)/2;if(surfaceAllows(at(middle),surface,.20)===previous)low=middle;else high=middle;}
          const edge=(low+high)/2;if(previous)valid.push([start,edge]);else start=edge;
        }previous=allowed;
      }if(previous)valid.push([start,1]);
      intervals=intervals.flatMap(([a,b])=>valid.map(([c,d])=>[Math.max(a,c),Math.min(b,d)]).filter(([a,b])=>b-a>1e-10));
    }
    const m=recipe.urban.gridCellKilometres,
      scalar=gridCellKilometres(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns),
      widths=streetWidthsInGrid(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns),
      kind=street.kind==='road'?(street.local?'collector':'arterial'):street.kind,
      halfWidth=(widths[kind]||widths.local)*scalar*.5;
    // Only channel pieces whose reserved rectangle can reach this segment
    // are tested; the spatial index returns a superset, so results are exact.
    const exclusions=channelExclusionIndex(recipe),hc=halfWidth/m.column,hr=halfWidth/m.row;
    for(const exclusion of exclusions.query({west:Math.min(a.column,b.column)-hc,east:Math.max(a.column,b.column)+hc,
      north:Math.min(a.row,b.row)-hr,south:Math.max(a.row,b.row)+hr})){
      // Reserve the complete round-ended carriageway in physical kilometres.
      remove(exclusion.planes.map(([nx,ny,d])=>[nx,ny,d+halfWidth]));
    }
    for(const bridge of recipe.localSite.bridges||[]){
      if(bridge.kind!=='road')continue;
      const [first,last]=bridge.points,bx=(last.column-first.column)*m.column,by=(last.row-first.row)*m.row,
        length=Math.hypot(bx,by),side=bridge.widthMetres/2000-halfWidth;
      if(length<=halfWidth*2||side< -1e-12)continue;
      const ux=bx/length,uy=by/length,px=(a.column-first.column)*m.column,py=(a.row-first.row)*m.row,
        vx=dx*m.column,vy=dy*m.row;
      let low=0,high=1;
      // A nearby bridge is not a crossing: even the road's round caps must
      // fit inside its finite deck, including on a diagonal approach.
      for(const [start,delta,minimum,maximum]of [
        [px*ux+py*uy,vx*ux+vy*uy,halfWidth,length-halfWidth],
        [-px*uy+py*ux,-vx*uy+vy*ux,-Math.max(0,side),Math.max(0,side)]]){
        if(Math.abs(delta)<1e-14){if(start<minimum-1e-12||start>maximum+1e-12){high=-1;break;}continue;}
        const t1=(minimum-start)/delta,t2=(maximum-start)/delta;
        low=Math.max(low,Math.min(t1,t2));high=Math.min(high,Math.max(t1,t2));
      }
      if(high>low)intervals.push([low,high]);
    }
    intervals.sort((a,b)=>a[0]-b[0]);
    const connected=[];for(const interval of intervals){const last=connected.at(-1);
      if(last&&interval[0]<=last[1]+1e-9)last[1]=Math.max(last[1],interval[1]);else connected.push(interval);}
    return connected.map(([minimum,maximum])=>({...street,points:[minimum,maximum].map(t=>({row:a.row+dy*t,column:a.column+dx*t}))}));
  }

  function routeNear(point, points, clearance) {
    return points.slice(1).some((end, index) => { const near = nearestPoint(point, points[index], end); return Math.hypot(point.row - near.row, point.column - near.column) < clearance; });
  }

  function polygonNearRoute(polygon, points, clearance) {
    const bounds=polygonBounds(polygon);
    for (let index = 1; index < points.length; index++) {
      const start = points[index - 1], end = points[index];
      if(bounds.south<Math.min(start.row,end.row)-clearance||bounds.north>Math.max(start.row,end.row)+clearance
        ||bounds.east<Math.min(start.column,end.column)-clearance||bounds.west>Math.max(start.column,end.column)+clearance)continue;
      const dx = end.column - start.column, dy = end.row - start.row;
      const length = Math.hypot(dx, dy);
      if (!length) continue;
      // Intersect the building with the finite expanded transport corridor.
      let clipped = polygon.map(point => ({x: point.column-start.column, y: point.row-start.row}));
      for (const [nx, ny, distance] of [
        [dy / length, -dx / length, clearance],
        [-dy / length, dx / length, clearance],
        [-dx / length, -dy / length, clearance],
        [dx / length, dy / length, length + clearance],
      ]) clipped = clipHalfPlane(clipped, nx, ny, distance);
      if (polygonArea(clipped)>1e-14) return true;
    }
    return false;
  }

  const waterGroundCache=new WeakMap();
  function polygonNearWater(points,recipe){
    const site=recipe.localSite;if(!site)return false;
    if(site.surface&&global.WorldAtlasCitySite.waterOverlaps(site.surface,points))return true;
    if(!site.channels?.length)return false;
    let water=waterGroundCache.get(site);
    if(!water){
      const fallback=gridCellKilometres(recipe,recipe.urban.radiusRows,recipe.urban.radiusColumns),
        m=recipe.urban.gridCellKilometres||{},row=m.row||fallback,column=m.column||fallback,
        origin=recipe.location,toMetres=p=>({column:(p.column-origin.column)*column*1000,row:(p.row-origin.row)*row*1000});
      const bins=new Map(),size=60;
      for(const channel of site.channels){
        const pts=channel.points.map(toMetres),clearance=Math.max(channel.widthMetres||2,...channel.points.map(p=>p.widthMetres||0))*.5+3;
        for(let i=1;i<pts.length;i++){
          const a=pts[i-1],b=pts[i],piece={points:[a,b],clearance,west:Math.min(a.column,b.column)-clearance,east:Math.max(a.column,b.column)+clearance,
            north:Math.min(a.row,b.row)-clearance,south:Math.max(a.row,b.row)+clearance};
          for(let y=Math.floor(piece.north/size);y<=Math.floor(piece.south/size);y++)for(let x=Math.floor(piece.west/size);x<=Math.floor(piece.east/size);x++){
            const key=x+','+y;if(!bins.has(key))bins.set(key,[]);bins.get(key).push(piece);}
        }
      }
      water={toMetres,bins,size};
      waterGroundCache.set(site,water);
    }
    // A native row and column can represent different physical distances.
    // Test the whole footprint in metres, using the same axes as the river banks.
    const footprint=points.map(water.toMetres),box=polygonBounds(footprint),seen=new Set();
    for(let y=Math.floor(box.north/water.size);y<=Math.floor(box.south/water.size);y++)for(let x=Math.floor(box.west/water.size);x<=Math.floor(box.east/water.size);x++)
      for(const piece of water.bins.get(x+','+y)||[]){
        if(seen.has(piece))continue;seen.add(piece);
        if(piece.east<box.west||piece.west>box.east||piece.south<box.north||piece.north>box.south)continue;
        if(polygonNearRoute(footprint,piece.points,piece.clearance))return true;
      }
    return false;
  }

  const allowedCellCache=new WeakMap();
  function segmentOnLand(start, end, recipe) {
    const buildable=recipe.terrain.buildable;let allowed=allowedCellCache.get(buildable);
    if(!allowed){allowed=new Set(buildable.allowedCells.map(cell => cell.join(",")));allowedCellCache.set(buildable,allowed);}
    const surface=recipe.localSite?.surface;
    const cellSize=surface?Math.min((surface.bounds.east-surface.bounds.west)/(surface.columns-1),
      (surface.bounds.south-surface.bounds.north)/(surface.rows-1)):1;
    const steps = Math.max(2, Math.ceil(Math.hypot(end.row - start.row, end.column - start.column) / cellSize * 2));
    for (let index = 0; index <= steps; index++) {
      const t = index / steps;
      const row=start.row+(end.row-start.row)*t,column=start.column+(end.column-start.column)*t;
      if (!surface&&!allowed.has(Math.floor(row) + "," + Math.floor(column))) return false;
      if(surface&&!surfaceAllows({row,column},surface,.20))return false;
    }
    // Give the access segment a nonzero footprint so a lane cannot jump a
    // water corridor simply because both sampled endpoints are on dry ground.
    const dx=end.column-start.column,dy=end.row-start.row,length=Math.hypot(dx,dy);
    if(!length)return !polygonNearWater(rectangle(start,1e-8,1e-8),recipe);
    const x=-dy/length*1e-8,y=dx/length*1e-8;
    return !polygonNearWater([{row:start.row+y,column:start.column+x},{row:end.row+y,column:end.column+x},
      {row:end.row-y,column:end.column-x},{row:start.row-y,column:start.column-x}],recipe);
  }

  function surfaceAllows(p,f,maxSlope){
    const b=f.bounds;if(p.column<b.west||p.column>b.east||p.row<b.north||p.row>b.south)return false;
    const x=(p.column-b.west)/(b.east-b.west)*(f.columns-1),y=(p.row-b.north)/(b.south-b.north)*(f.rows-1),
      i=Math.min(f.columns-2,Math.floor(x)),j=Math.min(f.rows-2,Math.floor(y)),u=x-i,v=y-j,k=j*f.columns+i;
    const value=a=>(a[k]*(1-u)+a[k+1]*u)*(1-v)+(a[k+f.columns]*(1-u)+a[k+f.columns+1]*u)*v;
    return global.WorldAtlasCitySite.isDry(f,p)&&value(f.slopes)<maxSlope;
  }

  function streetWidthsInGrid(recipe, radiusRows, radiusColumns) {
    const declared = recipe.urban && recipe.urban.streetWidthsMetres || {};
    const fallback = { arterial: 12, collector: 5.5, local: 2.8 };
    const small=global.WorldAtlasCityCharacter.profile(recipe).small;
    const limits=small?{arterial:4.5,collector:3,local:1.8}:fallback;
    const scale = gridCellKilometres(recipe, radiusRows, radiusColumns);
    const toGrid = (kind) => (small?Math.min(limits[kind],finiteOr(declared[kind],limits[kind])):finiteOr(declared[kind],fallback[kind])) / (scale * 1000);
    return {
      arterial: toGrid('arterial'),
      collector: toGrid('collector'),
      local: toGrid('local'),
    };
  }

  function gridCellKilometres(recipe, radiusRows, radiusColumns) {
    const metrics = recipe.urban && recipe.urban.gridCellKilometres || {};
    const row = finiteOr(metrics.row, NaN);
    const column = finiteOr(metrics.column, NaN);
    if (row > 0 && column > 0) return (row + column) * 0.5;
    const radiusKm = finiteOr(recipe.urban && recipe.urban.radiusKm, 1);
    const radius = (Math.max(0.00001, radiusRows) + Math.max(0.00001, radiusColumns)) * 0.5;
    return Math.max(0.001, radiusKm / radius);
  }

  function pathData(points, closed) {
    if (!points.length) return "";
    const segments = points.map((point, index) => (index ? "L " : "M ") + Number(point.column.toFixed(7)) + " " + Number(point.row.toFixed(7)));
    return segments.join(" ") + (closed ? " Z" : "");
  }

  function svg(tag, attributes) {
    const node = document.createElementNS(SVG_NS, tag);
    Object.keys(attributes).forEach((key) => {
      if (attributes[key] !== undefined && attributes[key] !== null) {
        node.setAttribute(key, String(attributes[key]));
      }
    });
    return node;
  }

  function validateRecipe(recipe) {
    if (!recipe || typeof recipe !== "object" || typeof recipe.id !== "string" || !recipe.id || !recipe.location) {
      throw new TypeError("a city recipe requires id and location");
    }
    if (!Number.isFinite(recipe.location.row) || !Number.isFinite(recipe.location.column)) {
      throw new TypeError("city recipe location must use finite world-grid coordinates");
    }
    if (!VALID_ERAS.has(recipe.era)) {
      throw new TypeError("city recipe requires a strict technology era");
    }
    const buildable = recipe.terrain && recipe.terrain.buildable;
    if (!buildable || buildable.coordinateSpace !== "world-grid-cells" || !Array.isArray(buildable.allowedCells) || !buildable.allowedCells.length) {
      throw new TypeError("city recipe requires non-empty native-grid buildable cells");
    }
    buildable.allowedCells.forEach((cell) => {
      if (!Array.isArray(cell) || cell.length !== 2 || !Number.isInteger(cell[0]) || !Number.isInteger(cell[1])) {
        throw new TypeError("city buildable cells must be [row, column] integer pairs");
      }
    });
  }

  function normalizeBuildable(buildable) {
    return {
      allowedCells: buildable.allowedCells.map((cell) => [cell[0], cell[1]]),
      bounds: buildable.bounds || null,
      precision: buildable.precision || "native-grid-cell",
    };
  }

  function clipIdentifier(recipe, prefix) {
    const safe = recipe.id.replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 72) || "city";
    const safePrefix = String(prefix).replace(/[^A-Za-z0-9_.-]/g, "-").slice(0, 72) || "city-detail";
    return safePrefix + "-" + safe + "-" + unsigned(recipe.seed).toString(36);
  }

  function normalizeGrid(grid) {
    if (!grid || typeof grid !== "object") return null;
    const width = finiteOr(grid.width, 0);
    const height = finiteOr(grid.height, 0);
    return width > 0 && height > 0 ? { width, height } : null;
  }

  function finiteOr(value, fallback) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : fallback;
  }

  function unsigned(value) {
    return (Number(value) >>> 0);
  }

  function normalizeAngle(value) {
    const numeric = finiteOr(value, 0);
    return ((numeric % 360) + 360) % 360;
  }

  function random(seed, channel) {
    let value = (unsigned(seed) ^ Math.imul(unsigned(channel) + 0x9e3779b9, 0x85ebca6b)) >>> 0;
    value ^= value >>> 16;
    value = Math.imul(value, 0x7feb352d) >>> 0;
    value ^= value >>> 15;
    value = Math.imul(value, 0x846ca68b) >>> 0;
    value ^= value >>> 16;
    return (value >>> 0) / 4294967296;
  }

  const api = Object.freeze({ plan, render, streetNetwork, streetSegmentGrade });
  global.WorldAtlasCities = api;
})(typeof window !== "undefined" ? window : globalThis);
