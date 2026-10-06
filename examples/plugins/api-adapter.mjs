// Trusted local code. Custom routes are outside built-in fixture coverage.
export default {
  apiVersion: 1,
  name: "local-feature-flags",
  async beforeReplay(context) {
    await context.route("**/api/feature-flags", (route) =>
      route.fulfill({
        contentType: "application/json",
        body: JSON.stringify({ checkoutV2: true }),
      }),
    );
  },
};
