from pathlib import Path
from PIL import Image
import base64,json,re
root=Path(__file__).parent
assets={}
source=(root/'app.js').read_text()+(root/'shell.html').read_text()
quality={'hero-ink-landscape':(2170,82),'finn-robot':(450,86),'bldc-motor-cutaway':(760,85),'drone-components-sheet':(1536,90),'hero-cloud-a':(1500,90),'hero-cloud-b':(1150,90),'hero-cloud-c':(820,90)}
sprite_cells={'journey-balloon-sprite':256,'maple-breeze-sprite':192,'pine-breeze-sprite':256,'sketch-compass-sprite':256,'inquiry-hand-sprite':362}
for p in (root/'assets/generated').glob('*.png'):
 if p.stem not in source: continue
 out=root/'assets'/f'{p.stem}.webp'
 if not out.exists():
  im=Image.open(p)
  if p.stem in sprite_cells:
   cell=sprite_cells[p.stem];im=im.resize((cell*4,cell*3),Image.Resampling.LANCZOS);q=85 if p.stem=='inquiry-hand-sprite' else 83
  else:
   w,q=quality.get(p.stem,(1100,82));im.thumbnail((w,1600))
  im.save(out,'WEBP',quality=q,method=6)
for p in (root/'assets').glob('*.webp'):
 if p.stem not in source: continue
 assets[p.stem]='data:image/webp;base64,'+base64.b64encode(p.read_bytes()).decode()
fonts=''
for f,family,weight,style in [('sans','DM Sans','400','normal'),('sans-bold','DM Sans','700','normal'),('serif','Instrument','400','normal'),('serif-italic','Instrument','400','italic')]:
 d=base64.b64encode((root/'assets'/f'{f}.woff').read_bytes()).decode()
 fonts+=f'@font-face{{font-family:"{family}";font-style:{style};font-weight:{weight};font-display:swap;src:url(data:font/woff;base64,{d}) format("woff");}}\n'
html=(root/'shell.html').read_text().replace('/* FONTS */',fonts).replace('/* STYLES */',(root/'style.css').read_text()).replace('/* ANIME */',(root/'research/anime.js').read_text()).replace('/* ASSETS */','const ASSETS='+json.dumps(assets,separators=(',',':'))+';').replace('/* APP */',(root/'app.js').read_text())
assert '</script>' not in (root/'app.js').read_text()
html=html.replace('</head>',f'<link rel="icon" type="image/webp" href="{assets["nav-logo"]}"></head>')
(root/'index.html').write_text(html)
print(f'{len(assets)} embedded images; {len(html.encode())/1024/1024:.2f} MiB; {len(re.findall("routes",html))} route references')
