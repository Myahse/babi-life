# Meshy look test — Awa, Koffi, Tantie Adjoua (2026-11-13)

Nothing committed. Credits: 901 before, 737 after = **164 spent** (cap 250).

## Pipeline used (all through api.meshy.ai/openapi)
1. Concept image, A-pose: `POST /v1/text-to-image` `nano-banana-pro` + `pose_mode: a-pose` (9 cr). Awa first, from a shared style prompt.
2. Style consistency: Koffi and Adjoua made with `POST /v1/image-to-image` (`nano-banana-pro`, 9 cr) using Awa's image task as style reference + the same style prompt.
3. Mesh + texture in one task: `POST /v1/image-to-3d` `model_type: smart-topology`, `ai_model: meshy-t2.5`, `target_polycount: 9000`, `texture_model: meshy-n1`, `pose_mode: a-pose`, GLB only (15 cr). No separate remesh needed.
4. `POST /v1/rigging` (5 cr): 24-bone `meshyrig` skeleton, walk + run clips included for free.
5. `POST /v1/animations` with `action_ids` (3 cr per action): one GLB holding one clip per action.

Shared style prompt and the three character prompts are in the scratchpad script `m.py` (STYLE / CH).

## Results
| | triangles | Meshy GLB (2K PNG texture, 4 clips) | with 1K JPEG texture (`*-1k.glb`) | clips |
|---|---|---|---|---|
| Awa | 9 434 | 3.45 MB | 0.98 MB | Idle, Wave_One_Hand, All_Night_Dance, Chair_Sit_Idle_F + walk/run |
| Koffi (v1, N1 texture) | 9 255 | 3.16 MB | 0.91 MB | Idle, Wave_One_Hand, Hip_Hop_Dance, Chair_Sit_Idle_M + walk/run |
| Tantie Adjoua | 9 237 | 4.45 MB | 1.06 MB | Idle, Wave_One_Hand, FunnyDancing_01, Chair_Sit_Idle_F + walk/run |
| Koffi v2 (15k, Meshy-7 texture) | 15 341 | 4.14 MB | 1.37 MB | same as Koffi |
| Michelle (reference) | 28 106 | 3.28 MB | | 65 bones |

One mesh, one material, one base-colour texture per character (1 draw call each). Walk is a separate file (`*-walk.glb`) from the rig task; same skeleton, the clip plays on the animated model directly.

## Credits
| step | Awa | Koffi | Adjoua |
|---|---|---|---|
| concept image | 18 (2 tries: first one looked like a child) | 9 | 9 |
| image-to-3D 9k + texture | 15 | 15 | 15 |
| rig (+walk, run) | 5 | 5 | 5 |
| 4 library clips | 12 | 12 | 12 |
| total | 50 | 41 | 41 |
Koffi second attempt (15k + Meshy-7 texture + rig + 4 clips): 32. Grand total 164.

Budget: **about 41 credits per character** with one attempt and 4 clips (29 without library clips: walk/run come with the rig). Count ~55–60 with a realistic retry rate. 30 characters ≈ 1 250–1 800 credits, 50 characters ≈ 2 050–3 000.

## Gotchas
- Meshy GLBs are `doubleSided`: under three.js shadow maps this gives stripe acne on every surface. The lab sets `material.side = FrontSide` and `shadow.normalBias = 0.02`.
- Default rig files are in centimetres; scale to the wanted height on load.
- Download URLs are signed and tasks expire (rig task `expires_at` ~3 days): download at once.
- `GET /v1/usage/tasks` answers "available on Studio and Enterprise plans" for this key.

## Files
meshy-test.mp4 (1080×1920, 20 s), awa.png, koffi.png, adjoua.png, groupe.png, assis.png (chair-sit clip), koffi-v2.png,
`<name>.glb` (Meshy output with 4 clips), `<name>-walk.glb`, `<name>-1k.glb` (texture re-encoded), `<name>-concept.png`, lab.html (page source).


---

# Round 2 — Michelle as the base style (2026-11-14)

Credits: 737 before, 614 after = **123 spent** (cap 150). 41 per character (9 image + 15 mesh/texture + 5 rig + 12 for 4 clips), one attempt each. Outputs in `v2/`.

