import React from "react";
import { createRoot } from "react-dom/client";
import { Inspector } from "../../../viewer/src/Inspector";
const root = createRoot(document.getElementById("root")!);
chrome.runtime
  .sendMessage({ type: "artifact" })
  .then((reply) => {
    if (reply.error) throw new Error(reply.error);
    root.render(<Inspector initial={reply.value || undefined} />);
  })
  .catch((error) => root.render(<p role="alert">{String(error)}</p>));
