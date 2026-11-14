import json,sys,base64,os
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
import m
from m import req,wait,dl,run
m.W=os.path.join(os.path.dirname(os.path.abspath(__file__)),'v2')
W=m.W
REFS=['ref_front.png','ref_34.png','ref_face.png']
STYLE2=("The reference images show the ART STYLE to copy exactly (same game, same character artist): a stylised 3D fashion-cartoon game character. "
"Copy ONLY the style: tall leggy proportions about 6.5 heads tall, very long thin legs, long thin arms, small short torso, narrow waist, slim neck; "
"slim angular face with sharp jaw, small nose, cool confident attitude; big sculpted glossy hair made of a few large smooth shiny lobes like polished vinyl; "
"clean smooth glossy materials with crisp specular highlights, flat saturated colours with simple graphic details, sharp fashion silhouette, trendy streetwear with accessories. "
"NOT clay, NOT soft Pixar look, NOT realistic, NOT chibi, NOT voxel. "
"Create a NEW ORIGINAL character in this style: a different person with a different face, different hair and a different outfit from the reference. Do not reproduce the reference character, her yellow trousers, her headphones or her glasses. "
"Clearly an ADULT (never a child). West African (Ivorian), dark brown skin. "
"Render: one single character, full body from head to shoes, straight front view, standing in a neutral A-pose (arms straight, held 45 degrees away from the body, legs slightly apart, open hands with separated fingers), "
"plain light grey studio background, soft even lighting, no cast shadow, no text, no logos, no brand marks, no numbers.")
CH2={
'awa':"Character: Awa, a slim young woman, 22. Hair: two big glossy sculpted afro puffs high on the head, each tied with a wide gold band, sleek edges. Small round ears with big gold hoop earrings, eyes visible (no glasses), confident half-smile. Outfit: fitted crop top in bold African wax-print fabric (orange, royal blue and green large graphic motifs), wide baggy cargo trousers in deep teal with orange side stripes and gathered ankle cuffs, chunky white and orange sneakers, thin gold bracelets.",
'koffi':"Character: Koffi, an athletic young man, 23, broad shoulders, narrow hips, very long legs. Hair: tall glossy sculpted high-top fade with sharp edges and shaved sides. Eyes visible (no glasses), relaxed confident smile. Outfit: plain bright orange football jersey with one straight horizontal green band across the chest and a white collar, completely plain: no crest, no badge, no number, no writing; slim dark blue joggers with a white side stripe and ankle cuffs; a gold chain necklace; chunky white and green sneakers.",
'adjoua':"Character: Tantie Adjoua, a ROUND, plump, wide-hipped middle-aged woman, 50, same stylised family but stout: round body and round cheeks, still long thin lower legs and forearms, taller than five heads. Warm confident smile, eyes visible, round tinted purple sunglasses pushed up on the headwrap. Head: a very big tall glossy knotted headwrap in African wax print (yellow, magenta and royal blue large motifs) covering all her hair. Outfit: matching kaba dress in the same wax print with big puffed short sleeves, fitted at the bust and flared, ending just below the knees, gold bead necklace, gold bangles, flat leather sandals.",
}
def uri(f): return 'data:image/png;base64,'+base64.b64encode(open(os.path.join(W,f),'rb').read()).decode()
if __name__=='__main__':
    cmd=sys.argv[1]; n=sys.argv[2]
    if cmd=='img':
        t=run(n+'_img','/v1/image-to-image',{'ai_model':'nano-banana-pro','reference_image_urls':[uri(f) for f in REFS],'aspect_ratio':'3:4','prompt':STYLE2+' '+CH2[n]})
        if t and t['status']=='SUCCEEDED': print(dl(t['image_urls'][0],f'{W}/{n}_img.png'))
    elif cmd=='all':  # mesh -> rig -> anim ; args: name height actions fingers(0/1)
        img=json.load(open(f'{W}/{n}_img.json'))['id']
        t=run(n+'_mesh','/v1/image-to-3d',{'input_task_id':img,'model_type':'smart-topology','ai_model':'meshy-t2.5','target_polycount':10000,'texture_model':'meshy-n1','pose_mode':'a-pose','target_formats':['glb']})
        if not t or t['status']!='SUCCEEDED': sys.exit(1)
        body={'input_task_id':t['id'],'height_meters':float(sys.argv[3])}
        if sys.argv[5]=='1': body['include_fingers']=True
        rg=run(n+'_rig','/v1/rigging',body)
        if not rg or rg['status']!='SUCCEEDED': sys.exit(1)
        r=rg['result']; print(json.dumps(r)[:300]); dl(r['rigged_character_glb_url'],f'{W}/{n}_rig.glb')
        ba=r.get('basic_animations') or {}
        if ba.get('walking_glb_url'): dl(ba['walking_glb_url'],f'{W}/{n}_walking.glb')
        a=run(n+'_anim','/v1/animations',{'rig_task_id':rg['id'],'action_ids':[int(x) for x in sys.argv[4].split(',')]})
        if a and a['status']=='SUCCEEDED': print(dl(a['result']['animation_glb_url'],f'{W}/{n}_anim.glb'))
    print(req('GET','/v1/balance'))
