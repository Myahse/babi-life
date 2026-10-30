#!/usr/bin/env python3
# The app's walk-through in the emulator (.github/workflows/native-review.yml): it plays the game as a
# player does, by the screen (adb's taps on what uiautomator says is where), against the review's own
# API (a local server, never the production one), and keeps a screenshot of every step, what the screen
# said (its texts and labels) and what the app logged meanwhile. Each part goes on if the one before
# failed: one run says as much as it can.
#
#   python3 drive.py OUT_DIR      (env: API, ADMIN_KEY, PKG)

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
import xml.etree.ElementTree as ET

OUT = sys.argv[1] if len(sys.argv) > 1 else '/tmp/review'
API = os.environ.get('API', 'http://localhost:8080/api/v1')
ADMIN_KEY = os.environ.get('ADMIN_KEY', 'review-admin')
PKG = os.environ.get('PKG', 'com.lifeinbabi.babi_life')
PLAYER = os.environ.get('PLAYER', 'Revue Test')
os.makedirs(f'{OUT}/shots', exist_ok=True)
os.makedirs(f'{OUT}/ui', exist_ok=True)

STEPS = []
n_shot = 0
W, H = 0, 0
started = time.time()


def log(*a):
    print(f'[{time.time() - started:7.1f}s]', *a, flush=True)


def adb(*args, timeout=60, check=False):
    try:
        r = subprocess.run(['adb', *args], capture_output=True, timeout=timeout)
    except subprocess.TimeoutExpired:
        log('adb timeout', args)
        return ''
    if check and r.returncode:
        log('adb failed', args, r.stderr[-300:])
    return r.stdout.decode('utf-8', 'replace')


def sh(cmd, timeout=60):
    return adb('shell', cmd, timeout=timeout)


def wait(s):
    time.sleep(s)


# ---------- The screen ----------

def screen_size():
    global W, H
    m = re.findall(r'(\d+)x(\d+)', sh('wm size'))
    if m:
        w, h = map(int, m[-1])
        # The app is held sideways.
        W, H = max(w, h), min(w, h)
    log('screen', W, H)


def ui():
    """What's on screen: every node with its text or label and where it is."""
    for attempt in range(3):
        out = sh('uiautomator dump /sdcard/ui.xml >/dev/null 2>&1; cat /sdcard/ui.xml', timeout=40)
        i = out.find('<?xml')
        if i >= 0:
            try:
                root = ET.fromstring(out[i:].strip())
            except ET.ParseError:
                continue
            nodes = []
            for e in root.iter('node'):
                b = re.findall(r'\d+', e.get('bounds', ''))
                if len(b) != 4:
                    continue
                x1, y1, x2, y2 = map(int, b)
                nodes.append({'text': e.get('text', ''), 'desc': e.get('content-desc', ''), 'cls': e.get('class', '').split('.')[-1], 'pkg': e.get('package', ''), 'b': (x1, y1, x2, y2), 'click': e.get('clickable') == 'true', 'enabled': e.get('enabled') != 'false'})
            return nodes
        wait(1.5)
    log('ui dump failed')
    return []


def label(n):
    return (n['text'] or n['desc']).strip()


def visible(n):
    x1, y1, x2, y2 = n['b']
    return x2 - x1 > 2 and y2 - y1 > 2 and x2 > 0 and y2 > 0 and x1 < max(W, 1) and y1 < max(H, 1)


def find(pat, nodes=None, last=False):
    rx = re.compile(pat, re.I)
    hits = [n for n in (nodes if nodes is not None else ui()) if visible(n) and (rx.search(n['text'] or '') or rx.search(n['desc'] or ''))]
    if not hits:
        return None
    return hits[-1] if last else hits[0]


def wait_for(pat, timeout=20, step=2.0):
    end = time.time() + timeout
    while True:
        n = find(pat)
        if n or time.time() > end:
            return n
        wait(step)


def center(n):
    x1, y1, x2, y2 = n['b']
    return (x1 + x2) // 2, (y1 + y2) // 2


def tap_xy(x, y):
    sh(f'input tap {int(x)} {int(y)}')


