"""Awa's voice for the top 20 (top20.mjs is timed on it): each line said by an open model run here,
three takes each, the one a listener understands best kept (Whisper, French), its silences trimmed.
Writes out/voix-top20/<id>.wav and report.json (each line's length, what Whisper heard).

The voice: Chatterbox multilingual (Resemble AI, MIT licence: free for commercial use; its takes carry
its inaudible watermark), lively (exaggeration), with the timbre of a short reference said by Kokoro's
French voice (Apache 2.0), made once here (out/voix-top20/ref.wav). Not ElevenLabs: when Awa's usual
voice is wanted, her lines from ElevenLabs go in out/voix-top20/<id>.wav instead (then delete
report.json's entry so it's measured again: python3 voice.py --measure).

    python3 voice.py                 # all the lines
    python3 voice.py outro,basket    # just those again
    python3 voice.py --measure       # only measure the wav files there (other voices)

Python 3.11 with: chatterbox-tts==0.1.7 (torch 2.6, CPU is enough: about 30 s a take), faster-whisper,
kokoro, misaki[fr], setuptools<81 (the watermarker's pkg_resources); espeak-ng installed.
"""

import difflib
import json
import os
import re
import sys
import unicodedata

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'out', 'voix-top20')

# What Awa says, in order (the captions are in web/src/lab/poster.tsx, FILMS.top20). Numbers in letters.
LINES = [
    ('hook', "Tu t'ennuies ? Voilà vingt trucs à faire à Babi !"),
    ('ski', "Vingt : du ski nautique à l'île Boulay !"),
    ('nouchi', 'Dix-neuf : parler nouchi avec tout le monde.'),
    ('patinoire', "Dix-huit : la patinoire de l'Hôtel Ivoire !"),
    ('grin', 'Dix-sept : le thé au grin.'),
    ('marche', 'Seize : faire son marché.'),
    ('photo', 'Quinze : prendre Babi en photo.'),
    ('messe', 'Quatorze : la messe du dimanche.'),
    ('priere', 'Treize : la grande prière du vendredi.'),
    ('mall', 'Douze : le lèche-vitrine au centre commercial.'),
    ('cine', 'Onze : le ciné, avec le pop-corn !'),
    ('brunch', 'Dix : bruncher face à la lagune.'),
    ('boite', 'Neuf : la boîte, à la rue Princesse !'),
    ('zouglou', 'Huit : le zouglou avec les gars !'),
    ('avion', "Sept : l'avion pour Yamoussoukro."),
    ('tourf', 'Six : la tour F en chantier !'),
    ('dames', 'Cinq : les dames. Tu mises, tu rafles tout !'),
    ('huit', 'Quatre : le huit américain. Joker ? Pioche six !'),
    ('kart', 'Trois : la course de karts !'),
    ('basket', 'Deux : le basket… et panier !'),
    ('foot', 'Et numéro un… le foot du quartier. Buuut !'),
    ('outro', 'Et il y en a plus de cent soixante dans le jeu ! Tu commences par lequel ?'),
]
REFERENCE = "Salut tout le monde ! Aujourd'hui je vous montre mon quartier, et franchement, vous allez adorer. On va au maquis, on rigole, on danse, c'est la belle vie à Abidjan."


NUMBERS = {
    '1': 'un', '2': 'deux', '3': 'trois', '4': 'quatre', '5': 'cinq', '6': 'six', '7': 'sept', '8': 'huit', '9': 'neuf', '10': 'dix',
    '11': 'onze', '12': 'douze', '13': 'treize', '14': 'quatorze', '15': 'quinze', '16': 'seize', '17': 'dixsept', '18': 'dixhuit',
    '19': 'dixneuf', '20': 'vingt', '160': 'centsoixante',
}


def letters(s):
    """What's said, as letters only: Whisper writes numbers in figures and cuts words its own way
    (« nouchi » heard « nous chi »), so the words are compared as one string of letters."""
    s = re.sub(r'\d+', lambda m: NUMBERS.get(m.group(0), m.group(0)), s.lower())
    s = unicodedata.normalize('NFD', s)
    return ''.join(c for c in s if 'a' <= c <= 'z')


def to16k(a, sr):
    t = np.arange(0, len(a) / sr, 1 / 16000)
    return np.interp(t, np.arange(len(a)) / sr, a).astype(np.float32)


def trim(a, sr):
    """Off with the silence before and after (a little air kept)."""
    env = np.convolve(np.abs(a), np.ones(240) / 240, mode='same')
    on = np.where(env > 0.02 * env.max())[0]
    return a[max(0, on[0] - int(0.04 * sr)) : min(len(a), on[-1] + int(0.12 * sr))]


def main():
    import soundfile as sf
    from faster_whisper import WhisperModel

    os.makedirs(OUT, exist_ok=True)
    ear = WhisperModel('small', device='cpu', compute_type='int8')

    def heard(a, sr):
        segs, _ = ear.transcribe(to16k(a, sr), language='fr', beam_size=5)
        return ' '.join(s.text.strip() for s in segs)

    report_path = os.path.join(OUT, 'report.json')
    report = json.load(open(report_path)) if os.path.exists(report_path) else {}
    args = sys.argv[1:]
    if args == ['--measure']:
        for id, text in LINES:
            f = os.path.join(OUT, f'{id}.wav')
            if os.path.exists(f) and id not in report:
                a, sr = sf.read(f, dtype='float32')
                a = a.mean(axis=1) if a.ndim > 1 else a
                report[id] = {'dur': round(len(a) / sr, 3), 'heard': heard(a, sr)}
        json.dump(report, open(report_path, 'w'), ensure_ascii=False, indent=1)
        return
    only = set(args[0].split(',')) if args else None

    import torch
    from chatterbox.mtl_tts import ChatterboxMultilingualTTS

    ref = os.path.join(OUT, 'ref.wav')
    if not os.path.exists(ref):
        from kokoro import KPipeline

        pipe = KPipeline(lang_code='f', repo_id='hexgrad/Kokoro-82M')
        sf.write(ref, np.concatenate([np.asarray(a) for _, _, a in pipe(REFERENCE, voice='ff_siwis')]), 24000)
    model = ChatterboxMultilingualTTS.from_pretrained(device='cpu')
    for id, text in LINES:
        if only and id not in only:
            continue
        best = None
        for seed in (7, 21, 42):
            torch.manual_seed(seed)
            a = trim(model.generate(text, language_id='fr', audio_prompt_path=ref, exaggeration=0.75, cfg_weight=0.35).squeeze().numpy(), model.sr)
            h = heard(a, model.sr)
            score = difflib.SequenceMatcher(None, letters(text), letters(h)).ratio()
            print(f'{id} seed {seed}: {score:.2f} {len(a) / model.sr:.2f}s « {h} »', flush=True)
            # The best understood; of two as good, the shorter (it keeps the film moving).
            if best is None or score > best[0] + 0.001 or (abs(score - best[0]) < 0.001 and len(a) < len(best[1])):
                best = (score, a, h)
            if score > 0.97:
                break
        sf.write(os.path.join(OUT, f'{id}.wav'), best[1], model.sr)
        report[id] = {'dur': round(len(best[1]) / model.sr, 3), 'score': round(best[0], 3), 'heard': best[2]}
        json.dump(report, open(report_path, 'w'), ensure_ascii=False, indent=1)
        print(f'→ {id} {report[id]["dur"]}s', flush=True)


if __name__ == '__main__':
    main()
