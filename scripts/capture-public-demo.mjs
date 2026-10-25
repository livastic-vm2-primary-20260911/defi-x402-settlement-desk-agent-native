/**
 * Real, isolated headless Chromium UI walkthrough (no Gmail or wallet browser).
 * Captures screenshots and an actual Page.startScreencast of browser frames.
 * All output is in gitignored .tmp/, with only synthetic quote examples.
 */
import { chromium } from "playwright-core";
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const frames = join(root, ".tmp", "clip-frames");
mkdirSync(frames, {recursive:true,mode:0o700});
const browser = await chromium.launch({
  executablePath: "/usr/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox","--disable-dev-shm-usage","--disable-extensions","--no-first-run"]
});
const context = await browser.newContext({
  viewport: {width: 1440,height: 900},
  deviceScaleFactor: 1
});
const page = await context.newPage();
let frameCount=0;
const badRequests=[];
page.on("pageerror",e=>badRequests.push(e.message.slice(0,180)));
page.on("response",r=>{if (r.status()>=500) badRequests.push("HTTP "+r.status()+" "+new URL(r.url()).pathname)});
let session;
try {
  await page.goto("http://127.0.0.1:4173/desk",{waitUntil:"domcontentloaded",timeout:20000});
  await page.getByRole("heading",{name:/Check the terms/i}).waitFor({timeout:20000});
  const screenshotRoot = join(root, ".tmp", "desk-before-review.png");
  await page.screenshot({path:screenshotRoot,fullPage:true});
  session = await context.newCDPSession(page);
  session.on("Page.screencastFrame",async (ev)=>{
    try {
      writeFileSync(join(frames,`frame-${String(++frameCount).padStart(5,"0")}.jpg`),Buffer.from(ev.data,"base64"));
      await session.send("Page.screencastFrameAck",{sessionId:ev.sessionId});
    } catch(e) {badRequests.push("screencast:"+String(e).slice(0,60))}
  });
  await session.send("Page.startScreencast",{format:"jpeg",quality:88,everyNthFrame:1});
  await page.waitForTimeout(900);
  await page.getByRole("button",{name:/Review payment terms/i}).click({timeout:13000});
  await page.getByText("LOCAL PREFLIGHT PASSED").waitFor({timeout:20000});
  await page.screenshot({path:join(root,".tmp","desk-valid-result.png"),fullPage:true});
  await page.mouse.move(950,625,{steps:12});
  await page.waitForTimeout(1200);
  await page.getByRole("button",{name:"Try over-cap example"}).click({timeout:13000});
  await page.waitForTimeout(850);
  await page.getByRole("button",{name:/Review payment terms/i}).click({timeout:13000});
  await page.getByText("BLOCKED BY POLICY").waitFor({timeout:20000});
  await page.screenshot({path:join(root,".tmp","desk-blocked-result.png"),fullPage:true});
  await page.mouse.move(850,550,{steps:10});
  await page.waitForTimeout(1100);
  const output={
    url:page.url(),
    validVerdictSeen:true,
    overCapVerdictSeen:true,
    frameCount,
    screenshots:[".tmp/desk-before-review.png",".tmp/desk-valid-result.png",".tmp/desk-blocked-result.png"],
    browserErrors:badRequests.slice(0,8)
  };
  writeFileSync(join(root,".tmp","demo-browser-verification.json"),JSON.stringify(output,null,2)+"\n");
  console.log(JSON.stringify(output));
} catch(e) {
  console.error("E2E_FAILURE",String(e).slice(0,600));
  throw e;
} finally {
  if (session) await session.send("Page.stopScreencast").catch(()=>{});
  await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
}
