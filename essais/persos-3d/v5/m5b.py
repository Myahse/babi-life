import json,sys,os
D=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,D)
import m
from m import req,run,dl
m.W=os.path.join(D,'v5'); W=m.W
t=run('koffi5_mesh','/v1/image-to-3d',{'input_task_id':json.load(open(D+'/v2/koffi_img.json'))['id'],'model_type':'smart-topology','ai_model':'meshy-t2.5','target_polycount':10000,'texture_model':'meshy-n1','pose_mode':'a-pose','target_formats':['glb']})
if t and t['status']=='SUCCEEDED':
    rg=run('koffi5_rig','/v1/rigging',{'input_task_id':t['id'],'height_meters':1.82})
    if rg and rg['status']=='SUCCEEDED': print(dl(rg['result']['rigged_character_glb_url'],W+'/koffi5_rig.glb'))
print(req('GET','/v1/balance'))