def tap(pat, timeout=10, after=1.5, last=False):
    """Taps what shows these words (or label): False when it isn't on screen."""
    end = time.time() + timeout
    while True:
        n = find(pat, last=last)
        if n:
            tap_xy(*center(n))
            log('tap', repr(label(n))[:60], center(n))
            wait(after)
            return True
        if time.time() > end:
            log('not found', pat)
            return False
        wait(1.5)


def back(after=1.5):
    sh('input keyevent 4')
    wait(after)


def swipe(x1, y1, x2, y2, ms=400):
    sh(f'input swipe {int(x1)} {int(y1)} {int(x2)} {int(y2)} {ms}')


def type_text(s):
    sh("input text '" + s.replace(' ', '%s').replace("'", '') + "'")


def alive():
    return bool(sh(f'pidof {PKG}').strip())


def shot(name, note=''):
    """The screen as a picture, what it said, and whether the app is still there."""
    global n_shot
    n_shot += 1
    tag = f'{n_shot:03d}-{name}'
    with open(f'{OUT}/shots/{tag}.png', 'wb') as f:
        f.write(subprocess.run(['adb', 'exec-out', 'screencap', '-p'], capture_output=True, timeout=60).stdout)
    nodes = ui()
    texts = [f"{label(n)!r} {n['cls']} {n['b']}{' click' if n['click'] else ''}" for n in nodes if label(n)]
    with open(f'{OUT}/ui/{tag}.txt', 'w') as f:
        f.write('\n'.join(texts))
    up = alive()
    STEPS.append({'step': tag, 'note': note, 'alive': up, 'texts': [label(n) for n in nodes if label(n)][:60], 't': round(time.time() - started)})
    log('shot', tag, '' if up else 'APP NOT RUNNING', '|', ' | '.join(label(n) for n in nodes if label(n))[:300])
    save()
    return nodes


def save():
    with open(f'{OUT}/steps.json', 'w') as f:
        json.dump(STEPS, f, ensure_ascii=False, indent=1)


def launch(clear=False):
    if clear:
        sh(f'pm clear {PKG}')
        # The permissions the game asks for, given beforehand (no system dialog over the walk-through).
        sh(f'pm grant {PKG} android.permission.POST_NOTIFICATIONS')
    sh(f'am force-stop {PKG}')
    sh(f'monkey -p {PKG} -c android.intent.category.LAUNCHER 1')


def ensure_running(where):
    if alive():
        return True
    log('APP DIED at', where)
    STEPS.append({'step': f'CRASH at {where}', 'alive': False, 't': round(time.time() - started)})
    launch()
    wait(30)
    return False


# Whatever the game puts in the way (a tip, the tour, a news, a permission): closed.
DISMISS = r"^(Plus tard|Pas maintenant|Compris|J'ai compris|OK|D'accord|Fermer|Continuer|Passer|Non merci|Ignorer|Allons-y|Super|Génial|Merci|Don.t allow|Ne pas autoriser|Only this time|Uniquement cette fois-ci)\s*!?$"


def dismiss(rounds=3):
    for _ in range(rounds):
        n = find(DISMISS)
        if not n:
            return
        tap_xy(*center(n))
        log('dismiss', label(n))
        wait(2)


# ---------- The API (the review's own server) ----------

def call(path, method='GET', body=None, token=None):
    req = urllib.request.Request(API + path, method=method, data=json.dumps(body).encode() if body is not None else None, headers={'content-type': 'application/json', **({'authorization': f'Bearer {token}'} if token else {})})
    with urllib.request.urlopen(req, timeout=30) as r:
        t = r.read().decode()
        return json.loads(t) if t else None


def player():
    """The walk-through's player, as the app signed it in (dev sign-in: same name, same account)."""
    s = call('/auth/dev', 'POST', {'name': PLAYER})
    token = s['token']
    try:
        call('/me/tester', 'POST', {'code': ADMIN_KEY, 'typed': True}, token)
    except Exception as e:  # noqa
        log('tester', e)
    sims = call('/sims', token=token)
    sims = sims.get('sims', sims) if isinstance(sims, dict) else sims
    return token, (sims[0]['id'] if sims else None)


