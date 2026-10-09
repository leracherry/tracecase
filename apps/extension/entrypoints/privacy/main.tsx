import { browser as chrome } from "wxt/browser";
import React, { useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  defaultPrivacyRules,
  parsePrivacyRules,
  type PrivacyRules,
} from "../../../../packages/redaction/src/index.js";
import "./style.css";
async function send(message: unknown) {
  const reply = await chrome.runtime.sendMessage(message);
  if (reply?.error) throw new Error(reply.error);
  return reply?.value;
}
function PrivacySettings() {
  const [fields, setFields] = useState("");
  const [selectors, setSelectors] = useState("");
  const [saved, setSaved] = useState<PrivacyRules>();
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [fieldError, setFieldError] = useState("");
  const [selectorError, setSelectorError] = useState("");
  const fieldsInput = useRef<HTMLTextAreaElement>(null);
  const selectorsInput = useRef<HTMLTextAreaElement>(null);
  const errorMessage = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (!error) return;
    if (fieldError) fieldsInput.current?.focus();
    else if (selectorError) selectorsInput.current?.focus();
    else errorMessage.current?.focus();
  }, [error, fieldError, selectorError]);
  const apply = (rules: PrivacyRules) => {
    setFields(rules.fields.join("\n"));
    setSelectors(rules.selectors.join("\n"));
  };
  useEffect(() => {
    void send({ type: "privacy:get" })
      .then((value) => {
        const rules = parsePrivacyRules(value);
        apply(rules);
        setSaved(rules);
      })
      .catch(() =>
        setError(
          "Unable to load privacy settings. Reload this page to try again.",
        ),
      );
  }, []);
  const dirty =
    !!saved &&
    (fields !== saved.fields.join("\n") ||
      selectors !== saved.selectors.join("\n"));
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  async function save(event: React.FormEvent) {
    event.preventDefault();
    setNotice("");
    setError("");
    const lines = (value: string) =>
      value
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
    const fieldValues = lines(fields),
      selectorValues = lines(selectors);
    let invalidFields = "",
      invalidSelectors = "";
    try {
      parsePrivacyRules({ version: 1, fields: fieldValues, selectors: [] });
    } catch {
      invalidFields =
        "Use up to 50 names, each no longer than 64 characters. Start with a letter or underscore; use letters, numbers, underscores, dots or hyphens.";
    }
    try {
      parsePrivacyRules({ version: 1, fields: [], selectors: selectorValues });
    } catch {
      invalidSelectors =
        'Use up to 50 simple selectors, each no longer than 160 characters: .class, #id, [data-attribute], [name="field"] or [id="value"].';
    }
    setFieldError(invalidFields);
    setSelectorError(invalidSelectors);
    if (invalidFields || invalidSelectors) {
      setError(
        "Check your rules. Correct the highlighted lists before saving.",
      );
      return;
    }
    const rules = parsePrivacyRules({
      version: 1,
      fields: fieldValues,
      selectors: selectorValues,
    });
    setBusy(true);
    try {
      const result = parsePrivacyRules(
        await send({ type: "privacy:save", rules }),
      );
      apply(result);
      setSaved(result);
      setNotice("Privacy rules saved. They apply to your next recording.");
    } catch {
      setError(
        "Unable to save privacy rules. Your previous settings are unchanged; try again.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="privacy-settings">
      <a className="settings-brand" href="/popup.html">
        <img src="/tracecase-logo.png" width="36" height="36" alt="" />
        TraceCase
      </a>
      <p className="eyebrow">CAPTURE SETTINGS</p>
      <h1>Keep private details out.</h1>
      <p className="intro">
        Add rules for your project before recording. Settings stay on this
        device and apply to every site you record.
      </p>
      <div className="baseline">
        <strong>Built-in protection is always on</strong>
        <p>
          Passwords, credential headers and common sensitive fields remain
          excluded. Custom rules add to these protections.
        </p>
      </div>
      <form onSubmit={(event) => void save(event)}>
        <fieldset disabled={!saved || busy}>
          <legend className="sr-only">Capture privacy rules</legend>
          <div className="settings-grid">
            <div className="settings-field">
              <label htmlFor="privacy-fields">
                Additional sensitive fields
              </label>
              <p id="fields-help" className="hint">
                One name per line. Exact, case-insensitive matching for
                JSON/form fields, headers, URL query parameters and input names
                or IDs.
              </p>
              <textarea
                id="privacy-fields"
                ref={fieldsInput}
                aria-invalid={!!fieldError}
                aria-describedby={
                  fieldError ? "fields-help fields-error" : "fields-help"
                }
                value={fields}
                onChange={(e) => {
                  setFields(e.target.value);
                  setFieldError("");
                  setError("");
                  setNotice("");
                }}
                spellCheck={false}
                rows={7}
                placeholder={"customer_id\ninternal_reference"}
              />
              {fieldError && (
                <span className="field-error" id="fields-error">
                  {fieldError}
                </span>
              )}
            </div>
            <div className="settings-field">
              <label htmlFor="privacy-selectors">Private page elements</label>
              <p id="selectors-help" className="hint">
                One selector per line. Excludes matching elements and their
                descendants from actions and visual capture; hides them in
                screenshots.
              </p>
              <textarea
                id="privacy-selectors"
                ref={selectorsInput}
                aria-invalid={!!selectorError}
                aria-describedby={
                  selectorError
                    ? "selectors-help selectors-error"
                    : "selectors-help"
                }
                value={selectors}
                onChange={(e) => {
                  setSelectors(e.target.value);
                  setSelectorError("");
                  setError("");
                  setNotice("");
                }}
                spellCheck={false}
                rows={7}
                placeholder={
                  ".customer-details\n#billing-summary\n[data-confidential]"
                }
              />
              {selectorError && (
                <span className="field-error" id="selectors-error">
                  {selectorError}
                </span>
              )}
            </div>
          </div>
          <p className="hint">
            Supported selectors: <code>.class</code>, <code>#id</code>,{" "}
            <code>[data-attribute]</code>, <code>[name="field"]</code>, and{" "}
            <code>[id="value"]</code>. Complex selectors and regular expressions
            are not accepted.
          </p>
          <div className="settings-actions">
            <button className="primary" type="submit" disabled={!dirty || busy}>
              {busy ? "Saving…" : "Save privacy rules"}
            </button>
            <button
              type="button"
              onClick={() => {
                apply(defaultPrivacyRules);
                setNotice("");
                setError("");
                setFieldError("");
                setSelectorError("");
              }}
            >
              Clear custom rules
            </button>
            <span className="hint">
              {dirty
                ? "Unsaved changes"
                : saved
                  ? "Settings saved on this device"
                  : "Loading settings…"}
            </span>
          </div>
        </fieldset>
        {error && (
          <p
            className="settings-error"
            role="alert"
            tabIndex={-1}
            ref={errorMessage}
          >
            {error}
          </p>
        )}
        <p className="settings-notice" role="status">
          {notice}
        </p>
      </form>
      <section className="settings-note">
        <h2>Review before sharing</h2>
        <p>
          Changes apply to new recordings, including after page navigation.
          Active recordings keep their original rules. Existing recordings are
          unchanged.
        </p>
        <p>
          Field rules cannot identify a sensitive value everywhere it appears.
          Use element rules for visible private text, and inspect the recording
          before sharing. Excluded actions or redacted API data can prevent
          automatic replay.
        </p>
      </section>
    </main>
  );
}
createRoot(document.getElementById("root")!).render(<PrivacySettings />);
