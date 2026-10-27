/* Generation runs off the main thread so the page stays responsive. */
self.window = self;
importScripts('city-era.js', 'city-character.js', 'city-detail.js', 'city-site.js');
self.onmessage = event => {
  const {id, recipe, siteContext, seed, grid} = event.data;
  try {
    const started = Date.now();
    const generated = self.WorldAtlasCitySite.generate(recipe, siteContext, {seed});
    const cityPlan = self.WorldAtlasCities.plan(generated, {grid});
    self.postMessage({id, generated, cityPlan, generatorId: self.WorldAtlasCitySite.generatorId, ms: Date.now() - started});
  } catch (error) {
    self.postMessage({id, error: error && error.message || String(error)});
  }
};
