import json,sys,os,base64
D=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,D)
import m,m2
from m import req,wait,dl,run
m.W=os.path.join(D,'v3'); W=m.W; V2=os.path.join(D,'v2')
os.makedirs(W,exist_ok=True)
def jid(p): return json.load(open(p))['id']
def uri(p): return 'data:image/png;base64,'+base64.b64encode(open(p,'rb').read()).decode()
REFS=[uri(os.path.join(V2,f)) for f in m2.REFS]
STYLE_CHILD=m2.STYLE2.replace("Clearly an ADULT (never a child).","Clearly a CHILD of about 8 years old (never an adult): child proportions about 4.5 heads tall, bigger head, short torso, thin legs, round cheeks, innocent happy face.").replace("tall leggy proportions about 6.5 heads tall, very long thin legs, long thin arms, small short torso, narrow waist, slim neck; slim angular face with sharp jaw, small nose, cool confident attitude;","thin limbs, slim neck, small nose;")
CH3={
'yao':"Character: Yao, a cheerful 8-year-old schoolboy. Hair: very short glossy sculpted black hair. Eyes visible. Outfit: Ivorian primary school uniform: plain khaki short-sleeved shirt with a small collar and plain khaki shorts above the knees, white socks, simple brown sandals, a small blue backpack on his back. No logo, no badge.",
'body2':"Character: Mariam, a slim young woman, 25. Hair: glossy sculpted short bob with a side part. Eyes visible, confident smile. Outfit: elegant going-out look: fitted magenta blazer with rolled sleeves over a white top, a gold chain necklace close around the base of the neck, long straight skirt in African wax print (turquoise, yellow and black large motifs) down to the ankles with a side slit, yellow heeled sandals, gold bangles.",
}
def img(n,style):
    t=run(n+'_img','/v1/image-to-image',{'ai_model':'nano-banana-pro','reference_image_urls':REFS,'aspect_ratio':'3:4','prompt':style+' '+CH3[n]})
    if t and t['status']=='SUCCEEDED': dl(t['image_urls'][0],f'{W}/{n}_img.png'); return t
def mesh_rig(n,h):
    t=run(n+'_mesh','/v1/image-to-3d',{'input_task_id':jid(f'{W}/{n}_img.json'),'model_type':'smart-topology','ai_model':'meshy-t2.5','target_polycount':10000,'texture_model':'meshy-n1','pose_mode':'a-pose','target_formats':['glb']})
    if not t or t['status']!='SUCCEEDED': return
    rig(n,t['id'],h)
def rig(n,mesh_id,h):
    rg=run(n+'_rig','/v1/rigging',{'input_task_id':mesh_id,'height_meters':h})
    if not rg or rg['status']!='SUCCEEDED': return
    r=rg['result']; dl(r['rigged_character_glb_url'],f'{W}/{n}_rig.glb')
    ba=r.get('basic_animations') or {}
    for k in ('walking','running'):
        if ba.get(k+'_glb_url'): dl(ba[k+'_glb_url'],f'{W}/{n}_{k}.glb')
if __name__=='__main__':
    c=sys.argv[1]
    if c=='awa24': rig('awa24',jid(f'{V2}/awa_mesh.json'),1.72)
    elif c=='child':
        if img('yao',STYLE_CHILD): mesh_rig('yao',1.25)
    elif c=='body2':
        if img('body2',m2.STYLE2): mesh_rig('body2',1.72)
    elif c=='retex':
        # (i) text prompt, Meshy 7, same UV layout
        t=run('awa_rt1','/v1/retexture',{'input_task_id':jid(f'{V2}/awa_mesh.json'),'ai_model':'meshy-7','enable_original_uv':True,
          'text_style_prompt':"Same stylised glossy cartoon character, same dark brown skin, same face, same black glossy afro puffs with gold bands and gold hoop earrings. New outfit: crop top in pink and yellow African wax print with large motifs, plain bright red baggy trousers with white side stripes, white and black sneakers. Flat clean saturated colours, no text, no logos."})
        if t and t['status']=='SUCCEEDED':
            print(json.dumps({k:v for k,v in t.items() if k.endswith('urls')})[:300]); dl(t['model_urls']['glb'],f'{W}/awa_rt1.glb')
    elif c=='retex2':
        # (ii) edit the concept image (clothes only), then Meshy N1 retexture from that image
        e=run('awa_edit','/v1/image-to-image',{'ai_model':'nano-banana-pro','input_task_id':jid(f'{V2}/awa_img.json'),'aspect_ratio':'3:4',
          'prompt':"Keep this exact character, face, hair, skin, pose, proportions, camera and background strictly unchanged. Change ONLY the clothes: the crop top becomes a white crop top with a purple and yellow African wax-print pattern, the baggy cargo trousers become bright yellow with purple side stripes, the sneakers become purple and white. Same shapes and silhouette of every garment."})
        if e and e['status']=='SUCCEEDED':
            dl(e['image_urls'][0],f'{W}/awa_edit.png')
            t=run('awa_rt2','/v1/retexture',{'input_task_id':jid(f'{V2}/awa_mesh.json'),'ai_model':'meshy-n1','enable_original_uv':True,'image_style_url':e['image_urls'][0]})
            if t and t['status']=='SUCCEEDED': dl(t['model_urls']['glb'],f'{W}/awa_rt2.glb')
    elif c=='t2m':
        for n,p in (('eat',"A person standing, holding a bowl in the left hand at chest height, eating with the right hand: the right hand takes food from the bowl and brings it to the mouth, repeatedly."),
                    ('pound',"A person standing, holding a long heavy wooden pestle vertically with both hands, pounding it up and down into a mortar on the ground in front of them, rhythmically.")):
            t=run('t2m_'+n,'/v1/text-to-motion',{'prompt':p,'mode':'swift','duration':6})
            if not t or t['status']!='SUCCEEDED': continue
            print(json.dumps(t.get('result') or t)[:400])
            a=run('koffi_'+n,'/v1/animations',{'rig_task_id':jid(f'{V2}/koffi_rig.json'),'motion_task_id':t['id']})
            if a and a['status']=='SUCCEEDED': dl(a['result']['animation_glb_url'],f'{W}/koffi_{n}.glb')
    print(req('GET','/v1/balance'))
