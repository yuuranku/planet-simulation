(() => {
  // .work/city-portable-20261026/source/src/world_atlas/data/city-naming.json
  var city_naming_default = {
    courtyard: {
      plan: "axial",
      streets: [
        "\u69D0\u836B",
        "\u4E66\u9662",
        "\u6587\u5E99",
        "\u949F\u697C",
        "\u9F13\u697C",
        "\u6F15\u8FD0",
        "\u4E1C\u5E02",
        "\u897F\u5E02",
        "\u7EF8\u7F0E",
        "\u74F7\u7A91",
        "\u836F\u94FA",
        "\u5357\u4ED3",
        "\u67F3\u6865",
        "\u76D0\u884C",
        "\u4F1A\u9986",
        "\u724C\u697C",
        "\u7EC7\u574A",
        "\u9752\u77F3",
        "\u7AF9\u56ED",
        "\u6B66\u5E99"
      ],
      hall: "\u5E9C\u7F72",
      market: "\u5E02\u96C6",
      temple: "\u5E99\u9662"
    },
    "walled-compound": {
      plan: "axial",
      streets: [
        "\u5FA1\u9053",
        "\u627F\u5929",
        "\u793C\u574A",
        "\u53F8\u4ED3",
        "\u5B66\u5BAB",
        "\u6B66\u5E93",
        "\u592A\u5E73",
        "\u9752\u9F99",
        "\u6731\u96C0",
        "\u767D\u864E",
        "\u7384\u6B66",
        "\u6C38\u5B89",
        "\u4E1C\u4ED3",
        "\u6C34\u95E8",
        "\u7EC7\u9526",
        "\u77F3\u574A",
        "\u9A7F\u9986",
        "\u949F\u9F13",
        "\u901A\u8FDC",
        "\u66F2\u9662"
      ],
      hall: "\u5B98\u7F72",
      market: "\u4E1C\u5E02",
      temple: "\u7960\u5E99"
    },
    arcaded: {
      plan: "orthogonal",
      streets: [
        "\u67F1\u5ECA",
        "\u8BAE\u4F1A",
        "\u7ADE\u6280",
        "\u9676\u5DE5",
        "\u6A44\u6984",
        "\u6D74\u573A",
        "\u5267\u9662",
        "\u5B66\u56ED",
        "\u94DC\u5320",
        "\u51EF\u65CB",
        "\u516C\u4ED3",
        "\u795E\u6BBF",
        "\u6CC9\u6C34",
        "\u8461\u8404",
        "\u5546\u9986",
        "\u77F3\u96D5",
        "\u8C37\u7269",
        "\u67D3\u574A",
        "\u957F\u5ECA",
        "\u8239\u575E"
      ],
      hall: "\u8BAE\u653F\u5385",
      market: "\u5E02\u96C6",
      temple: "\u795E\u6BBF"
    },
    "timber-frame": {
      plan: "organic",
      streets: [
        "\u78E8\u574A",
        "\u6728\u5320",
        "\u6A61\u6811",
        "\u94C1\u5320",
        "\u7F8A\u6BDB",
        "\u9EA6\u82BD",
        "\u917F\u9152",
        "\u76AE\u5320",
        "\u9762\u5305",
        "\u949F\u5854",
        "\u4FEE\u9662",
        "\u9A6C\u53A9",
        "\u65E7\u96C6",
        "\u730E\u4EBA",
        "\u677E\u6797",
        "\u6E21\u53E3",
        "\u5317\u4ED3",
        "\u78E8\u77F3",
        "\u725B\u5E02",
        "\u5C0F\u6559\u5802"
      ],
      hall: "\u5E02\u653F\u5385",
      market: "\u96C6\u5E02",
      temple: "\u4FEE\u9662"
    },
    "stone-masonry": {
      plan: "organic",
      streets: [
        "\u77F3\u6865",
        "\u77F3\u5320",
        "\u94F6\u5320",
        "\u5546\u4F1A",
        "\u6559\u5802",
        "\u949F\u5854",
        "\u65E7\u6E2F",
        "\u57CE\u5821",
        "\u8461\u8404",
        "\u6CC9\u4E95",
        "\u8BAE\u4F1A",
        "\u82B1\u56ED",
        "\u67D3\u574A",
        "\u8C37\u5E02",
        "\u70DB\u574A",
        "\u9AD8\u53F0",
        "\u76D0\u4ED3",
        "\u780C\u77F3",
        "\u671D\u5723",
        "\u4FEE\u9053\u9662"
      ],
      hall: "\u5E02\u653F\u5385",
      market: "\u5E02\u96C6",
      temple: "\u5723\u5802"
    },
    terraced: {
      plan: "contour",
      streets: [
        "\u4E0A\u53F0",
        "\u4E0B\u53F0",
        "\u77F3\u9636",
        "\u89C2\u666F",
        "\u5C71\u6CC9",
        "\u5D16\u8FB9",
        "\u5761\u811A",
        "\u68AF\u7530",
        "\u6A35\u592B",
        "\u9AD8\u4ED3",
        "\u5C71\u95E8",
        "\u77AD\u671B",
        "\u77F3\u5F84",
        "\u8336\u56ED",
        "\u5CAD\u810A",
        "\u677E\u98CE",
        "\u671B\u6D77",
        "\u6CC9\u6865",
        "\u91C7\u77F3",
        "\u4E91\u53F0"
      ],
      hall: "\u8BAE\u4E8B\u5385",
      market: "\u5C71\u96C6",
      temple: "\u5C71\u5BFA"
    },
    "canal-side": {
      plan: "waterfront",
      streets: [
        "\u8239\u575E",
        "\u9C7C\u5E02",
        "\u5E06\u5320",
        "\u7F06\u7D22",
        "\u6C34\u95E8",
        "\u76D0\u4ED3",
        "\u6CCA\u8239",
        "\u6D77\u5173",
        "\u6845\u6746",
        "\u6E14\u7F51",
        "\u6EE8\u6CB3",
        "\u77F3\u5824",
        "\u6E21\u6865",
        "\u6CB3\u57E0",
        "\u65E7\u6E2F",
        "\u5357\u7801\u5934",
        "\u5E06\u5E03",
        "\u9020\u8239",
        "\u5546\u9986",
        "\u706F\u5854"
      ],
      hall: "\u5546\u8BAE\u5385",
      market: "\u9C7C\u5E02",
      temple: "\u6C34\u795E\u5E99"
    },
    "vernacular-mixed": {
      plan: "organic",
      streets: [
        "\u6986\u6811",
        "\u5320\u4EBA",
        "\u957F\u96C6",
        "\u5357\u4ED3",
        "\u65E7\u4E95",
        "\u67F3\u6865",
        "\u7EC7\u5DE5",
        "\u9676\u7A91",
        "\u94C1\u574A",
        "\u836F\u8349",
        "\u5BA2\u6808",
        "\u7CAE\u5E02",
        "\u9752\u77F3",
        "\u6CC9\u6C34",
        "\u4E1C\u56ED",
        "\u9A7F\u9986",
        "\u6728\u574A",
        "\u4E66\u820D",
        "\u76D0\u94FA",
        "\u65B0\u6865"
      ],
      hall: "\u8BAE\u4E8B\u5385",
      market: "\u5E02\u96C6",
      temple: "\u795E\u5E99"
    },
    nomadic: {
      plan: "camp",
      streets: [
        "\u7267\u573A",
        "\u9A7C\u94C3",
        "\u4E95\u6CC9",
        "\u96C6\u4F1A",
        "\u8349\u573A",
        "\u9A6C\u5E02",
        "\u7F8A\u5E02",
        "\u5546\u65C5",
        "\u5E10\u5EAD",
        "\u9A7F\u7AD9"
      ],
      hall: "\u8BAE\u4E8B\u5E10",
      market: "\u9A6C\u5E02",
      temple: "\u796D\u7940\u573A"
    }
  };

  // .work/city-portable-20261026/source/src/world_atlas/core/web/city-character-entry.js
  (() => {
    "use strict";
    const mapPalette = Object.freeze({
      ground: "#ebe2c8",
      parcel: "#ddd6b5",
      court: "#e4d9bd",
      road: "#efe4c9",
      roadEdge: "#a08860",
      water: "#a3c0c0",
      waterEdge: "#4f7276",
      riverbank: "#cfcfaa",
      woodland: "#c4cd9c",
      trees: Object.freeze(["#93a671", "#a1b07c", "#86996a"]),
      treeShadow: "#4b5236",
      treeHighlight: "#d6dcb2",
      text: "#3e3124",
      fields: Object.freeze(["#e0cd8b", "#e6d9a1", "#d4d293", "#c9b183"]),
      meadow: "#cfd8a8",
      orchard: "#c7d39c",
      contour: "#a88f66",
      rock: "#b4a98f"
    });
    const styles = {
      courtyard: { court: true, shrink: 0.12, temple: "cloister" },
      arcaded: { court: true, shrink: 0.1, temple: "colonnade" },
      "walled-compound": { court: true, shrink: 0.15, temple: "cloister" },
      "timber-frame": { court: false, shrink: 0.24, temple: "longhouse" },
      "stone-masonry": { court: false, shrink: 0.12, temple: "colonnade" },
      terraced: { court: false, shrink: 0.06, temple: "longhouse" },
      "canal-side": { court: false, shrink: 0.08, temple: "longhouse" },
      "vernacular-mixed": { court: false, shrink: 0.17, temple: "cloister" },
      nomadic: { roof: ["#e4d7b7", "#d2c39e", "#c6b898"], court: false, shrink: 0.48, temple: "pavilion" }
    };
    const materials = {
      tile: { roof: ["#b0684b", "#bd7858", "#a45e45", "#c68a68", "#b3735a"], palace: ["#a85f44", "#b9785a", "#94553e"] },
      slate: { roof: ["#7f8d8e", "#a9654b", "#8a9695", "#b5765a", "#9d5f47"], palace: ["#76878a", "#8b9894", "#68797d"] },
      timber: { roof: ["#b39462", "#c2a46f", "#a5885a", "#a9654c", "#bd9b66"], palace: ["#a98b5c", "#b9996a", "#93794f"] },
      lime: { roof: ["#f2eadb", "#ebe1cb", "#f6f0e2", "#e4d8bf", "#efe6d3"], palace: ["#c3a873", "#dec48c", "#ae9467"] },
      brick: { roof: ["#ac8c7c", "#bd9a85", "#9d7e73", "#c7ad95", "#a48d7e"], palace: ["#aa826a", "#bf9d7d", "#93735e"] },
      metal: { roof: ["#71878b", "#8c9c9c", "#61767d", "#a0aaa6", "#788886"], palace: ["#567a78", "#8da29c", "#496b70"] },
      felt: { roof: ["#e4d7b7", "#d2c39e", "#c6b898", "#ede2c7", "#c3b18f"], palace: ["#e9d9b4", "#d2c39e", "#bcaa83"] },
      concrete: { roof: ["#b2b4a9", "#c6c6ba", "#9fa79e", "#d0cec1", "#aeb4ad"], palace: ["#a5ada7", "#c8c7b6", "#8e9a94"] }
    };
    const morphology = {
      courtyard: { blockAspect: 1.35, householdsPerBlock: 18, streetVariation: 0.18, frontageMetres: [13, 20], depthMetres: [17, 25], gapMetres: [1.2, 2.8] },
      arcaded: { blockAspect: 1.15, householdsPerBlock: 16, streetVariation: 0.3, frontageMetres: [12, 18], depthMetres: [15, 23], gapMetres: [0.6, 1.5] },
      "walled-compound": { blockAspect: 1.65, householdsPerBlock: 22, streetVariation: 0.12, frontageMetres: [16, 24], depthMetres: [20, 30], gapMetres: [2, 4] },
      "timber-frame": { blockAspect: 1.85, householdsPerBlock: 18, streetVariation: 0.72, frontageMetres: [6.5, 10], depthMetres: [12, 20], gapMetres: [1, 2.8] },
      "stone-masonry": { blockAspect: 1.25, householdsPerBlock: 15, streetVariation: 0.48, frontageMetres: [7, 11], depthMetres: [11, 17], gapMetres: [0.5, 1.8] },
      terraced: { blockAspect: 2.5, householdsPerBlock: 16, streetVariation: 0.28, frontageMetres: [6, 9], depthMetres: [10, 16], gapMetres: [0.4, 0.9] },
      "canal-side": { blockAspect: 2.65, householdsPerBlock: 22, streetVariation: 0.2, frontageMetres: [5.5, 8.5], depthMetres: [15, 23], gapMetres: [0.5, 1] },
      "vernacular-mixed": { blockAspect: 1.45, householdsPerBlock: 16, streetVariation: 0.58, frontageMetres: [7, 12], depthMetres: [11, 19], gapMetres: [1, 2.5] },
      nomadic: { blockAspect: 1, householdsPerBlock: 10, streetVariation: 0.8, frontageMetres: [5, 9], depthMetres: [5, 9], gapMetres: [4, 8] }
    };
    const layouts = {
      planned_ward_capital: { plan: "axial", wards: true, ceremonial: true },
      ceremonial_axis_capital: { plan: "axial", ceremonial: true },
      river_port_market_city: { plan: "orthogonal", waterfront: true },
      organic_sacred_market_city: { plan: "organic", sacredMarket: true },
      multi_phase_imperial_core: { plan: "organic", multiPhase: true },
      fortified_pass_town: { plan: "orthogonal", garrison: true },
      frontier_defence_zone: { plan: "orthogonal", garrison: true },
      rural_market_hinterland: { plan: "organic", rural: true },
      seasonal_pastoral_range: { plan: "organic", pastoral: true },
      mobile_court: { plan: "organic", pastoral: true }
    };
    const layoutLabels = {
      planned_ward_capital: "\u89C4\u5212\u574A\u533A\u90FD\u57CE",
      ceremonial_axis_capital: "\u793C\u4EEA\u8F74\u7EBF\u90FD\u57CE",
      river_port_market_city: "\u6CB3\u6E2F\u5E02\u96C6\u57CE\u5E02",
      organic_sacred_market_city: "\u6709\u673A\u5723\u5730\u96C6\u5E02\u57CE",
      multi_phase_imperial_core: "\u591A\u671F\u5E1D\u56FD\u590D\u5408\u57CE",
      fortified_pass_town: "\u8BBE\u9632\u5173\u9698\u57CE\u9547",
      frontier_defence_zone: "\u8FB9\u5883\u9632\u5FA1\u533A",
      rural_market_hinterland: "\u4E61\u6751\u96C6\u5E02\u8179\u5730",
      seasonal_pastoral_range: "\u5B63\u8282\u7267\u4E1A\u8303\u56F4",
      mobile_court: "\u79FB\u52A8\u738B\u5EAD"
    };
    const monumentTraditions = /* @__PURE__ */ new Set(["vernacular", "east-asian", "south-asian", "west-asian", "classical", "european", "mesopotamian"]);
    const wallMaterials = {
      stone: { base: "#c7b996", edge: "#4f4334", highlight: "#e6dcc0", joint: "#8f8062", spacingMetres: 2.4, jointMetres: 0.16 },
      brick: { base: "#b38366", edge: "#785442", highlight: "#dec0a0", joint: "#7e5b49", spacingMetres: 1.1, jointMetres: 0.12 },
      earth: { base: "#b79b6b", edge: "#846f4b", highlight: "#d9c79d", joint: "#a68b5d", spacingMetres: 4.2, jointMetres: 0.9 },
      timber: { base: "#9a7c58", edge: "#5f503d", highlight: "#c8ae7f", joint: "#574935", spacingMetres: 1.1, jointMetres: 0.22 },
      plaster: { base: "#d7ccaf", edge: "#9b947b", highlight: "#f3ebd5", joint: "#b9af93", spacingMetres: 5.8, jointMetres: 0.12 },
      felt: { base: "#d6c7a7", edge: "#94836a", highlight: "#eee3c9", joint: "#bbaa8c", spacingMetres: 3.4, jointMetres: 0.1 }
    };
    function materialProfile(recipe, mobile) {
      const selected = recipe.culture.cityLayout.materials;
      if (!selected || !Object.hasOwn(wallMaterials, selected.wall) || selected.wall === "felt")
        throw new TypeError("Unknown city wall material: " + selected?.wall);
      if (!Object.hasOwn(materials, selected.roof)) throw new TypeError("Unknown city roof material: " + selected.roof);
      const name = mobile ? "felt" : selected.roof, wallName = mobile ? "felt" : selected.wall;
      return { name, wallName, wall: wallMaterials[wallName], ...materials[name] };
    }
    function palaceDesign(recipe, style) {
      const id = (recipe.seed ^ (recipe.culture?.civilizationId || 0) * 2654435761) >>> 0;
      const rugged = ["ridge", "hillside", "coastal-slope", "valley"].includes(recipe.localSite?.form.kind);
      const monument = recipe.culture.cityLayout.monumentTradition, templeFamily = monument === "east-asian" ? "east-asian-courts" : monument === "south-asian" ? recipe.era === "ancient" ? "south-asian-early" : "south-asian-temple" : monument === "west-asian" ? recipe.era === "ancient" ? "mesopotamian-terrace" : "west-asian-court" : monument === "mesopotamian" && recipe.era === "ancient" ? "mesopotamian-terrace" : monument === "european" ? recipe.era === "ancient" ? "classical-colonnade" : "european-church" : monument === "classical" ? "classical-colonnade" : "vernacular", flatRoofs = ["west-asian", "mesopotamian"].includes(monument), family = rugged ? "terraced-court" : monument === "east-asian" ? "axial-courts" : monument === "west-asian" ? "peristyle" : ["courtyard", "walled-compound"].includes(style) ? "axial-courts" : style === "arcaded" ? "peristyle" : style === "timber-frame" ? "hall-and-bailey" : style === "canal-side" ? "merchant-palazzo" : style === "stone-masonry" ? "castle-palace" : "garden-pavilions";
      return { family, templeFamily, flatRoofs, variant: id % 3, aspect: family === "terraced-court" ? [1.25, 0.62] : family === "axial-courts" ? [0.93, 1.28] : family === "merchant-palazzo" ? [1.3, 0.76] : [1.28, 1], fortified: ["castle-palace", "hall-and-bailey"].includes(family) };
    }
    function profile(recipe) {
      const culture = recipe.culture || {}, population = recipe.population?.estimate || 0, type = recipe.siteType;
      const layout = culture.cityLayout;
      if (!layout || !layouts[layout.prototype]) throw new TypeError("Unknown city layout prototype: " + layout?.prototype);
      if (!styles[layout.architecture] || layout.architecture === "nomadic") throw new TypeError("Unknown city construction family: " + layout.architecture);
      if (!monumentTraditions.has(layout.monumentTradition)) throw new TypeError("Unknown city monument tradition: " + layout.monumentTradition);
      const mechanism = layouts[layout.prototype];
      const mobile = ["nomadic-camp", "khan-court"].includes(type) || culture.mobility === "nomadic" || culture.government === "nomadic-confederacy" && recipe.tier === "site" && !["port", "island-port", "lake-port", "river-city", "fortress", "pass"].includes(type);
      const military = ["fortress", "pass"].includes(type), maritime = ["port", "island-port", "lake-port"].includes(type) || recipe.harbor;
      const small = mobile || population < 5e3;
      const village = !mobile && !military && !maritime && (type === "village" || small);
      const style = mobile ? "nomadic" : layout.architecture;
      const kind = mobile ? "nomadic" : village ? "village" : type === "pass" ? "border-pass" : type === "fortress" ? "fortress" : ["port", "island-port"].includes(type) ? "seaport" : type === "lake-port" ? "lake-port" : recipe.harbor?.kind === "river" ? "river-port" : type === "river-city" ? "river-town" : type === "oasis" ? "oasis" : ["rolling", "steep", "escarpment"].includes(recipe.terrain?.slopeClass) ? "hill-town" : "market-town";
      const label = {
        nomadic: "\u6E38\u7267\u8425\u5730",
        village: "\u6751\u843D",
        "border-pass": "\u8FB9\u5173",
        fortress: "\u8981\u585E",
        seaport: "\u6D77\u6E2F\u57CE\u5E02",
        "lake-port": "\u6E56\u6E2F\u57CE\u5E02",
        "river-port": "\u5185\u6CB3\u6E2F\u53E3\u57CE\u5E02",
        "river-town": "\u6CB3\u5CB8\u57CE\u5E02",
        oasis: "\u7EFF\u6D32\u57CE\u5E02",
        "hill-town": "\u5C71\u5730\u57CE\u5E02",
        "market-town": "\u5546\u8D38\u57CE\u5E02"
      }[kind];
      const defensive = ["ancient", "medieval", "early-modern", "preindustrial"].includes(recipe.era) && (!small || military) || recipe.era === "industrial" && !mobile && (military || (recipe.landmarks || []).includes("citadel"));
      const capital = culture.isCapital || (recipe.urban?.coreZones || []).some((c) => c.role === "government-core");
      const layers = defensive ? 1 : 0;
      const barbicans = defensive && !small && recipe.era !== "ancient" && recipe.era !== "industrial" && (capital || population > 8500 || ["fortress", "border-pass"].includes(kind));
      const tradition = city_naming_default[layout.architecture];
      const namingTradition = recipe.naming?.culture === "han" ? city_naming_default.courtyard : tradition;
      const plan = small ? mobile ? "camp" : "village" : mechanism.plan;
      const form = recipe.localSite?.form, explicit = recipe.citySettings?.streetPattern, openGround = form ? form.kind === "plain" : !["rolling", "steep", "escarpment"].includes(recipe.terrain?.slopeClass), regular = openGround && (explicit === "grid" || !small && explicit !== "organic" && ["axial", "orthogonal"].includes(plan)), waterfront = !!recipe.harbor || ["port", "island-port", "lake-port", "river-city"].includes(type) || ["seaport", "island-harbor", "lakefront", "riverfront"].includes(recipe.water?.kind) || ["bank-parallel", "shore-parallel", "quay-linear", "contour-following"].includes(recipe.morphology?.streetPattern), rectangular = regular && (explicit === "grid" || plan === "axial" && (capital || population >= 15e3) && (!waterfront || recipe.harbor?.kind === "river" || ["river-city", "lake-port"].includes(type)));
      const mechanisms = {
        ...mechanism,
        wards: mechanism.wards && regular && !small,
        ceremonial: mechanism.ceremonial && regular && !small,
        waterfront: mechanism.waterfront && waterfront && !small,
        multiPhase: mechanism.multiPhase && !small
      };
      const fixedMaterial = materialProfile(recipe, false), portableMaterial = materialProfile(recipe, true), material = mobile ? portableMaterial : fixedMaterial;
      const compact = small || !recipe.citySettings && ["ancient", "medieval", "early-modern", "preindustrial"].includes(recipe.era);
      const household = small && !mobile && recipe.citySettings?.streetPattern !== "grid", elongated = ["hill-town", "border-pass", "fortress", "river-town", "river-port", "seaport", "lake-port"].includes(kind), along = form?.alongScale || (elongated ? 1.02 : 0.95), across = form?.crossScale || (["steep", "escarpment"].includes(recipe.terrain?.slopeClass) ? 0.3 : elongated ? 0.73 : 0.92), inhabitedAreaFactor = Math.PI * (household ? along * across : 1);
      const burgageTown = !small && ["medieval", "early-modern", "preindustrial"].includes(recipe.era) && ["timber-frame", "stone-masonry", "terraced", "canal-side", "vernacular-mixed"].includes(layout.architecture);
      const inhabitedDensity = household ? 5e3 : burgageTown ? 17e3 : 1e4;
      const settlementRadiusKm = recipe.localSite?.schema === "city-local-site-v1" ? recipe.urban.radiusKm : compact ? Math.min(recipe.urban?.radiusKm || 1, Math.max(military ? 0.11 : 0.06, Math.sqrt(population / inhabitedDensity / inhabitedAreaFactor))) : null;
      const eraAdjust = window.WorldAtlasCityEra?.adjustProfile || ((value) => value);
      return eraAdjust({
        ...styles[style],
        morphology: morphology[style],
        roof: material.roof,
        material,
        fixedMaterial,
        portableMaterial,
        palace: palaceDesign(recipe, style),
        tradition,
        namingTradition,
        prototype: layout.prototype,
        prototypeLabel: layoutLabels[layout.prototype],
        monumentTradition: layout.monumentTradition,
        dwellingRoof: ["west-asian", "mesopotamian"].includes(layout.monumentTradition) ? "flat" : null,
        mechanisms,
        inhabitedDensity,
        plan,
        regular,
        rectangular,
        capital,
        style,
        kind,
        label: small && kind === "seaport" ? "\u6E2F\u53E3\u6751\u843D" : small && ["lake-port", "river-port"].includes(kind) ? "\u6C34\u5CB8\u805A\u843D" : label,
        mobile,
        village,
        small,
        ...settlementRadiusKm !== null ? { settlementRadiusKm } : {},
        defence: { layers, barbicans },
        prefix: Array.from(recipe.name || "\u5F53\u5730").slice(0, 3).join(""),
        buildingCount: Math.max(small ? 6 : 18, Math.round(population / (mobile ? 10 : small ? 6 : recipe.era === "contemporary" ? 26 : recipe.era === "industrial" ? 17 : ["medieval", "early-modern", "preindustrial"].includes(recipe.era) && ["timber-frame", "stone-masonry", "terraced", "canal-side", "vernacular-mixed"].includes(layout.architecture) ? 6.5 : 11)))
      }, recipe, { openGround, layout, population });
    }
    const rect = (x, y, w, h) => [[x - w / 2, y - h / 2], [x + w / 2, y - h / 2], [x + w / 2, y + h / 2], [x - w / 2, y + h / 2]];
    const circle = (x, y, r) => Array.from({ length: 16 }, (_, i) => [x + Math.cos(i * Math.PI / 8) * r, y + Math.sin(i * Math.PI / 8) * r]);
    function template(kind, style, population = 0, design = { family: "axial-courts", variant: 0 }) {
      let parts = [];
      const add = (points, roof = "hip", feature = null) => parts.push({ points, roof, ...feature ? { feature } : {} });
      const sacred = ["sanctuary", "great-sanctuary", "pilgrimage-monastery", "water-sanctuary", "harbor-shrine"].includes(kind);
      if (sacred && design.templeFamily === "east-asian-courts") {
        add(rect(0, -0.59, 1.14, 0.34), "hip", "main-hall");
        add(rect(0, -0.13, 0.78, 0.25), "hip", "worship-hall");
        for (const x of [-0.84, 0.84]) add(rect(x, -0.08, 0.17, 1.13), "hip", "cloister");
        add(rect(0, 0.76, 0.62, 0.22), "hip", "temple-gate");
        if (design.variant !== 0) add(rect(-0.47, 0.33, 0.25, 0.25), "tiered", "pagoda");
      } else if (sacred && ["south-asian-temple", "south-asian-early"].includes(design.templeFamily)) {
        add(rect(0, -0.53, 0.58, 0.58), "tiered", "sanctum");
        add(rect(0, -0.03, 0.76, 0.34), "hip", "pillared-hall");
        add(rect(0, -0.23, 0.24, 0.14), "hip", "antechamber");
        for (const x of [-0.68, 0.68]) add(rect(x, -0.4, 0.24, 0.26), "tiered", "subsidiary-shrine");
        for (const x of [-1.05, 1.05]) add(rect(x, 0, 0.15, 1.6), "flat", "cloister");
        add(rect(0, -0.86, 2, 0.14), "flat", "cloister");
        for (const x of [-0.7, 0.7]) add(rect(x, 0.83, 0.6, 0.14), "flat", "cloister");
        add(
          rect(0, 0.79, design.templeFamily === "south-asian-early" ? 0.31 : 0.44, 0.22),
          design.templeFamily === "south-asian-early" ? "hip" : "tiered",
          "temple-gate"
        );
        if (design.templeFamily === "south-asian-temple") for (const x of [-1.05, 1.05]) add(rect(x, 0.12, 0.23, 0.34), "tiered", "side-gate");
      } else if (sacred && design.templeFamily === "west-asian-court") {
        add(rect(0, -0.59, 1.7, 0.36), "flat", "prayer-hall");
        for (const x of [-0.86, 0.86]) add(rect(x, -0.01, 0.18, 0.9), "flat", "arcade");
        for (const x of [-0.52, 0.52]) add(rect(x, 0.59, 0.6, 0.2), "flat", "arcade");
        add(rect(0, 0.77, 0.34, 0.2), "flat", "temple-gate");
        add(circle(0, -0.59, 0.21), "dome", "sanctuary-dome");
        for (const x of [-1.03, 1.03]) add(circle(x, -0.62, 0.095), "tower", "minaret");
      } else if (sacred && design.templeFamily === "european-church") {
        add([
          [-0.23, -0.72],
          [0.23, -0.72],
          [0.23, -0.16],
          [0.53, -0.16],
          [0.53, 0.12],
          [0.23, 0.12],
          [0.23, 0.66],
          [-0.23, 0.66],
          [-0.23, 0.12],
          [-0.53, 0.12],
          [-0.53, -0.16],
          [-0.23, -0.16]
        ], "gable", "nave-and-transept");
        add(rect(0, 0.65, 0.31, 0.28), "tower", "bell-tower");
      } else if (sacred && design.templeFamily === "classical-colonnade") {
        add(rect(0, -0.12, 0.82, 1.03), "gable", "temple-cella");
        for (const x of [-0.57, 0.57]) for (let i = 0; i < 5; i++) add(rect(x, -0.56 + i * 0.22, 0.09, 0.1), "flat", "colonnade");
        add(rect(0, 0.61, 1.3, 0.15), "flat", "temple-steps");
      } else if (sacred && design.templeFamily === "mesopotamian-terrace") {
        add(rect(0, -0.25, 1.1, 0.96), "terrace", "terrace-base");
        add(rect(0, -0.33, 0.82, 0.68), "terrace", "terrace-tier");
        add(rect(0, -0.4, 0.49, 0.38), "flat", "raised-sanctum");
        for (let i = 0; i < 6; i++) add(rect(0, 0.26 + i * 0.075, 0.24, 0.055), "flat", "processional-stair");
        for (const x of [-1.06, 1.06]) add(rect(x, -0.08, 0.16, 1.46), "flat", "temple-court");
        add(rect(0, -0.89, 2.04, 0.14), "flat", "temple-court");
        add(rect(0, 0.83, 0.44, 0.18), "flat", "temple-gate");
      } else if (["common-house", "village-shrine", "landing-store", "village-market"].includes(kind)) {
        add(rect(0, 0, kind === "village-shrine" ? 0.78 : 1.3, kind === "landing-store" ? 1.06 : 0.86), styles[style]?.temple === "pavilion" ? "dome" : "gable");
      } else if (kind === "royal-palace" || kind === "imperial-palace") {
        const { family, variant } = design, shift = (variant - 1) * 0.09, large = population >= 1e5;
        if (family === "axial-courts") {
          const halls = variant === 0 ? [-0.68, -0.12, 0.44] : variant === 1 ? [-0.61, 0.1] : [-0.7, -0.3, 0.29];
          halls.forEach((y, i) => add(rect(shift, y, i === 1 ? 1.1 : 0.9, 0.22)));
          for (const x of [-0.65, 0.65]) for (const y of [-0.46, 0.1, 0.56]) add(rect(x, y, 0.17, 0.35));
          add(rect(shift, 0.8, 0.45, 0.16), "gate");
          if (variant === 1) {
            add(rect(-0.3, -0.66, 0.27, 0.19));
            add(rect(0.3, -0.66, 0.27, 0.19));
          }
          if (large) for (const x of [-1.04, 1.04]) for (const y of [-0.68, -0.25, 0.23, 0.68]) add(rect(x, y, 0.31, 0.25));
        } else if (family === "merchant-palazzo") {
          add(rect(shift, -0.58, 1.7, 0.4), "hip");
          for (const x of [-0.81, 0.81]) add(rect(x, 0.02, 0.25, 0.79), "hip");
          add(rect(-0.44, 0.52, 0.66, 0.22), "gable");
          add(rect(0.46, 0.52, 0.65, 0.22), "gable");
          add(rect(0, 0.82, 0.48, 0.16), "gate");
          for (const x of [-0.66, -0.22, 0.22, 0.66]) add(rect(x, -0.87, 0.15, 0.18), "tower");
          if (variant === 1) add(rect(0, 0.08, 0.6, 0.18), "flat");
          if (large) for (const x of [-1.09, 1.09]) for (const y of [-0.64, -0.22, 0.2, 0.62]) add(rect(x, y, 0.24, 0.27));
        } else if (family === "peristyle") {
          add(rect(shift, -0.63, 1.65, 0.32), "gable");
          for (const x of [-0.83, 0.83]) add(rect(x, -0.03, 0.2, 0.88), "gable");
          for (const x of [-0.52, 0.52]) add(rect(x, 0.43, 0.45, 0.18), "flat");
          add(rect(shift, 0.82, 0.48, 0.18), "gate");
          if (variant === 1) add(rect(0, 0.23, 0.68, 0.19), "flat");
          if (variant === 2) add(circle(-0.46, -0.62, 0.18), "dome");
          if (large) for (const x of [-1.1, 1.1]) for (const y of [-0.7, -0.3, 0.12, 0.56]) add(rect(x, y, 0.22, 0.27));
        } else if (family === "hall-and-bailey") {
          add(rect(-0.15, -0.42, 1.24, 0.39), "gable");
          add(rect(0.59, -0.05, 0.23, 0.7), "gable");
          add(rect(-0.68, 0.31, 0.29, 0.6), "gable");
          add(rect(0.18, 0.45, 0.52, 0.24), "gable");
          for (const x of [-0.72, 0.63]) add(rect(x, -0.68, 0.22, 0.22), "tower");
          add(rect(0, 0.8, 0.39, 0.21), "gate");
          add(rect(-0.34, 0.1, 0.25, 0.22), "hip");
          if (variant === 2) add(rect(0.5, 0.56, 0.3, 0.22), "gable");
          if (large) for (const x of [-1.08, 1.03]) for (const y of [-0.66, -0.22, 0.2, 0.63]) add(rect(x, y, 0.25, 0.27), "gable");
        } else if (family === "castle-palace") {
          add(rect(-0.14, -0.42, 1.25, 0.36), "gable");
          add(rect(-0.68, 0.08, 0.28, 0.64), "gable");
          add(rect(0.53, -0.04, 0.23, 0.53), "gable");
          for (const [x, y] of [[-0.73, -0.61], [0.61, -0.58], [-0.77, 0.62], [0.67, 0.62]]) add(variant === 1 ? rect(x, y, 0.21, 0.21) : circle(x, y, 0.14), "tower");
          add(rect(-0.18, 0.81, 0.38, 0.2), "gate");
          add(rect(0.3, 0.46, 0.49, 0.22));
          if (large) for (const x of [-1.08, 1.03]) for (const y of [-0.66, -0.22, 0.2, 0.63]) add(rect(x, y, 0.25, 0.27), "gable");
        } else if (family === "terraced-court") {
          add(rect(shift, -0.36, 1.55, 0.28));
          for (const x of [-0.81, -0.3, 0.27, 0.8]) add(rect(x, 0.36, 0.28, 0.28));
          add(rect(-0.98, -0.23, 0.2, 0.58), "tower");
          add(rect(0.98, -0.21, 0.2, 0.62), "tower");
          add(rect(shift, 0.81, 0.42, 0.18), "gate");
          if (large) for (const x of [-1.09, -0.55, 0, 0.55, 1.09]) {
            add(rect(x, -0.77, 0.28, 0.2));
            add(rect(x, 0.65, 0.3, 0.16));
          }
        } else {
          add(rect(shift, -0.54, 1.05, 0.35));
          for (const [x, y] of [[-0.75, -0.18], [0.73, -0.05], [-0.68, 0.48], [0.64, 0.52]]) add(rect(x, y, 0.37, 0.26));
          add(rect(-0.29, 0.12, 0.36, 0.22));
          add(rect(0.23, 0.2, 0.33, 0.2));
          add(rect(0, 0.83, 0.38, 0.16), "gate");
          if (large) for (const x of [-1.1, 1.08]) for (const y of [-0.67, -0.19, 0.34, 0.73]) add(rect(x, y, 0.23, 0.21));
        }
      } else if (kind === "council-house") {
        add([[-0.65, -0.5], [0.4, -0.5], [0.72, -0.18], [0.72, 0.27], [0.4, 0.57], [-0.65, 0.57]], "dome");
        add(rect(0, -0.68, 1.34, 0.2), "flat");
      } else if (kind === "holy-tomb") {
        add(circle(0, -0.15, 0.43), "dome");
        add(rect(-0.59, 0.1, 0.24, 0.9));
        add(rect(0.59, 0.1, 0.24, 0.9));
        add(rect(0, 0.64, 1.35, 0.22));
      } else if (kind === "observatory-sanctuary") {
        add(circle(0, -0.13, 0.53), "tower");
        add(rect(0, 0.62, 1.3, 0.24));
        for (const x of [-0.64, 0.64]) add(rect(x, -0.1, 0.2, 0.95));
      } else if (["great-sanctuary", "pilgrimage-monastery", "water-sanctuary", "harbor-shrine"].includes(kind)) {
        add(rect(0, -0.53, 1.35, 0.32));
        for (const x of [-0.6, 0.6]) add(rect(x, 0, 0.23, 1.06));
        add(rect(-0.38, 0.62, 0.54, 0.2));
        add(rect(0.38, 0.62, 0.54, 0.2));
        if (kind === "great-sanctuary") add(circle(0, -0.52, 0.26), "dome");
        if (kind === "pilgrimage-monastery") for (const x of [-0.38, 0.38]) add(rect(x, -0.12, 0.24, 0.2));
        if (kind === "harbor-shrine") add(circle(0.55, -0.5, 0.16), "tower");
      } else if (kind === "sanctuary") {
        if (styles[style]?.temple === "colonnade") {
          add(rect(0, -0.12, 0.82, 1.03));
          for (const x of [-0.55, 0.55]) for (let i = 0; i < 5; i++) add(rect(x, -0.56 + i * 0.22, 0.09, 0.1), "flat");
          add(rect(0, 0.58, 1.28, 0.16), "flat");
        } else if (styles[style]?.temple === "longhouse") {
          add([[-0.25, -0.72], [0.25, -0.72], [0.25, 0.12], [0.52, 0.12], [0.52, 0.36], [0.25, 0.36], [0.25, 0.68], [-0.25, 0.68], [-0.25, 0.36], [-0.52, 0.36], [-0.52, 0.12], [-0.25, 0.12]]);
          add(rect(0, -0.66, 0.31, 0.31), "tower");
        } else if (style === "nomadic") add(circle(0, 0, 0.46), "dome");
        else {
          add(rect(0, -0.46, 1.26, 0.3));
          add(rect(-0.48, 0.05, 0.27, 0.8));
          add(rect(0.48, 0.05, 0.27, 0.8));
          add(rect(0, 0.48, 1.22, 0.24));
          add(circle(0, -0.44, 0.17), "dome");
        }
      } else if (kind === "caravanserai") {
        add(rect(0, -0.52, 1.5, 0.28), "flat");
        add(rect(-0.6, 0, 0.28, 1.06), "flat");
        add(rect(0.6, 0, 0.28, 1.06), "flat");
        add(rect(-0.4, 0.52, 0.48, 0.28), "flat");
        add(rect(0.4, 0.52, 0.48, 0.28), "flat");
      } else if (kind === "barracks") {
        for (const y of [-0.55, 0, 0.55]) add(rect(0, y, 1.36, 0.24));
      } else if (kind === "granary" || kind === "customs-house") {
        add(rect(-0.3, 0, 0.48, 1.2));
        add(rect(0.34, 0, 0.48, 1.2));
        add(rect(0, 0.57, 0.9, 0.15), "flat");
      } else if (kind === "lord-manor") {
        add(rect(0, -0.4, 1.35, 0.36));
        add(rect(-0.48, 0.08, 0.26, 0.68));
        add(rect(0.48, 0.08, 0.26, 0.68));
        add(rect(0.45, 0.55, 0.42, 0.22));
        add(rect(-0.48, -0.43, 0.3, 0.3), "tower");
      } else if (kind === "assembly-tent") add(circle(0, 0, 0.52), "dome");
      else if (kind === "town-hall") {
        add(rect(0, -0.25, 1.18, 0.62));
        add(rect(-0.51, 0.28, 0.28, 0.38));
        add(rect(0.51, 0.28, 0.28, 0.38));
        add(rect(0, -0.25, 0.23, 0.23), "tower");
      } else if (kind === "market-hall") {
        add(rect(0, -0.54, 1.3, 0.52), "gable");
        for (const y of [-0.12, 0.34]) for (const x of [-0.83, -0.51, 0.51, 0.83]) add(rect(x, y, 0.24, 0.28), "awning");
      }
      if (design.flatRoofs) parts = parts.map((part) => ["hip", "gable"].includes(part.roof) ? { ...part, roof: "flat" } : part);
      return parts;
    }
    window.WorldAtlasCityCharacter = Object.freeze({ profile, template, mapPalette });
  })();
})();
