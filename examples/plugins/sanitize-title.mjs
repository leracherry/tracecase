// Explicitly load with --plugin ./examples/plugins/sanitize-title.mjs.
export default {
  apiVersion: 1,
  name: "project-title-redactor",
  transformArtifact(artifact) {
    artifact.title = artifact.title.replace(/customer-\d+/gi, "[customer]");
    return artifact;
  },
};
