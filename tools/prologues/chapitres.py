"""The stories' chapters as films (web/src/components/prologue, the « série » of each story): for each
chapter after the first, scenarios/chapitres/<story>-c<n>.json, and for the end, <story>-fin.json, made
from the game's own words (backend game/stories.go: what's asked, the thanks, the steps) and the story's
prologue (its cast, its voices, where the one who tells it stands and how it's filmed):

  1. « Précédemment, dans … » over the place of the chapter before;
  2. the one who tells it, as the prologue last shows them, saying what came of it (the thanks);
  3. « Chapitre N » over the place the Sim goes to now;
  4. the one who tells it asking the rest.
The end: the last thanks, then « Fin ».

  go run ./cmd/prologues -chapters > /tmp/chapters.json   (in backend/)
  python3 tools/prologues/chapitres.py /tmp/chapters.json
Then tools/voix/prologues.mjs records the lines, tools/prologues/panels.mjs draws the panels.
"""
import hashlib
import json
import re
import os
import sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', '..', 'web', 'src', 'components', 'prologue', 'scenarios')
OUT = os.path.join(ROOT, 'chapitres')

# Where a step happens (game place kinds) → the set that shows it, and its mood.
SET_OF = {
    'maquis': ('maquis', ''), 'club': ('maquis', ''), 'restaurant': ('maquis', ''),
    'worship': ('culte', ''), 'market': ('marche', ''), 'mall': ('marche', ''), 'couture': ('marche', 'tissus'),
    'boutique': ('boutique', ''), 'pharmacie': ('pharmacie', ''), 'health': ('pharmacie', ''),
    'rue': ('rue', 'jour'), 'barbier': ('rue', 'jour'), 'police': ('commissariat', ''), 'transport': ('gare', ''),
    'nature': ('montagne', 'jour'), 'office': ('bureau', ''), 'stade': ('stade', ''), 'sport': ('terrain', ''),
    'beach': ('lagune', 'jour'), 'lagune': ('lagune', 'jour'), 'zoo': ('zoo', ''), 'gaming': ('sallejeux', ''),
    'aeroport': ('aeroport', ''),
}

def wide(set_):
    # A slow push in over the place, empty.
    return {'from': [1.0, 2.3, 6.5], 'to': [0.3, 1.8, 5.1], 'look': [0, 1.2, -1.2]}

def clean_thanks(t):
    # The thanks, without the « come back tomorrow » the film's own end says.
    parts = re.split(r'(?<=[.!?…])\s+', t.strip())
    keep = [p for p in parts if not re.match(r"(Reviens|Repasse|Reviens-moi)\b.*demain", p)]
    return ' '.join(keep) or t

# The gestures, after what's said: a thank-you isn't always arms up, an ask isn't always begging. The words
# choose the kind (a laugh, a blessing, a worry, a question), then the story and the chapter one of its gestures.
MOODS = [
    (r'\b(ha ?ha|hi ?hi|rire|rigol|mdr|drôle)', ['laugh', 'zouglou', 'clap']),
    (r'(bénisse|Dieu|grâce|prier|merci beaucoup|mille merci)', ['bow', 'heart', 'kiss']),
    (r'(peur|pleur|triste|honte|mal au|hélas|aïe|inquiet|perdu)', ['facepalm', 'cry', 'despair']),
    (r'(vite|urgent|aide-moi|aide moi|s\'il te plaît|stp|je t\'en prie)', ['beg', 'shout']),
]
THANKS = ['thumbsup', 'clap', 'heart', 'bow', 'cheer', 'flex', 'dab', 'salute', 'coucou', 'laugh']
ASK = ['talk', 'rant', 'lean', 'shrug', 'thumbsup', 'shout', 'beg', 'flex']


def gesture(text, pool, seed):
    h = int(hashlib.md5(seed.encode()).hexdigest(), 16)
    if text.rstrip().endswith('?') and pool is ASK and h % 2:
        return 'shrug'
    for pat, poses in MOODS:
        if re.search(pat, text, re.I):
            return poses[h % len(poses)]
    return pool[h % len(pool)]


def mirror(cam):
    """The same framing from the other side, so the ask isn't the thanks' shot again."""
    c = json.loads(json.dumps(cam))
    for k in ('from', 'to'):
        if k in c:
            c[k][0] = -c[k][0] if abs(c[k][0]) > 0.3 else c[k][0] + 0.9
    return c


