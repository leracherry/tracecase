import { createServer } from "node:http";
// Synthetic project-settings flow: delayed render, native controls, SPA + document navigation.
import { exampleStyles } from "../example-styles.mjs";
export function createWorkflowServer() {
  return createServer((req, res) => {
    res.setHeader("content-type", "text/html; charset=utf-8");
    if (req.url === "/done") {
      res.end(
        `<!doctype html><html lang="en" data-theme="light"><style>${exampleStyles()}</style><title>Saved project</title><h1>Project saved</h1><label>Search projects<input placeholder="Search projects"></label>`,
      );
      return;
    }
    res.end(`<!doctype html><html lang="en" data-theme="light"><head><meta name="viewport" content="width=device-width, initial-scale=1"><style>${exampleStyles()}</style><title>Project settings fixture</title></head><body>
      <main><h1>Project settings</h1>
      <input type="button" value="Edit project" id="edit">
      <div id="panel"></div></main>
      <script>
        document.querySelector('#edit').onclick = () => {
          history.pushState({}, '', '/settings');
          setTimeout(() => {
            document.querySelector('#panel').innerHTML = '<form><label>Project name<input name="project" required></label><label><input type="checkbox" name="notify">Notify team</label><label><input type="radio" name="visibility" value="private">Private project</label><label>Region<select><option value="eu">Europe</option><option value="us">United States</option></select></label><label>Email<input name="email"></label><input type="submit" value="Save project"></form><output aria-live="polite"></output><a href="/done">View project</a>';
            let submissions = 0;
            document.querySelector('form').onsubmit = event => {
              event.preventDefault();
              submissions++;
              document.querySelector('output').textContent = 'Saved ' + submissions + ' time';
            };
          }, 100);
        };
      </script></body></html>`);
  });
}
