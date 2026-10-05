import { chromium, type Page, type Locator } from 'playwright';
import type { Artifact, Candidate } from '../../schema/src/index.js';
export function resolveCandidate(page:Page,candidate:Candidate):Locator {
  switch(candidate.kind) {
    case 'testId': return page.getByTestId(candidate.value);
    case 'role': return page.getByRole(candidate.role,{name:candidate.name,exact:true});
    case 'label': return page.getByLabel(candidate.value,{exact:true});
    case 'placeholder': return page.getByPlaceholder(candidate.value,{exact:true});
  }
}
export function targetUrl(entryUrl:string,baseUrl?:string):string {
  const entry=new URL(entryUrl);
  if(!baseUrl) return entry.href;
  const base=new URL(baseUrl);
  if(!['http:','https:'].includes(base.protocol) || base.username || base.password) throw new Error('Replay URL must be HTTP(S) without credentials');
  return new URL(entry.pathname+entry.search,base.origin).href;
}
export async function execute(page:Page,artifact:Artifact,baseUrl?:string) {
  await page.goto(targetUrl(artifact.entryUrl,baseUrl));
  for(const [index,step] of artifact.steps.entries()) {
    if(step.type==='fill' && step.redacted) throw new Error(`Step ${index+1}: requires a private value`);
    let locator:Locator|undefined;
    for(const candidate of step.target) {
      const current=resolveCandidate(page,candidate);
      try { await current.waitFor({state:'visible',timeout:1000}); if(await current.count()===1) {locator=current;break;} } catch { /* Try the next semantic candidate. */ }
    }
    if(!locator) throw new Error(`Replay diverged at step ${index+1}: no unique visible semantic target`);
    try {
      if(step.type==='click') await locator.click();
      else if(step.type==='fill') await locator.fill(step.value);
      else await locator.selectOption(step.value);
    } catch { throw new Error(`Replay diverged at step ${index+1}: ${step.type} could not execute`); }
  }
}
export async function replay(artifact:Artifact,options:{url?:string;headed?:boolean;verify?:boolean}={}) {
  const browser=await chromium.launch({headless:!options.headed});
  try {
    const page=await browser.newPage({viewport:artifact.viewport});
    page.setDefaultTimeout(5000);
    await execute(page,artifact,options.url);
    if(!artifact.failure) return 'COMPLETED (no failure assertion recorded)';
    const text=options.verify?artifact.failure.expectedText:artifact.failure.observedText;
    await page.getByText(text,{exact:true}).waitFor({state:'visible',timeout:5000});
    return options.verify?'VERIFIED':'FAILURE REPRODUCED';
  } finally {await browser.close();}
}