def tester(token, sim, **body):
    try:
        return call(f'/sims/{sim}/tester', 'POST', {'pass': ADMIN_KEY, **body}, token)
    except Exception as e:  # noqa
        log('tester', body, e)


# ---------- The walk-through ----------

def part(fn):
    name = fn.__name__
    log('=====', name)
    try:
        fn()
    except Exception as e:  # noqa
        log('PART FAILED', name, repr(e))
        STEPS.append({'step': f'FAILED {name}', 'error': repr(e), 't': round(time.time() - started)})
        try:
            shot(f'{name}-failed')
        except Exception:  # noqa
            pass
    ensure_running(name)


def onboarding():
    launch(clear=True)
    wait_for(r'^Suivant|Passer', 120)
    wait(3)
    shot('onboarding-1')
    for i in range(2, 4):
        if not tap(r'^Suivant', 5, after=2.5):
            break
        shot(f'onboarding-{i}')
    tap(r"^Commencer|C'est parti", 8, after=6)
    shot('title')


# The e-mail account the walk-through registers, then signs in with.
EMAIL = os.environ.get('REVIEW_EMAIL', 'revue.test@example.com')
PASSWORD = 'revue-mot-de-passe'


def field(pat, text, shot_name=None):
    """Types into the field showing these words (its placeholder or label)."""
    n = find(pat)
    if not n:
        log('no field', pat)
        return False
    tap_xy(*center(n))
    wait(1.2)
    if shot_name:
        shot(shot_name, 'keyboard open: is the field still in view?')
    type_text(text)
    wait(0.6)
    return True


def keyboard_down():
    if 'mInputShown=true' in sh('dumpsys input_method | grep mInputShown'):
        back(1)


def google_button():
    # Google's sign-in in the emulator: no account (or no Play services) there, so its error must show.
    if not tap(r'Continuer avec Google', 8, after=8):
        return
    shot('google-after-tap', 'the Google sign-in: its error, or Google\'s own window')
    if not find(r'Connexion Google|Se connecter|Créer un compte'):
        back(3)
    shot('google-back')


def register_email():
    tap(r'^Créer un compte$', 8, after=2)
    shot('register')
    field(r'^Prénom$', 'Revue')
    keyboard_down()
    field(r'^Nom$', 'Test')
    keyboard_down()
    field(r'^Pseudo$|^@', 'revue_test')
    keyboard_down()
    field(r'^E-mail$', EMAIL, 'register-keyboard')
    keyboard_down()
    field(r'^Mot de passe', PASSWORD)
    keyboard_down()
    wait(2)
    shot('register-filled')
    tap(r'^Créer mon compte$', 8, after=10, last=True)
    shot('after-register')


def login_email():
    # A fresh start (the app's data cleared): « Passer », then the e-mail and the password.
    launch(clear=True)
    wait_for(r'^Passer', 120)
    tap(r'^Passer', 5, after=5)
    shot('login')
    field(r'E-mail ou pseudo', EMAIL, 'login-keyboard')
    keyboard_down()
    field(r'^Mot de passe$', PASSWORD)
    keyboard_down()
    tap(r'^Se connecter$', 8, after=10, last=True)
    shot('after-login')


def small_phone():
    # A small phone (640 x 360 dp lying down): the welcome and the sign-in still fit, nothing scrolls.
    sh('wm size 720x1280')
    sh('wm density 320')
    screen_size()
    launch(clear=True)
    wait_for(r'^Suivant|Passer', 120)
    wait(3)
    shot('small-onboarding')
    tap(r'^Passer', 5, after=5)
    shot('small-login')
    tap(r'^Créer un compte$', 8, after=2)
    shot('small-register')
    field(r'^Mot de passe', 'abc', 'small-register-keyboard')
    keyboard_down()
    sh('wm size 720x1520')
    sh('wm density 280')
    screen_size()


