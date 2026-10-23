const fs=require('node:fs'),vm=require('node:vm');
const src=fs.readFileSync('app.js','utf8').split('function hydrate(')[0];
const assets=Object.fromEntries(fs.readdirSync('assets').filter(p=>p.endsWith('.webp')).map(p=>[p.replace('.webp',''),'data:image/webp;base64,embedded']));
const sandbox={ASSETS:assets,document:{querySelector:()=>({})},matchMedia:()=>({matches:false}),URLSearchParams};
vm.createContext(sandbox);vm.runInContext(src+';this.pages=Object.fromEntries(Object.entries(routes).map(([p,f])=>[p,f()]));',sandbox);
const pages=sandbox.pages,issues=[];
for(const [route,markup] of Object.entries(pages)){
 if(!markup.includes('<h1>'))issues.push([route,'Missing h1']);
 if(markup.includes('undefined'))issues.push([route,'Missing asset or value']);
 for(const m of markup.matchAll(/href="#([^" ]+)"/g)){
  let target=m[1].split('?')[0];if(!target.startsWith('/'))continue;
  if(!pages[target])issues.push([route,'Missing route '+target]);
 }
}
console.log(JSON.stringify({routes:Object.keys(pages).length,issues},null,2));if(issues.length)process.exitCode=1;
