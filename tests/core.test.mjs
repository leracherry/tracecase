import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { parseArtifact, serializeArtifact } from '../dist/schema/src/index.js';
import { attachRecorder } from '../dist/recorder/src/index.js';
import { execute, replay, targetUrl } from '../dist/replay/src/index.js';
import { createDemoServer } from '../fixtures/demo-store/server.mjs';
const sample=parseArtifact(await readFile(new URL('../examples/checkout.tracecase',import.meta.url),'utf8'));
test('artifact round-trip and untrusted-input rejection',()=>{
 assert.deepEqual(parseArtifact(serializeArtifact(sample)),sample);
 for(const mutate of [a=>a.version='99',a=>a.entryUrl='javascript:alert(1)',a=>a.entryUrl='http://user:pass@example.com',a=>a.steps[0].target=[{kind:'css',value:'*'}],a=>a.steps[0].type='evaluate',a=>a.viewport.width=-1,a=>a.surprise='payload']) {
  const artifact=structuredClone(sample);mutate(artifact);assert.throws(()=>parseArtifact(JSON.stringify(artifact)));
 }
 assert.throws(()=>parseArtifact(' '.repeat(4*1024*1024+1)));
 assert.equal(targetUrl('https://staging.test/checkout?cart=2','http://localhost:6000'), 'http://localhost:6000/checkout?cart=2');
 assert.throws(()=>targetUrl(sample.entryUrl,'file:///tmp'));
});
test('20 captured scenarios survive export and replay against the same build',async()=>{
 const server=createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch();
 try {
  for(let i=0;i<20;i++) {
   const page=await browser.newPage();const steps=await attachRecorder(page);
   await page.goto(url+'/checkout');
   const country=i%2?'US':'CA';
   await page.getByLabel('Country').selectOption(country);
   await page.getByLabel('Postal code').fill(`V7M ${i}A1`);
   await page.getByRole('button',{name:'Continue'}).click();
   const observedText=country==='CA'?'Tax service unavailable':'Order summary is visible';
   await page.getByText(observedText,{exact:true}).waitFor();
   // Binding completion barrier: recorder messages are ordered before evaluate returns.
   await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
   assert.equal(steps.length,3);
   assert.deepEqual(steps.map(s=>s.type),['select','fill','click']);
   const artifact=parseArtifact(serializeArtifact({...sample,entryUrl:url+'/checkout',steps:[...steps],failure:{observedText,expectedText:'Order summary is visible'}}));
   const receiver=await browser.newPage();await execute(receiver,artifact,url);
   await receiver.getByText(observedText,{exact:true}).waitFor();
   await receiver.close();await page.close();
  }
 } finally {await browser.close();await new Promise(resolve=>server.close(resolve));}
});
test('private inputs are excluded before reaching recorder storage',async()=>{
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();const steps=await attachRecorder(page);
  await page.goto('data:text/html,<label>Password<input type="password" data-testid="pass"></label><label>Token<input name="access_token" data-testid="token"></label><div data-private><label>Email<input data-testid="email"></label></div><label>Public<input data-testid="public"></label>');
  for(const name of ['Password','Token','Email','Public']) await page.getByLabel(name).fill('sensitive-value');
  await page.evaluate(()=>new Promise(resolve=>setTimeout(resolve,30)));
  assert.equal(steps.length,1);assert.equal(steps[0].target[0].value,'public');
 } finally {await browser.close();}
});
test('fallback locators, divergence, failure reproduction, and fix verification',async()=>{
 const server=createDemoServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const url=`http://127.0.0.1:${server.address().port}`;
 const browser=await chromium.launch();
 try {
  const page=await browser.newPage();
  const fallback=structuredClone(sample);fallback.steps.forEach(s=>s.target[0].value='removed-testid');
  await execute(page,fallback,url);await page.getByText('Tax service unavailable',{exact:true}).waitFor();
  assert.equal(await replay(sample,{url}),'FAILURE REPRODUCED');
  await assert.rejects(replay(sample,{url,verify:true}));
  process.env.TRACECASE_DEMO_FIXED='1';
  assert.equal(await replay(sample,{url,verify:true}),'VERIFIED');
  delete process.env.TRACECASE_DEMO_FIXED;
  const missing=structuredClone(sample);missing.steps[0].target=[{kind:'testId',value:'absent'}];
  await assert.rejects(execute(page,missing,url),/diverged at step 1/);
 } finally {delete process.env.TRACECASE_DEMO_FIXED;await browser.close();await new Promise(resolve=>server.close(resolve));}
});
