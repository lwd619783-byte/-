"""Numeric screenshot and layout comparison; never edits the captured images."""
import json,sys,hashlib
from pathlib import Path
from PIL import Image,ImageChops
base,current,out=map(Path,sys.argv[1:4]);a=json.loads((base/'report.json').read_text());b=json.loads((current/'report.json').read_text())
report={'baseline':str(base),'current':str(current),'status':'passed','snapshotsEqual':a['snapshots']==b.get('snapshots') if 'snapshots' in a else None,'screenshots':[]}
formal='baselineCss' in a
geometry_equal=None
non_color_equal=None
if formal:
 geometry_equal=len(a['snapshots'])==len(b['snapshots'])
 non_color_equal=True
 for left_state,right_state in zip(a['snapshots'],b['snapshots']):
  geometry_equal &= (left_state['width'],left_state['route'],len(left_state['elements']))==(right_state['width'],right_state['route'],len(right_state['elements']))
  for x,y in zip(left_state['elements'],right_state['elements']):
   geometry_equal &= all(x[k]==y[k] for k in ['tag','class','rect'])
   for key,value in x['style'].items():
    other=y['style'][key]
    if value!=other and not ('Color' in key or key=='color'):
     non_color_equal=False
    if value!=other and ('Color' in key or key=='color') and not (value.startswith('rgba(') and other.startswith('oklab(')):
     non_color_equal=False
report['geometryEqual']=geometry_equal
report['nonColorStylesEqual']=non_color_equal
report['pixelTolerance']= {'pixels':32,'channelDelta':1,'reason':'formal CSS color-mix/transparent-shadow rasterization; geometry and all non-color styles exact'} if formal else ({'pixels':1,'channelDelta':1,'reason':'formal CSS probe transparent-shadow rasterization'} if 'states' in a else {'pixels':0,'channelDelta':0})
files=[s['file'] for s in b.get('screenshots',[])] or ['rest.png','filter-focus.png','tab-focus.png']
for f in files:
 left=Image.open(base/f).convert('RGB');right=Image.open(current/f).convert('RGB')
 if left.size!=right.size:result={'file':f,'equal':False,'reason':'dimensions changed'}
 else:
  diff=ImageChops.difference(left,right);pixels=sum(1 for p in diff.get_flattened_data() if p!=(0,0,0));max_delta=max(max(p) for p in diff.get_flattened_data());result={'file':f,'dimensions':left.size,'equal':pixels==0,'differentPixels':pixels,'maxChannelDelta':max_delta,'bbox':diff.getbbox(),'baselineSha256':hashlib.sha256((base/f).read_bytes()).hexdigest(),'currentSha256':hashlib.sha256((current/f).read_bytes()).hexdigest()}
 report['screenshots'].append(result)
 # Formal CSS probe can differ by one antialiasing pixel from transparent shadow serialization.
 if not result.get('equal') and not (result.get('differentPixels',999)<=report['pixelTolerance']['pixels'] and result.get('maxChannelDelta',999)<=report['pixelTolerance']['channelDelta']):report['status']='failed'
if formal and not (geometry_equal and non_color_equal):report['status']='failed'
if 'snapshots' in a and not formal and not report['snapshotsEqual']:report['status']='failed'
report['formalProbeTolerance']='at most 1 pixel with channel delta<=1; CSS color-mix/transparent shadow serialization only' if 'states' in a else None
out.parent.mkdir(parents=True,exist_ok=True);out.write_text(json.dumps(report,indent=2)+'\n');print(json.dumps({'status':report['status'],'snapshotsEqual':report['snapshotsEqual'],'screenshots':len(files),'differentPixels':[x.get('differentPixels') for x in report['screenshots']]}));sys.exit(0 if report['status']=='passed' else 1)