## Recipe that gives this style (reuse as is for every new character)
1. **Style reference images**: three stills of Michelle on a plain light grey background, rendered by `v2/ref.html` (T-pose clip, 768x1024): `ref_front.png` (front, full body), `ref_34.png` (3/4, full body), `ref_face.png` (head and shoulders). Sent as base64 data URIs.
2. **Concept image**: `POST /openapi/v1/image-to-image`
   - `ai_model: "nano-banana-pro"`, `aspect_ratio: "3:4"`, `reference_image_urls: [ref_front, ref_34, ref_face]`
   - `prompt` = STYLE2 + " " + character line (below). Image-to-image has no `pose_mode`, so the A-pose is in the prompt.
3. **3D**: `POST /openapi/v1/image-to-3d` with `input_task_id` = the image task, `model_type: "smart-topology"`, `ai_model: "meshy-t2.5"`, `target_polycount: 10000`, `texture_model: "meshy-n1"`, `pose_mode: "a-pose"`, `target_formats: ["glb"]`.
4. **Rig**: `POST /openapi/v1/rigging` `input_task_id`, `height_meters` (1.72 / 1.82 / 1.62). `include_fingers: true` only on Awa v2.
5. **Clips**: `POST /openapi/v1/animations` `rig_task_id`, `action_ids`: 0 Idle, 290 Wave One Hand, a dance (64 All Night Dance / 591 Hip Hop Dance / 22 Funny Dancing 1), 32 or 33 Chair Sit Idle F/M. Walk and run come with the rig task.
6. **In three.js**: `material.side = FrontSide`; Meshy exports one material with roughness 0.55, the v2 stills/video use **roughness 0.4** to get closer to Michelle's glossy look (`?gloss=0.4` in the lab). Texture re-encoded to 1K JPEG gives ~1 MB files (`*-1k.glb`).

### STYLE2 (shared, verbatim)
```
The reference images show the ART STYLE to copy exactly (same game, same character artist): a stylised 3D fashion-cartoon game character. Copy ONLY the style: tall leggy proportions about 6.5 heads tall, very long thin legs, long thin arms, small short torso, narrow waist, slim neck; slim angular face with sharp jaw, small nose, cool confident attitude; big sculpted glossy hair made of a few large smooth shiny lobes like polished vinyl; clean smooth glossy materials with crisp specular highlights, flat saturated colours with simple graphic details, sharp fashion silhouette, trendy streetwear with accessories. NOT clay, NOT soft Pixar look, NOT realistic, NOT chibi, NOT voxel. Create a NEW ORIGINAL character in this style: a different person with a different face, different hair and a different outfit from the reference. Do not reproduce the reference character, her yellow trousers, her headphones or her glasses. Clearly an ADULT (never a child). West African (Ivorian), dark brown skin. Render: one single character, full body from head to shoes, straight front view, standing in a neutral A-pose (arms straight, held 45 degrees away from the body, legs slightly apart, open hands with separated fingers), plain light grey studio background, soft even lighting, no cast shadow, no text, no logos, no brand marks, no numbers.
```
### Character lines (verbatim)
```
Awa: Character: Awa, a slim young woman, 22. Hair: two big glossy sculpted afro puffs high on the head, each tied with a wide gold band, sleek edges. Small round ears with big gold hoop earrings, eyes visible (no glasses), confident half-smile. Outfit: fitted crop top in bold African wax-print fabric (orange, royal blue and green large graphic motifs), wide baggy cargo trousers in deep teal with orange side stripes and gathered ankle cuffs, chunky white and orange sneakers, thin gold bracelets.

Koffi: Character: Koffi, an athletic young man, 23, broad shoulders, narrow hips, very long legs. Hair: tall glossy sculpted high-top fade with sharp edges and shaved sides. Eyes visible (no glasses), relaxed confident smile. Outfit: plain bright orange football jersey with one straight horizontal green band across the chest and a white collar, completely plain: no crest, no badge, no number, no writing; slim dark blue joggers with a white side stripe and ankle cuffs; a gold chain necklace; chunky white and green sneakers.

Tantie Adjoua: Character: Tantie Adjoua, a ROUND, plump, wide-hipped middle-aged woman, 50, same stylised family but stout: round body and round cheeks, still long thin lower legs and forearms, taller than five heads. Warm confident smile, eyes visible, round tinted purple sunglasses pushed up on the headwrap. Head: a very big tall glossy knotted headwrap in African wax print (yellow, magenta and royal blue large motifs) covering all her hair. Outfit: matching kaba dress in the same wax print with big puffed short sleeves, fitted at the bust and flared, ending just below the knees, gold bead necklace, gold bangles, flat leather sandals.
```
The same prompts as code: `v2/prompts.py`.

