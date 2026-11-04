// Run from the WSL validation workstation; only the synthetic dashboard is captured.
const {createRequire}=require('node:module');const fs=require('node:fs');
const path=require('node:path');
const req=createRequire(process.env.PLAYWRIGHT_PACKAGE??path.resolve(__dirname,'../../web/package.json'));
const {chromium}=req('@playwright/test');
(async()=>{
 const root=__dirname;
 const browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1440,height:1500}});
 const login=await page.request.post('http://localhost:13001/login',{data:{user:'admin',password:fs.readFileSync(root+'/private/grafana_password','utf8').trim()}});
 if(login.status()!==200)throw new Error('Grafana login failed');
 await page.goto('http://localhost:13001/d/operations-logs?from=now-30m&to=now');
 await page.getByText('최근 로그',{exact:true}).first().waitFor();
 await page.waitForTimeout(3000);
 fs.mkdirSync(root+'/validation-runtime',{recursive:true});
 await page.screenshot({path:root+'/validation-runtime/dashboard-1440.png',fullPage:true});
 console.log('Synthetic Grafana dashboard captured at 1440px');await browser.close();
})().catch(e=>{console.error(e.message);process.exit(1);});
