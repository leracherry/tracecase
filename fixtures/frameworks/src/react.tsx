import React, { useState } from "react";
import { createRoot } from "react-dom/client";
function Checkout() {
  const [country, setCountry] = useState("US"),
    [postal, setPostal] = useState(""),
    [result, setResult] = useState("");
  const renamed = new URLSearchParams(location.search).has("renamed");
  return (
    <main>
      <h1>React checkout</h1>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          await new Promise((resolve) => setTimeout(resolve, 120));
          setResult(
            country === "CA"
              ? "Tax service unavailable"
              : "Order summary is visible",
          );
        }}
      >
        <label htmlFor="country">Country</label>
        <select
          id="country"
          data-testid="country"
          value={country}
          onChange={(e) => setCountry(e.target.value)}
        >
          <option value="US">United States</option>
          <option value="CA">Canada</option>
        </select>
        <label htmlFor="postal">Postal code</label>
        <input
          id="postal"
          data-testid="postal"
          value={postal}
          onChange={(e) => setPostal(e.target.value)}
          required
        />
        <button type="submit">{renamed ? "Review order" : "Continue"}</button>
        <p role="status">{result}</p>
      </form>
    </main>
  );
}
createRoot(document.getElementById("app")!).render(<Checkout />);