## Results v2
| | triangles | Meshy GLB | 1K JPEG version | bones |
|---|---|---|---|---|
| Awa v2 (fingers) | 10 494 | 4.02 MB | 1.58 MB | 66 |
| Koffi v2b | 10 446 | 3.52 MB | 0.94 MB | 24 |
| Tantie Adjoua v2 | 10 246 | 5.04 MB | 1.11 MB | 24 |

## include_fingers
Works (66 bones, Mixamo finger names, library clips carry finger tracks). Costs nothing more in credits, but: +0.6 MB of animation data per 4 clips, files come in metres with a different Hips parent frame, and the rig task's walk file (`retarget_clip`) no longer matches the clips file directly: the lab has to re-express the Hips tracks or the character falls flat on the ground. Visual gain at game distance is small (slightly relaxed fingers).


---

# Round 3 — working around the drawbacks (2026-11-14)

Credits: 614 before, 510 after = **104 spent** (cap 130). Outputs in `v3/`. Lab code: `v3/kit.js` (the work-arounds) + `v3/v3.html` (scenes), per-character face config `v3/fc.json`, API calls `v3/m3.py`.

| spend | credits |
|---|---|
| Awa v2 re-rigged without fingers (24 bones, so she shares clips) | 5 |
| Retexture, text prompt, Meshy 7, `enable_original_uv` | 10 |
| Concept edit (clothes only) 9 + Retexture Meshy N1 from that image 10 | 19 |
| Mariam (new body for head x body): image 9 + mesh 15 + rig 5 | 29 |
| Yao (child): image 9 + mesh 15 + rig 5 | 29 |
| Text-to-Motion swift x2 (3 each) + applying each to a rig (3 each) | 12 |

## 1. Living faces — works, needs polish
`findFace` + `buildFace` in kit.js. A copy of the front-of-head triangles, pushed 1.2 mm out, planar UVs, one 256 px canvas texture redrawn each frame: skin patches over the painted eyes/mouth, then eyes (gaze, blink, squint, wide), brows, mouth (neutral, smile, laugh, sad, surprised, talking). It rides the Head bone. 1 extra draw call, ~300-600 triangles per character.
- Automatic placement (eye whites in the texture, reddest band for the mouth) was right for 2 of 5 characters (Awa, Koffi). Mariam (teeth), Adjoua (sunglasses highlight) and Yao (black dot eyes) needed 3-4 numbers each in `fc.json`.
- Visible defects: faint ring where a skin patch meets the painted skin, painted eyebrows still show under the drawn ones, eyes stretch a little in profile.
- The texture-swap alternative (generated expressions reprojected) was not tried: each expression would be a 10-credit retexture per character and the face drifts between retextures.

## 2. Clothes
- (a) Retexture works: same mesh, same UVs (`enable_original_uv: true`), so the new texture drops onto the rigged model. Text prompt (Meshy 7, 10 cr) and edited concept image (N1, 19 cr) both gave a clean new outfit. The painted face changes slightly each time; the overlay face hides that.
- (b) Head x body works: `removeHead`, `headPiece`, `mountHead`. Head triangles of the donor as a rigid mesh on the body's Head bone, scaled by neck radius (clamped 0.95-1.06), body skin recoloured to the donor's skin, gold necklace ring on the neck bone over the seam. Costs +1 draw call and a second texture per character.
- (c) Accessories work: glasses, headphones, cap, cross-body bag as procedural meshes on Head/Spine bones, fitted from the detected eyes. Big hair collides with caps/headbands.
- (d) Zone recolouring works: zones = dominant bone group per texel (head/upper/lower/feet) x colour test (skin, gold, hair). Hue/sat/value per zone or a skin target, baked on CPU into a new texture, 0 credit. Limits: a garment that crosses the hip line (long shirt, dress) is split between "top" and "bottom"; only hue shifts, no new prints.

## 3. Gestures
- (a) Shared clips work: every 24-bone Meshy rig has the same bone names; `shareClip` keeps rotation tracks and rescales the Hips translation. Koffi's 7 clips drive Awa, Mariam, Adjoua and the child. Rigs made with `include_fingers` do not share (other frame) — avoid them.
- (b) CC0 library retarget (Quaternius): not done.
- (c) Text-to-Motion works but is approximate: `swift`, 6 s, 3 cr + 3 cr to apply to a rig. "Eating from a bowl" reads; "pounding with a pestle" is a vague two-hand up/down. Props are placed by the lab.
- (d) IK works: `reach` (two-bone CCD) on top of the chair-sit clip puts both hands on a turning steering wheel.

## 4. Look
`buildZones` + `splitMaterial`: a roughness map generated from the zones (hair 0.26, skin 0.62, cloth 0.9, shoes 0.5, gold 0.25). Still one material and one draw call. See `materiaux-avant-apres.png`.

