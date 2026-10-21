const test=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const app=fs.readFileSync(path.join(__dirname,'..','app.html'),'utf8');const tokens=fs.readFileSync(path.join(__dirname,'..','ui','v3-tokens.css'),'utf8');
test('approved V3 palette is versioned and applied as a scoped visual-only layer',()=>{for(const v of ['#F5F7FC','#292750','#434180','#FFB8BA','#D1D0ED'])assert.ok(tokens.includes(v),v);assert.match(app,/V3 visual-only app port/)});
test('existing login and reservation functions are not intentionally replaced in visual slice',()=>{assert.match(app,/initAuth\(\);/);assert.match(app,/function save\(\)/);assert.match(app,/function renderList\(/)});
test('no app deployment or storage rewrite introduced by standalone V3 tokens',()=>{assert.doesNotMatch(tokens,/localStorage|fetch\s*\(|https?:\/\//);assert.doesNotMatch(tokens,/@import|url\(/)});