def main(path):
    stories = json.load(open(path))
    os.makedirs(OUT, exist_ok=True)
    made = 0
    for st in stories:
        pro_path = os.path.join(ROOT, st['id'] + '.json')
        if not os.path.exists(pro_path):
            continue
        pro = json.load(open(pro_path))
        cast = pro['cast']
        # The one who tells it: named as the story's giver, else the one who speaks the prologue's last line.
        giver = next((k for k, c in cast.items() if c['name'] == st['giver']), None)
        last = pro['shots'][-1]
        if not giver:
            giver = last['line']['who'] if last['line']['who'] != 'narr' else next(k for k in cast if k != 'narr')
        # Where they stand, and how they're filmed: the prologue's last shot of them.
        home = next((s for s in reversed(pro['shots']) if any(a['who'] == giver for a in s['actors'])), last)
        here = next(a for a in home['actors'] if a['who'] == giver) if any(a['who'] == giver for a in home['actors']) else {'who': giver, 'at': [0, -0.2], 'pose': 'talk'}
        def giver_shot(text, say, pose, then, cam=None):
            a = {'who': giver, 'at': here['at'], 'pose': pose, 'then': [{'t': 2.6, 'pose': then}]}
            if here.get('turn'): a['turn'] = here['turn']
            s = {'set': home['set'], 'dur': 6, 'cam': cam or home['cam'], 'actors': [a], 'line': {'who': giver, 'text': text, 'say': say}, 'bd': {'side': 'right'}}
            if home.get('mood'): s['mood'] = home['mood']
            return s
        def place_shot(kind, text, say):
            set_, mood = SET_OF.get(kind, (home['set'], home.get('mood', '')))
            s = {'set': set_, 'dur': 4, 'cam': wide(set_), 'actors': [], 'line': {'who': 'narr', 'text': text, 'say': say}}
            if mood: s['mood'] = mood
            return s
        chs = st['chapters']
        name = cast[giver]['name']
        for k in range(1, len(chs) + 1):
            prev = chs[k - 1]
            prev_kind = prev['steps'][0]['kind'] if prev['steps'] else ''
            thanks = clean_thanks(prev['thanks'])
            shots = [
                place_shot(prev_kind, f"Précédemment, dans « {st['title']} »…", f"Précédemment, dans « {st['title']} »…"),
                giver_shot(thanks, thanks, 'talk', gesture(thanks, THANKS, f"{st['id']}{k}t")),
            ]
            if k < len(chs):
                ch = chs[k]
                step = ch['steps'][0] if ch['steps'] else {'kind': '', 'text': ''}
                shots.append(place_shot(step['kind'], f"Chapitre {k + 1}. {step['text']}.", f"Chapitre {k + 1}. [pause] {step['text']}."))
                shots.append(giver_shot(ch['ask'], ch['ask'], 'talk', gesture(ch['ask'], ASK, f"{st['id']}{k}a"), mirror(home['cam'])))
                sid, end = f"{st['id']}-c{k}", f"À toi de jouer : {step['text'][0].lower() + step['text'][1:]}."
                title = f"{st['title']} · chapitre {k + 1}"
            else:
                shots.append(place_shot(home.get('set') and '' , "Fin. Une autre histoire t'attend dans l'appli « Demandes ».", "[warmly] Fin. [pause] Une autre histoire t'attend dans l'appli « Demandes »."))
                shots[-1]['set'], shots[-1]['cam'] = 'terrasse', {'from': [0.6, 1.6, 5.4], 'to': [0.2, 1.5, 4.4], 'look': [0, 1.4, 0]}
                shots[-1]['mood'] = 'nuit'
                shots[-1]['actors'] = [{'who': giver, 'at': [0, 0], 'pose': 'wave'}]
                sid, end, title = f"{st['id']}-fin", "Fin de l'histoire.", f"{st['title']} · la fin"
            json.dump({'id': sid, 'title': title, 'cast': cast, 'shots': shots, 'end': end}, open(os.path.join(OUT, sid + '.json'), 'w'), ensure_ascii=False, indent=1)
            made += 1
    print(made, 'films de chapitres')

main(sys.argv[1])
