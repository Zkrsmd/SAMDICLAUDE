import zipfile, re, json, sys
import xml.etree.ElementTree as ET
ns={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
z=zipfile.ZipFile(sys.argv[1])
print(z.namelist(), file=sys.stderr)
ss=[]
if 'xl/sharedStrings.xml' in z.namelist():
    r=ET.fromstring(z.read('xl/sharedStrings.xml'))
    for si in r.findall('m:si',ns):
        ss.append(''.join(t.text or '' for t in si.iter('{%s}t'%ns['m'])))
def col(ref):
    s=re.match(r'[A-Z]+',ref).group(0); n=0
    for ch in s: n=n*26+ord(ch)-64
    return n-1
out={}
for name in z.namelist():
    if not name.startswith('xl/worksheets/sheet'): continue
    r=ET.fromstring(z.read(name)); rows=[]
    for row in r.iter('{%s}row'%ns['m']):
        vals={}
        for c in row.findall('m:c',ns):
            v=c.find('m:v',ns); t=c.get('t'); txt=None
            if t=='s' and v is not None: txt=ss[int(v.text)]
            elif t=='inlineStr':
                txt=''.join(x.text or '' for x in c.iter('{%s}t'%ns['m']))
            elif v is not None: txt=v.text
            vals[col(c.get('r'))]=txt
        if vals:
            m=max(vals)+1; rows.append([vals.get(i) for i in range(m)])
    out[name]=rows
json.dump(out, open(sys.argv[2],'w',encoding='utf-8'), ensure_ascii=False, indent=0)
for k,v in out.items(): print(k, len(v), 'rows; header:', v[0] if v else None)