## 5. Child
Yao, 8 years old, 10 332 triangles, 24 bones: generated, rigged and walking on the first attempt, with the shared adult clips. Prompt change: replace the "Clearly an ADULT" sentence by the child sentence in `m3.py` (STYLE_CHILD).

## 6. 20 characters (lab, 390x844, software GL)
| | draw calls | triangles (incl. shadow pass) | animation mixers, CPU x1 | CPU x4 |
|---|---|---|---|---|
| no LOD | 118 | 458 000 | 0.18 ms | 0.64 ms |
| far half: no shadow casting, animation every 3rd frame | 98 | 344 000 | 0.13 ms | 0.37 ms |
JS heap ~107-118 MB with 5 source characters loaded at 2K textures. GPU texture memory by arithmetic: 5 x 2K RGBA with mips = ~112 MB; at 1K = ~28 MB, plus ~28 MB for the 5 roughness maps (which could be 512 px). GPU frame time could not be measured here (software renderer: 144 ms per frame, not representative). No geometric LOD was built.


---

# Round 4 — living faces, polished (2026-11-14)

No Meshy credits spent (balance still 510). Outputs in `v4/`. Code: `v4/face4.js` (the face system), `v4/v4.html` (scenes), `v4/fc.json` (rough eye/mouth positions, from round 3) and `v4/fc4.json` (style per head).

## How it works (`buildFace4`)
1. The front of the head is unwrapped with a cylindrical projection around the head's vertical axis into a 256 px cell of one shared 1024x512 canvas atlas (8 heads per atlas, one material for everybody).
2. The painted face is rasterised into that cell from the model's own texture (far-to-near, so sculpted eye sockets do not scramble it).
3. Detection inside the cell, starting from the rough positions: painted eye = dark/bright blob (PCA gives width, height, tilt), painted brow = dark blob above it (length, thickness, angle, colour), painted mouth = red/dark blob (centre, width, lip colour).
4. Three feathered ellipses (each eye+brow, mouth) are inpainted from skin sampled just outside them (inverse-distance weighting), so the painted features disappear and the patch edge has the colour of the skin around it.
5. Each frame the cell is redrawn: inpainted skin, almond eyes (sclera shading, iris, pupil, highlight, shadow under the lid, upper lid at rest over the top of the iris, liner/lash wing, lower lid for squint), tapered brows, lips with teeth and tongue.
6. Animation: `live()` gives saccades, occasional wide glances and blinks (55 ms close, 155 ms open, sometimes double), lids follow the gaze; `EXPR4` = neutral, smile, laugh, sad, surprised, angry; `viseme()` is a 5-shape lip-sync loop.
7. The decal mesh keeps only the triangles under the three patches (581 to 1 416 per head), follows the Head bone, is depth-tested, and blends its normals with the cylinder normal to calm the sculpted relief. 1 draw call per character, 1 texture upload per frame for all faces; far characters can skip redraws (the game-distance scene is labelled 1 frame in 3).

## Adding a head
- Face build (unwrap + detect + inpaint): about 0.3 s per head in the lab, at load.
- Config per head: the rough eye/mouth position (3-4 numbers, needed for 3 of the 5 heads because the round-3 rough detector still misses them) plus optional style (`lashes`, `lid`, eye size override). For these five: Awa lashes + lid, Koffi eye size override, Mariam lashes, Yao lid, Adjoua lashes.
- Hand time: about 5 minutes per head with the debug view (`face4Debug`: painted unwrap, detected shapes, inpainted result).

## What still looks off
- Koffi is the weakest: his eyes are sculpted in relief, the decal follows the bumps and shows small torn-looking marks at the eye corners; his laugh arcs are faint.
- A slightly lighter or flatter patch can be seen on the forehead/around the eyes on Yao and Koffi in close-up (inpainted skin is smoother than the painted skin).
- Mariam: the brow under her fringe fell back to a default, and small specks remain at the hair edge.
- Yao's concept has black dot eyes; the drawn eyes give him brown irises, livelier but not the same design.
- Eyes are matched to the painted size (+12 %), so at game distance they read small; lips are simple shapes; no eye gloss (one roughness for the whole decal).


---

# Round 5 — faces: keep Meshy's painted face and make it move (2026-11-14)

Credits: 510 before, 481 after = **29 spent** (cap 40): Awa expression sheet 9, Koffi regenerated (mesh + texture 15, rig 5). Outputs in `v5/`. Code: `v5/face5.js` (approach A and B), `v5/v5.html`, `v5/align.py` (sheet to head alignment); `face4.js` is still used for the unwrap, the landmark detection and the skin fill behind the lids.

