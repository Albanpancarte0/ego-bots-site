module.exports = function(eleventyConfig) {
  // Collection "teamManagers" robuste (tag, nom fichier, ou permalink)
  eleventyConfig.addCollection('teamManagers', (collection) => {
    return collection.getAll().filter((item) => {
      const tags = Array.isArray(item.data.tags) ? item.data.tags : [];
      const hasTag = tags.includes('team-manager');
      const ip = (item.inputPath || '').toLowerCase();
      const stem = (item.filePathStem || '').toLowerCase();
      const byName = ip.endsWith('-manager.md') || stem.endsWith('-manager');
      const perm = (item.data.permalink || '').toString();
      const byPerm = /^\/publications\/equipes\/[^/]+\/$/.test(perm);
      return hasTag || byName || byPerm;
    });
  });

  return {
    dir: { input: "src", output: "docs" },
    pathPrefix: "/ego-bots-site/"
  };
};