def sign_in():
    # The title page: the sign-in card, then the local test mode (the review's API has DEV_LOGIN).
    tap(r"^Se connecter$|J'ai déjà un compte", 10, after=3)
    shot('login-card')
    if not tap(r'Mode test', 6, after=2):
        swipe(W / 2, H * 0.8, W / 2, H * 0.3)
        wait(1)
        tap(r'Mode test', 6, after=2)
    field = find(r'Nom du joueur test')
    if field:
        tap_xy(*center(field))
        wait(1.5)
        shot('login-keyboard', 'keyboard open on the test name')
        # Clear what's there, then the review's player.
        sh('input keyevent KEYCODE_MOVE_END')
        for _ in range(30):
            sh('input keyevent 67')
        type_text(PLAYER)
        wait(1)
        shot('login-typed')
        sh('input keyevent 4')  # the keyboard down
        wait(1)
    tap(r'^Jouer$', 8, after=10, last=True)
    shot('after-login')


def create_sim():
    wait_for(r'^Suivant|Naître|Identité', 60)
    wait(4)
    for i in range(1, 9):
        nodes = shot(f'create-{i}')
        if find(r'^Naître$', nodes):
            break
        if not tap(r'^Suivant', 6, after=3):
            break
    tap(r'^Naître$', 8, after=5)
    shot('create-birth')
    # A location prompt (« Naître là où tu es »), refused: the game draws a commune.
    for _ in range(20):
        if find(r'Bienvenue au monde|C.est un bébé'):
            break
        dismiss(1)
        wait(3)
    shot('family-reveal')
    tap(r'Bienvenue au monde', 10, after=5)


def street_baby():
    # The arrival (the flight over the commune), the tour: as long as it takes, then the street.
    for k in range(12):
        wait(10)
        if k in (0, 3, 8):
            shot(f'arrival-{k}')
        dismiss(2)
        if find(r'^Phone$'):
            break
    wait(5)
    shot('street-baby')
    tap(r'^Phone$', 8, after=3)
    shot('phone-baby')
    back()
    shot('back-from-phone-baby')


def grow_up():
    token, sim = player()
    log('player sim', sim)
    if not sim:
        return
    tester(token, sim, action='age', stage='adulte')
    tester(token, sim, action='money', amount=50000)
    tester(token, sim, action='apps')
    launch()
    for _ in range(18):
        wait(6)
        dismiss(2)
        if find(r'^Phone$'):
            break
    wait(5)
    shot('street-adult')


def walk():
    # The street: a finger dragged on the left half moves the perso (the joystick), on the right turns the view.
    swipe(W * 0.2, H * 0.7, W * 0.2, H * 0.45, 3000)
    shot('walk-forward')
    swipe(W * 0.75, H * 0.5, W * 0.55, H * 0.5, 800)
    shot('turn-view')
    tap(r'^Émotes$', 4)
    shot('emotes')
    back()


PHONE_APPS = ['Carte', 'Quartier', 'Boulot', 'Logement', 'Infos', 'Messages', 'Amis', 'Caméra', 'Galerie', 'Jeux', 'Encyclo', 'Boutique', 'Idées', 'Mentor', 'Inviter', 'Politique', 'Réglages', 'Profil', 'Store', 'Waye', 'Gbairai', 'Tikitoko', 'Babigram', 'Flashé', 'Bet225', 'ParisFoot', 'Babi Bingo', 'Babi Casino', 'Godé', 'Garbaya', 'Dodo', 'Kinéo', 'Bolide', 'Dames', '8 américain', 'Awalé', 'Ludo', 'Gnango', 'iDrive']


def open_phone():
    if find(r'^Réglages$'):
        return True
    for _ in range(3):
        if tap(r'^Phone$', 6, after=3):
            return True
        back()
    return False


def find_app(name):
    """The app's icon on the phone's screen, scrolled to if it's further down."""
    pat = '^' + re.escape(name) + '$'
    for k in range(5):
        n = find(pat)
        if n:
            return n
        # Down the phone's screen of apps.
        swipe(W / 2, H * 0.75, W / 2, H * 0.35, 500)
        wait(1)
    for k in range(5):
        swipe(W / 2, H * 0.3, W / 2, H * 0.8, 300)
    return find(pat)