## A — the painted face, deformed (applied to all five)
- Nothing is redrawn. The unwrapped painted face is shown through one feathered patch and warped by a 26x26 mesh (Live2D style): mouth corners up/down, cheeks, brows up / inner-up / down, lower-lid squint, upper-lid lift, iris shifted a few pixels for glances, a modest mouth opening obtained by stretching the painted lip line.
- Blink: the character's own skin (sampled around the eye) closes over the painted eye along its outline, lash line on the edge, 45 ms close + 80 ms open, sometimes double.
- At rest the patch equals the texture under it, so there is no sticker or seam. The patch uses the model's own normals and front faces only.
- Body life on top of the clip (`bodyLife`): head nod / tilt / turn, shoulder and spine bounce on laugh, lean on sad.
- Cost: 1 draw call per character (785 to 1 583 triangles), the shared atlas, about 350-550 small canvas triangles redrawn per face per frame.

## B — expression sheet painted by the image model (Awa only)
- `image-to-image`, `nano-banana-pro`, 4:3, input = the character's concept image, prompt in `m5.py`: a 3x2 sheet (neutral, smile, laugh, sad, surprised, eyes closed), same view and framing. 9 credits. Identity and framing came out consistent on the first try.
- `align.py`: per-cell offset by template matching on the hairline, then a 3-point affine (two eyes + mouth) from the sheet to the head's face cell; colours are gain-matched to the painted skin. The sheet's neutral face replaces the painted one at rest (otherwise the face changes when an expression starts), expressions cross-fade, blink = the eyes-closed frame.
- The two eye and mouth positions in the sheet were read by hand (3 points for the neutral cell).

## Koffi
His first mesh had torn-looking sculpted eyes even untouched. Regenerated once from the same concept (`koffi-v5.glb`): clean painted eyes. They are still sculpted hollows, so his blink only covers the white; the iris area stays dark.


---

# Round 6 — basketball: block Sims vs the new characters (2026-11-14)

Credits: 481 before, 457 after = **24 spent** (cap 30): 8 library clips applied to Koffi's rig (3 each). Outputs in `v6/`.

## What runs in the demo
- **The game's real pose code.** `web/src/avatar/Human.tsx` (`usePoseRig` with its sport, emote, fight and job pose tables) is bundled unchanged with Vite into `v6/poserig.js`; React, react-three-fiber and the two renderer components are replaced by small stubs (`v6/pose-bundle/`). `makePoser(rig, seed)` re-runs the hook and its frame callback each step; time comes from the game's own `freezeWorldTime`.
- **« Aujourd'hui (blocs) »** is a stand-in figure: boxes on the game's joint layout and dimensions (BlockHuman constants), flat colours, not the game's textured renderer.
- **The adapter** (`makeAdapter` in `v6/v6.html`, about 30 lines): for each block joint, world rotation of the joint x "undo the A-pose" x the bone's bind rotation, written to the matching bone of the 24-bone rig (Hips, Spine02, Head, UpLeg, Leg, Foot, Arm, ForeArm, Hand). Root height is scaled by leg length and the root turns about the feet. No per-pose code.
- **Ball**: scripted (bounce under the dribbling hand, crossover, shot arc into the rim, dunk, bounces). When the ball is held, both hands of the new characters are pulled onto it by IK.
- **« Amélioré »**: Meshy's run cycle under the game's dribbling arm, a Meshy jump clip for legs and hips in the jump shot and the defender's block (arms still from the game), Victory Fist Pump and Victory Cheer for celebrations, dribbling hand IK onto the ball, head looking at the ball, a wrist follow-through after the shot.

## All the game's poses through the adapter
142 pose names (75 base, 19 jobs, 23 emotes, 25 fight): all 142 ran without error; `toutes-les-poses-blocs-vs-nouveaux.jpg` shows each one, block figure and new character side by side, 0.55 s into the pose.

## Meshy library for sport (678 presets)
Nothing basketball-specific (no dribble, shot, dunk, block) and one football clip (Kick a Soccer Ball). Useful generic ones: 47 runs, jumps (Regular Jump, Jump with Arms Open, Run and Jump, Jump and Slam Back Down), Victory Cheer, Victory Fist Pump, cheers, Baseball Pitching, Over Shoulder Throw, Jump to Catch and Fall, slides, Quick Step and Spin Dodge. Combat is well covered (about 150 clips), dance has 33.
