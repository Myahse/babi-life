import json,sys,os
D=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,D)
import m
from m import req,run,dl
m.W=os.path.join(D,'v5')
name,src=sys.argv[1],sys.argv[2]
P=("Character expression sheet of this EXACT same character (same face, same skin, same hair, same earrings, same top, same 3D render style and materials). "
"One image containing a grid of 6 head-and-shoulders portraits, 3 columns by 2 rows, every portrait the same size, the same straight front view, the same framing and head position, the same soft even lighting, plain light grey background, thin white gaps between the cells, no text, no labels. "
"Top row, left to right: 1) neutral relaxed face, mouth closed, eyes open; 2) gentle closed-mouth smile; 3) laughing happily, mouth open showing teeth, eyes squeezed into happy arcs. "
"Bottom row, left to right: 4) sad, corners of the mouth down, inner eyebrows raised; 5) surprised, eyebrows up, eyes wide, small open mouth; 6) eyes fully closed with relaxed lids, neutral closed mouth.")
t=run(name+'_sheet','/v1/image-to-image',{'ai_model':'nano-banana-pro','input_task_id':json.load(open(src))['id'],'aspect_ratio':'4:3','prompt':P})
if t and t['status']=='SUCCEEDED': print(dl(t['image_urls'][0],f'{m.W}/{name}_sheet.png'))
print(req('GET','/v1/balance'))
