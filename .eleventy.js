module.exports = function(eleventyConfig) {
  return {
    dir: { input: "src", output: "docs" },
    markdownTemplateEngine: "njk",
    htmlTemplateEngine: "njk"
  };
};
