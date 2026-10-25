/**
 * Offline E2E smoke for the public static x402 policy UI.
 * Opens only a temporary loopback HTTP server and isolated Chromium process,
 * never an existing user's browser profile, wallet, email session or credentials.
 */
import http from "node:http";
import {readFile} from "node:fs/promises";
import {resolve,extname,sep} from "node:path";
import {chromium} from "playwright-core";

const root=resolve(process.cwd(),"docs");
const server=http.createServer(async(req,res)=>{
  try {
    const parsed=new URL(req.url||"/","http://localhost");
    const pathname=parsed.pathname==="/"?"/index.html":parsed.pathname;
    const filename=resolve(root,"."+pathname);
    if (!filename.startsWith(root+sep)) {res.writeHead(403);res.end("forbidden");return;}
    const buff=await readFile(filename);
    res.writeHead(200,{"Content-Type":extname(filename)===".js"?"text/javascript; charset=utf-8":extname(filename)===".png"?"image/png":"text/html; charset=utf-8"});
    res.end(buff);
  } catch {res.writeHead(404);res.end("missing");}
});
await new Promise((resolveStart,reject)=>server.once("error",reject).listen(0,"127.0.0.1",resolveStart));
const port=server.address().port;
const origin=`http://127.0.0.1:${port}`;
let browser; let context;
const errors=[]; const remote=[];
const requireVerdict=async (page,expected)=> {
  await page.getByRole("button",{name:/Review payment terms/}).click();
  await page.getByText(expected).waitFor({timeout:9000});
};
try {
  browser=await chromium.launch({headless:true,executablePath:"/usr/bin/google-chrome",args:["--no-sandbox","--disable-dev-shm-usage","--disable-extensions","--no-first-run"]});
  context=await browser.newContext({viewport:{width:1365,height:900},deviceScaleFactor:1});
  const page=await context.newPage();
  page.on("pageerror",e=>errors.push(e.message.slice(0,300)));
  await page.route("**/*",route=>{
    if(!route.request().url().startsWith(origin)) {
      remote.push(route.request().url().split("?")[0]);
      return route.abort();
    }
    return route.continue();
  });
  await page.goto(origin+"/",{waitUntil:"networkidle",timeout:18000});
  await page.getByRole("heading",{name:/Check the terms/i}).waitFor({timeout:10000});
  await requireVerdict(page,"LOCAL PREFLIGHT PASSED");
  if (!(await page.getByText("0.010000 USDC",{exact:false}).count())) throw Error("Missing expected 0.01 USDC math");
  await page.screenshot({path:"docs/media/static-guard-valid.png",fullPage:true});
  await page.getByRole("button",{name:"Try over-cap example"}).click();
  await requireVerdict(page,"BLOCKED BY POLICY");
  await page.getByText("Quote exceeds the locally selected spending cap.",{exact:false}).waitFor();
  await page.screenshot({path:"docs/media/static-guard-blocked.png",fullPage:true});
  await page.getByRole("button",{name:"Load valid example"}).click();
  await page.getByRole("textbox",{name:/Expected payTo/i}).fill("0x9999999999999999999999999999999999999999");
  await requireVerdict(page,"BLOCKED BY POLICY");
  await page.getByText("Recipient does not match the approved expected address.",{exact:false}).waitFor();
  await page.locator("#json").fill('{"not":"valid"}');
  await page.getByRole("button",{name:/Review payment terms/}).click();
  await page.getByText("Only x402 v2 quotes are supported",{exact:false}).waitFor();
  const mobile=await context.newPage();
  mobile.on("pageerror",e=>errors.push(e.message.slice(0,300)));
  await mobile.setViewportSize({width:390,height:844});
  await mobile.goto(origin+"/",{waitUntil:"networkidle",timeout:18000});
  const dimensions=await mobile.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  if (dimensions.width>dimensions.viewport+1) throw Error("Horizontal mobile overflow "+JSON.stringify(dimensions));
  await mobile.screenshot({path:"docs/media/static-guard-mobile.png",fullPage:true});
  if(remote.length||errors.length)throw Error("Unwanted requests or JS errors "+JSON.stringify({remote,errors}));
  console.log(JSON.stringify({status:"PASS",desktop:1365,mobile:390,valid:true,overcap:true,recipientMismatch:true,v1Rejected:true,exceptions:errors.length,externalRequests:remote.length,mobileNoOverflow:true},null,2));
} finally{
  if(context)await context.close().catch(()=>{});
  if(browser)await browser.close().catch(()=>{});
  await new Promise(done=>server.close(done));
}