def phone_apps():
    open_phone()
    shot('phone-home')
    swipe(W / 2, H * 0.75, W / 2, H * 0.3, 500)
    wait(1)
    shot('phone-home-scrolled')
    for name in PHONE_APPS:
        if not open_phone():
            log('no phone for', name)
            continue
        n = find_app(name)
        if not n:
            STEPS.append({'step': f'app {name}: not on the phone', 't': round(time.time() - started)})
            continue
        tap_xy(*center(n))
        wait(5)
        shot('app-' + re.sub(r'\W+', '-', name.lower()))
        if name in ('Dames', '8 américain', 'Awalé', 'Ludo', 'Godé'):
            if tap(r'^Jouer|Pour le plaisir|Contre l.ordinateur|Nouvelle partie|Facile', 4, after=4):
                tap(r'Pour le plaisir|Facile|Commencer|Sans mise', 4, after=6)
                shot('app-' + re.sub(r'\W+', '-', name.lower()) + '-game')
        if name == 'Gbairai':
            if tap(r'Awa|Koffi|maman|papa', 4, after=3):
                shot('gbairai-chat')
                field = find(r'Message|Écris')
                if field:
                    tap_xy(*center(field))
                    wait(1.5)
                    type_text('Bonjour')
                    shot('gbairai-keyboard', 'keyboard over the chat field?')
                    back()
        back(2)
        ensure_running('app ' + name)
    shot('phone-after-apps')


def map_and_trip():
    back()
    if not tap(r'^Carte$', 8, after=6):
        return
    shot('map')
    # A commune on the board, then the taxi.
    tap_xy(W * 0.62, H * 0.45)
    wait(3)
    shot('map-commune')
    if tap(r'^Taxi$|Gnango', 5, after=2):
        shot('map-taxi')
    if tap(r'Aller au bord de la route|Commander|Appeler|Y aller', 5, after=8):
        shot('trip-1')
        for k in range(8):
            if tap(r'Faire signe', 3, after=4):
                shot(f'trip-hail-{k}')
            wait(5)
        shot('trip-2')
        wait(20)
        shot('trip-3')
    back(2)
    back(2)
    shot('after-trip')


def place_action():
    open_phone()
    if not find_app('Quartier'):
        return
    tap(r'^Quartier$', 5, after=4)
    shot('quartier')
    nodes = ui()
    # The first place listed, then its first activity.
    cands = [n for n in nodes if visible(n) and label(n) and n['b'][1] > H * 0.2 and len(label(n)) > 3 and not re.search(r'Quartier|Phone|Carte|Retour', label(n))]
    if cands:
        tap_xy(*center(cands[0]))
        wait(4)
        shot('place')
        nodes = ui()
        acts = [n for n in nodes if visible(n) and re.search(r'F$|Djai|Gratuit|min', label(n))]
        if acts:
            tap_xy(*center(acts[0]))
            wait(8)
            shot('action')
            wait(15)
            shot('action-later')
    back(2)
    back(2)


def defi():
    if tap(r'^Défi|Défi :', 6, after=5):
        shot('defi')
        tap(r"C'est parti|Commencer|Go", 5, after=5)
        shot('defi-playing')
        back(2)


def back_button():
    # Back with nothing open: the app stays (or asks), never closes the game by surprise.
    for i in range(2):
        back(2)
    shot('back-twice-street', 'back pressed twice in the street')
    if not alive():
        launch()
        wait(40)


# What a run plays (REVIEW_PARTS): « login », the welcome and the sign-in (Google's error, an e-mail
# account made then signed in with, a small phone), then the Sim's birth; « full », the whole game.
PARTS = {
    'login': ('onboarding', 'google_button', 'register_email', 'login_email', 'create_sim', 'street_baby', 'small_phone'),
    'full': ('onboarding', 'sign_in', 'create_sim', 'street_baby', 'grow_up', 'walk', 'phone_apps', 'map_and_trip', 'place_action', 'defi', 'back_button'),
}


def main():
    screen_size()
    log('API', API)
    names = PARTS.get(os.environ.get('REVIEW_PARTS', 'full'), PARTS['full'])
    for name in names:
        part(globals()[name])
    save()
    log('done', n_shot, 'shots')


if __name__ == '__main__':
    main()
