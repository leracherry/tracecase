import { install, Browser } from "@puppeteer/browsers";
import { PUPPETEER_REVISIONS } from "puppeteer-core";
import { resolve } from "node:path";
const installed = await install({
  browser: Browser.FIREFOX,
  buildId: PUPPETEER_REVISIONS.firefox,
  cacheDir: resolve(".releases/browsers"),
});
console.log(`Firefox extension test browser: ${installed.executablePath}`);
