import React from "react";
import { createRoot } from "react-dom/client";
import { Inspector } from "./Inspector";
import { unpackArtifact } from "../../../packages/artifact/src/index.js";
const root = createRoot(document.getElementById("root")!);
const token = new URLSearchParams(location.search).get("artifact");
if (token && /^[a-f0-9]{48}$/.test(token))
  fetch(`/${token}/artifact`)
    .then((r) => r.arrayBuffer())
    .then((data) => unpackArtifact(new Uint8Array(data)))
    .then((artifact) => root.render(<Inspector initial={artifact} />))
    .catch((error) => root.render(<p role="alert">{String(error)}</p>));
else root.render(<Inspector />);
