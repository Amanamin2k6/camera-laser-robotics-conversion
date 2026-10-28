import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const base=process.env.APP_URL||'http://127.0.0.1:4173/';
const evidence=path.resolve(process.env.EVIDENCE_DIR||'evidence/assignment-2');
await fs.mkdir(evidence,{recursive:true});
const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL||'chrome',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true});
const page=await context.newPage(),errors=[],networkFailures=[],results=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('response',r=>{if(r.status()>=400&&r.url().startsWith(base))networkFailures.push({url:r.url(),status:r.status()});});
const load=async(query='')=>{await page.goto(base+query);await page.locator('#readings tr').nth(1).waitFor();await page.waitForTimeout(70);};
const content=id=>page.locator('#'+id).innerText();
async function value(key,number){await page.locator('#'+key+'Number').fill(String(number));await page.locator('#'+key+'Number').press('Enter');}
async function expectText(id,re){assert.match(await content(id),re);}
async function test(name,fn){try{await fn();results.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){results.push({name,status:'FAIL',error:e.message});console.error('FAIL '+name+': '+e.message);}}
try {
  await test('T01: Load defaults and reset all scene/view controls',async()=>{
    await load();await expectText('leftDepth',/2\.500 units/);await expectText('rightDepth',/2\.500 units/);await expectText('estimate',/0\.00°/);
    await value('z',5);await page.selectOption('#resolution','0');await page.selectOption('#zoom','4');await page.click('#reset');
    assert.equal(await page.inputValue('#zNumber'),'3');assert.equal(await page.inputValue('#resolution'),'640');assert.equal(await page.inputValue('#zoom'),'1');
  });
  await test('T02/T14: Correct projection and 2:1 cuboid image aspect ratio',async()=>{
    await load();const geometry=await page.locator('#camera .camera-face').evaluate(el=>{const r=el.getBBox();return {w:r.width,h:r.height};});
    // SVG getBBox uses browser float precision, unlike the double-precision model.
    assert.ok(Math.abs(geometry.w/geometry.h-2)<1e-6);
    const spots=await page.locator('.laser-spot').evaluateAll(es=>es.map(e=>Number(e.dataset.u)));assert.deepEqual(spots,[-.2,.2]);
    const normalizedRadius=await page.locator('.laser-spot').first().evaluate(e=>Number(e.getAttribute('r'))/e.ownerSVGElement.viewBox.baseVal.width);assert.ok(Math.abs(normalizedRadius-.02)<1e-12);
    await page.screenshot({path:path.join(evidence,'desktop-default.png'),fullPage:true});
  });
  await test('T03: Maximum focal length keeps depths; spots reach sensor boundaries',async()=>{
    await load();await value('f',2);await expectText('leftDepth',/2\.500/);await expectText('rightDepth',/2\.500/);
    assert.deepEqual(await page.locator('.laser-spot').evaluateAll(es=>es.map(e=>Number(e.dataset.u))),[-.8,.8]);
  });
  await test('T04/T22: Adaptive signed reticule, floor grid and nonoverlapping labels',async()=>{
    await load();await value('s',.1);await value('f',.1);
    const labels=await page.locator('.tick-label').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return {text:e.textContent,l:r.left,r:r.right};}));
    assert.ok(labels.some(p=>p.text==='0.016')&&labels.some(p=>p.text==='-0.016'));
    labels.sort((a,b)=>a.l-b.l);for(let i=1;i<labels.length;i++)assert.ok(labels[i].l>=labels[i-1].r-1,`Reticule labels overlap: ${labels[i-1].text}/${labels[i].text}`);
    assert.ok(await page.locator('#camera line').count()>15);await expectText('status',/overlap|one pixel/);
    await page.locator('#camera').screenshot({path:path.join(evidence,'adaptive-reticule.png')});
  });
  await test('T05: Maximum laser offset produces one true miss',async()=>{
    await load();await value('s',2);await expectText('leftDepth',/No hit/);await expectText('rightDepth',/2\.500/);await expectText('estimate',/Unavailable/);
  });
  await test('T06/T07: Positive and negative 30-degree same-face recovery',async()=>{
    await load();await page.click('[data-preset=tilted]');await expectText('leftDepth',/3\.845/);await expectText('rightDepth',/5\.000/);await expectText('estimate',/30\.00°/);
    await page.click('[data-preset=negative]');await expectText('leftDepth',/5\.000/);await expectText('rightDepth',/3\.845/);await expectText('estimate',/-30\.00°/);
  });
  await test('T08: Different-face hits no longer produce a false angle',async()=>{
    await load();await page.click('[data-preset=crossed]');await expectText('leftDepth',/3\.268/);await expectText('rightDepth',/5\.732/);await expectText('estimate',/Unavailable/);await expectText('status',/different faces/);
    await page.screenshot({path:path.join(evidence,'different-face-rejection.png'),fullPage:true});
  });
  await test('T09: Half-turn result is explicitly face inclination modulo 180 degrees',async()=>{
    await load();await page.click('[data-preset=halfturn]');await expectText('leftDepth',/4\.500/);await expectText('estimate',/0\.00°/);await expectText('status',/modulo 180°/);assert.equal(await page.inputValue('#angleNumber'),'180');
  });
  await test('T10/T11: One and two misses have no spurious image dots or angle',async()=>{
    await load();await page.click('[data-preset=miss]');await expectText('leftDepth',/4\.500/);await expectText('rightDepth',/No hit/);assert.equal(await page.locator('.laser-spot').count(),1);
    await page.click('[data-preset=edge]');await expectText('leftDepth',/No hit/);await expectText('rightDepth',/No hit/);await expectText('estimate',/Unavailable/);assert.equal(await page.locator('.laser-spot').count(),0);
  });
  await test('T12: Off-image intersections cannot supply camera depth or angle',async()=>{
    await load();await page.click('[data-preset=outside]');await expectText('leftDepth',/Outside image/);await expectText('rightDepth',/Outside image/);await expectText('estimate',/Unavailable/);await expectText('readings',/0\.500000/);
    assert.equal(await page.locator('.laser-spot').count(),0);await expectText('status',/outside the camera image/);
  });
  await test('T12 alternate: Student single-hit configuration reports no-hit and off-image separately',async()=>{
    await load('?z=1&x=-0.2&angle=0&s=2&f=0.5');await expectText('leftDepth',/No hit/);await expectText('rightDepth',/Outside image/);await expectText('estimate',/Unavailable/);await expectText('readings',/0\.500000/);
  });
  await test('T13: Camera/object overlap is flagged; measurements are withheld',async()=>{
    await load();await value('z',.1);await value('x',0);await expectText('status',/Invalid scene/);await expectText('leftDepth',/Invalid scene/);await expectText('rightDepth',/Invalid scene/);await expectText('estimate',/Unavailable/);
    assert.ok(await page.locator('.invalid-overlay').count());assert.ok(!/NaN|Infinity/.test(await page.locator('#camera').innerHTML()));
    await page.screenshot({path:path.join(evidence,'invalid-camera-plane.png'),fullPage:true});
  });
  await test('T13 clipping: Partial near-plane faces remain finite and bounded',async()=>{
    await load('?z=0.229843&x=0.884660&angle=50.625&s=2&f=0.1');await expectText('status',/Invalid scene/);
    assert.ok(await page.locator('#camera .camera-face').count()>0);
    const valid=await page.locator('#camera .camera-face').evaluateAll(es=>es.every(e=>[...e.points].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=-1e-7&&p.y>=-1e-7&&p.x<=e.ownerSVGElement.viewBox.baseVal.width+1e-7&&p.y<=e.ownerSVGElement.viewBox.baseVal.height+1e-7)));assert.ok(valid);
    assert.ok(!/NaN|Infinity/.test(await page.locator('#camera').innerHTML()));
  });
  await test('T16: Character-by-character negative entry preserves the draft and requested sign',async()=>{
    await load();const input=page.locator('#angleNumber');await input.fill('');await input.pressSequentially('-',{delay:30});assert.equal(await input.inputValue(),'-');assert.equal(await page.inputValue('#angle'),'0');
    await input.pressSequentially('30',{delay:30});assert.equal(await input.inputValue(),'-30');assert.equal(await page.inputValue('#angle'),'0');await input.press('Enter');assert.equal(await page.inputValue('#angle'),'-30');
    const lateral=page.locator('#xNumber');await lateral.fill('');await lateral.pressSequentially('-1',{delay:30});await lateral.press('Tab');assert.equal(await page.inputValue('#x'),'-1');
  });
  await test('T17: Character-by-character decimal focal entry becomes exactly 0.75',async()=>{
    await load();const input=page.locator('#fNumber');await input.fill('');await input.pressSequentially('0.75',{delay:30});assert.equal(await page.inputValue('#f'),'0.5');assert.equal(await input.inputValue(),'0.75');await input.press('Enter');assert.equal(await page.inputValue('#f'),'0.75');
  });
  await test('T17 alternate: Decimal angle entry has no cursor jump or digit corruption',async()=>{
    await load();const input=page.locator('#angleNumber');await input.fill('');await input.pressSequentially('0.75',{delay:30});await input.press('Enter');assert.equal(await input.inputValue(),'0.75');assert.equal(await page.inputValue('#angle'),'0.75');
  });
  await test('T18: Empty and invalid drafts preserve the prior scene; Escape restores the value',async()=>{
    await load();const input=page.locator('#zNumber');await input.fill('');assert.equal(await page.inputValue('#z'),'3');await input.press('Enter');assert.equal(await input.inputValue(),'');assert.equal(await input.getAttribute('aria-invalid'),'true');await expectText('leftDepth',/2\.500/);
    await input.press('Escape');assert.equal(await input.inputValue(),'3');assert.equal(await input.getAttribute('aria-invalid'),null);
  });
  await test('T18: Out-of-range entry is explained and never silently clamped',async()=>{
    await load();await value('z',99);assert.equal(await page.inputValue('#zNumber'),'99');assert.equal(await page.inputValue('#z'),'3');await expectText('zError',/0\.1 to 15.*not changed/);await expectText('leftDepth',/2\.500/);
    await value('z',5);assert.equal(await page.inputValue('#z'),'5');assert.equal(await content('zError'),'');
  });
  await test('T19: Exact 50.625-degree entry agrees with slider; different-face angle is rejected',async()=>{
    await load('?z=4&x=0');await value('angle',50.625);assert.equal(await page.inputValue('#angle'),'50.625');assert.equal(await page.inputValue('#angleNumber'),'50.625');await expectText('status',/different faces/);await expectText('estimate',/Unavailable/);
  });
  await test('Exact entry preserves precision beyond six decimal places',async()=>{
    await load();await value('s',.123456789);assert.equal(await page.inputValue('#sNumber'),'0.123456789');assert.equal(await page.inputValue('#s'),'0.123456789');
    await load('?s=0.123456789');assert.equal(await page.inputValue('#sNumber'),'0.123456789');
  });
  await test('T19: Slider keyboard steps match calibration and original angular increments',async()=>{
    await load();await page.locator('#s').press('ArrowRight');assert.equal(await page.inputValue('#sNumber'),'1.01');await page.locator('#f').press('ArrowRight');assert.equal(await page.inputValue('#fNumber'),'0.51');await page.locator('#angle').press('ArrowRight');assert.equal(await page.inputValue('#angleNumber'),'5.625');
  });
  await test('T15: Mouse drag changes the scene; handle remains keyboard accessible',async()=>{
    await load();const handle=page.locator('#drag-handle'),b=await handle.boundingBox();await page.mouse.move(b.x+b.width/2,b.y+b.height/2);await page.mouse.down();await page.mouse.move(b.x+b.width/2+110,b.y+b.height/2-20,{steps:8});await page.mouse.up();
    const z=Number(await page.inputValue('#zNumber')),x=Number(await page.inputValue('#xNumber'));assert.ok(z>4&&x>-.2);assert.equal(await page.inputValue('#z'),String(z));
    await page.locator('#drag-handle').focus();await page.keyboard.press('ArrowRight');assert.ok(Math.abs(Number(await page.inputValue('#zNumber'))-z-.1)<1e-6);assert.equal(await page.evaluate(()=>document.activeElement.id),'drag-handle');
  });
  await test('Original dial: Pointer and keyboard select pi/32 steps',async()=>{
    await load();await page.locator('#dial').scrollIntoViewIfNeeded();const d=await page.locator('#dial').boundingBox();await page.mouse.click(d.x+d.width/2,d.y+d.height*.12);assert.equal(await page.inputValue('#angleNumber'),'90');await page.locator('#dial').focus();await page.keyboard.press('ArrowLeft');assert.equal(await page.inputValue('#angleNumber'),'84.375');
  });
  await test('T20: Overlapping far spots are withheld in sampling mode; ideal mode is explicit',async()=>{
    await load();await page.click('[data-preset=overlap]');await expectText('leftDepth',/Unresolved spots/);await expectText('estimate',/Unavailable/);await expectText('status',/overlap|one pixel/);
    await page.selectOption('#zoom','8');await expectText('leftDepth',/Unresolved spots/);await expectText('image-note',/physical sensor bounds stay/);
    await page.selectOption('#resolution','0');await expectText('leftDepth',/14\.500/);await expectText('estimate',/0\.00°/);await expectText('status',/Ideal geometry/);
    await page.locator('#camera').screenshot({path:path.join(evidence,'far-spots-zoomed.png')});
  });
  await test('T21: Exact JSON export reproduces inverse depth without rounded-table mismatch',async()=>{
    await load('?z=15&x=0&s=0.1&f=0.1&resolution=0');const pending=page.waitForEvent('download');await page.click('#export');const download=await pending;const location=await download.path();const data=JSON.parse(await fs.readFile(location,'utf8'));
    assert.equal(data.state.z,15);assert.equal(data.geometry.left.z,14.5);assert.ok(Math.abs(-data.state.f*data.state.s/data.geometry.left.u-14.5)<1e-12);assert.equal(data.measurement.faceTiltDegrees,0);
    await download.saveAs(path.join(evidence,'exact-readings.json'));
  });
  await test('T24: Entire cuboid fits at allowed depth/lateral extremes',async()=>{
    await load('?z=15&x=4&angle=60&s=2&f=2');const bounds=await page.locator('#top-object').evaluate(e=>{const b=e.getBBox(),v=e.ownerSVGElement.viewBox.baseVal;return {l:b.x,t:b.y,r:b.x+b.width,b:b.y+b.height,w:v.width,h:v.height};});
    assert.ok(bounds.l>=0&&bounds.t>=0&&bounds.r<=bounds.w&&bounds.b<=bounds.h);
  });
  await test('Scene links load exact values and reject invalid query parameters safely',async()=>{
    await load('?z=5&x=-1&angle=-30&s=0.75&f=0.8&resolution=1280&zoom=2');for(const [key,val] of Object.entries({z:'5',x:'-1',angle:'-30',s:'0.75',f:'0.8'}))assert.equal(await page.inputValue('#'+key+'Number'),val);
    assert.equal(await page.inputValue('#resolution'),'1280');assert.equal(await page.inputValue('#zoom'),'2');await load('?z=99&x=oops&s=0&f=Infinity');await expectText('notice',/Invalid scene-link values ignored/);await expectText('leftDepth',/2\.500/);
  });
  await test('Share button supplies a reproducible scene URL',async()=>{
    await load('?z=5&x=0&angle=30');await context.grantPermissions(['clipboard-read','clipboard-write'],{origin:new URL(base).origin});await page.click('#share');await page.waitForFunction(()=>document.getElementById('notice').textContent.includes('Scene link copied'));await expectText('notice',/Scene link copied/);
    const copied=await page.evaluate(()=>navigator.clipboard.readText());const u=new URL(copied);assert.equal(u.searchParams.get('angle'),'30');assert.equal(u.searchParams.get('z'),'5');
  });

  await test('Share denial provides an ordinary reproducible-link fallback',async()=>{
    await load('?z=5&x=0&angle=-30');await page.evaluate(()=>Object.defineProperty(navigator.clipboard,'writeText',{configurable:true,value:()=>Promise.reject(new Error('Simulated clipboard denial'))}));
    await page.click('#share');await page.locator('#notice a').waitFor();const link=new URL(await page.locator('#notice a').getAttribute('href'));assert.equal(link.searchParams.get('angle'),'-30');
  });

  await test('T25: 390px mobile layout, readable plot text, sticky results and touch drag',async()=>{
    const mobile=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});const mp=await mobile.newPage();mp.on('pageerror',e=>errors.push(e.message));await mp.goto(base);await mp.waitForTimeout(120);
    assert.ok(await mp.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await mp.locator('#angleNumber').fill('-30');await mp.locator('#angleNumber').press('Enter');assert.equal(await mp.inputValue('#angle'),'-30');
    await mp.locator('#reset').tap();await mp.locator('#top').scrollIntoViewIfNeeded();await mp.waitForTimeout(100);
    const handle=await mp.locator('#drag-handle').boundingBox(),client=await mobile.newCDPSession(mp);const start={x:handle.x+handle.width/2,y:handle.y+handle.height/2};
    await client.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{...start,id:0}]});
    for(let i=1;i<=6;i++)await client.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+i*6,y:start.y-i*2,id:0}]});
    await client.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});assert.ok(Number(await mp.inputValue('#zNumber'))>3);
    const sticky=await mp.locator('.live-summary').boundingBox();assert.ok(sticky.y>=-1&&sticky.y<2);
    const font=await mp.locator('#top text').first().evaluate(e=>{const s=e.ownerSVGElement;return parseFloat(getComputedStyle(e).fontSize)*s.clientWidth/s.viewBox.baseVal.width;});assert.ok(font>=10);
    await mp.screenshot({path:path.join(evidence,'mobile-touch.png'),fullPage:true});await mp.locator('#camera').screenshot({path:path.join(evidence,'mobile-camera.png')});await mobile.close();
  });
  await test('T25: 320px and 768px widths have no page-level horizontal overflow',async()=>{
    for(const width of [320,768]){await page.setViewportSize({width,height:900});await load();assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow at ${width}px`);}
    await page.setViewportSize({width:1440,height:1000});
  });
  await test('No application exceptions or failed assets during browser cases',async()=>{assert.deepEqual(errors,[]);assert.deepEqual(networkFailures,[]);});
} finally {
  const result={url:base,channel:process.env.BROWSER_CHANNEL||'chrome',browser:await browser.version(),tests:results,pass:results.filter(t=>t.status==='PASS').length,fail:results.filter(t=>t.status==='FAIL').length,pageErrors:errors,failedRequests:networkFailures,limits:`${process.env.BROWSER_CHANNEL||'chrome'} headless; mobile is emulated touch, not a physical phone.`};
  await fs.writeFile(path.join(evidence,'browser-results.json'),JSON.stringify(result,null,2)+'\n');await browser.close();
  if(result.fail)process.exitCode=1;
  console.log(`Browser results: ${result.pass} passed, ${result.fail} failed.`);
}
