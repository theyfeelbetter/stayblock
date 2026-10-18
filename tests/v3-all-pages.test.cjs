'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..');
const pages=['index.html','app.html','pricing.html','invite.html','beta.html'];
const css=fs.readFileSync(path.join(root,'ui/v3-unified.css'),'utf8');
for(const p of pages){
 test('V3 common design loaded on '+p,()=>{
  const h=fs.readFileSync(path.join(root,p),'utf8');
  assert.match(h,/<link\s+rel="stylesheet"\s+href="ui\/v3-unified\.css">/);
  assert.match(h,/<\/head>/i);
  assert.ok(h.indexOf('v3-unified.css')<h.indexOf('<body'));
 });
}
test('all approved V3 core palette tokens in unified CSS',()=>{
 for(const color of ['#F5F7FC','#292750','#434180','#FFB8BA','#D1D0ED'])assert.ok(css.includes(color));
});
test('original marketing homepage content and beta form retained',()=>{
 const home=fs.readFileSync(path.join(root,'index.html'),'utf8');
 const app=fs.readFileSync(path.join(root,'app.html'),'utf8');
 const beta=fs.readFileSync(path.join(root,'beta.html'),'utf8');
 assert.match(home,/class="bento-grid"/);assert.match(app,/initAuth\(\)/);
 assert.match(beta,/id="loginForm"/);assert.match(beta,/id="bookingForm"/);
});
