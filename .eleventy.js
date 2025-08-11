module.exports = function(eleventyConfig) {
  // Collection qui liste les pages "manager"
  eleventyConfig.addCollection('teamManagers', (collection) => {
    return collection.getAll().filter((item) =>
      Array.isArray(item.data.tags) && item.data.tags.includes('team-manager')
    );
  });
  return {
    dir: { input: "src", output: "docs" },
    pathPrefix: "/ego-bots-site/"
  };
};
