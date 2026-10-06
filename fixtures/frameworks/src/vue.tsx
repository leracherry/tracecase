import { createApp, h, ref } from "vue";
createApp({
  setup() {
    const country = ref("US"),
      postal = ref(""),
      result = ref("");
    return () =>
      h("main", [
        h("h1", "Vue checkout"),
        h(
          "form",
          {
            onSubmit: async (event: Event) => {
              event.preventDefault();
              await new Promise((resolve) => setTimeout(resolve, 120));
              result.value =
                country.value === "CA"
                  ? "Tax service unavailable"
                  : "Order summary is visible";
            },
          },
          [
            h("label", { for: "country" }, "Country"),
            h(
              "select",
              {
                id: "country",
                "data-testid": "country",
                value: country.value,
                onChange: (event: Event) =>
                  (country.value = (event.target as HTMLSelectElement).value),
              },
              [
                h("option", { value: "US" }, "United States"),
                h("option", { value: "CA" }, "Canada"),
              ],
            ),
            h("label", { for: "postal" }, "Postal code"),
            h("input", {
              id: "postal",
              "data-testid": "postal",
              value: postal.value,
              required: true,
              onInput: (event: Event) =>
                (postal.value = (event.target as HTMLInputElement).value),
            }),
            h(
              "button",
              { type: "submit" },
              new URLSearchParams(location.search).has("renamed")
                ? "Review order"
                : "Continue",
            ),
            h("p", { role: "status" }, result.value),
          ],
        ),
      ]);
  },
}).mount("#app");
