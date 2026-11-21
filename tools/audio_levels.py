"""Levels of the weapons' recordings for `WEAPON_MEASURED` in packages/app/src/audio-manifest.ts (user's notes
of 21.11: the weapons' sounds to one level by class).

A file's level is its loudest 50 ms RMS in dBFS (a shot or a click is short: a loudness meter's 400 ms window
reads it far too low), a cue's the mean of its takes. Decoded with ffmpeg. Prints the table to paste.

Usage: python3 -I tools/audio_levels.py
"""
import math, os, re, subprocess
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
AUDIO = os.path.join(HERE, '..', 'packages', 'app', 'public', 'audio')
MANIFEST = os.path.join(HERE, '..', 'packages', 'app', 'src', 'audio-manifest.ts')
WINDOW = 0.05
RATE = 44100


def level(path):
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', path, '-ac', '1', '-ar', str(RATE), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    w = int(RATE * WINDOW)
    n = max(1, len(x) // w)
    x = np.pad(x, (0, max(0, n * w - len(x))))[:n * w]
    rms = np.sqrt((x.reshape(n, w) ** 2).mean(1))
    return 20 * math.log10(float(rms.max()) + 1e-9)


def files(entry):
    m = re.search(r'range\("([^"]+)", \[([^\]]*)\]\)', entry)
    if m:
        return [f'{m.group(1)}{i.strip().strip(chr(34))}.ogg' for i in m.group(2).split(',')]
    return re.findall(r'"([^"]+\.ogg)"', entry)


def main():
    text = open(MANIFEST).read()
    for cue, entry in re.findall(r'\n    "?([a-z0-9-]+)"?: (\{ urls: [^\n]*gain: level\([^\n]*)', text):
        db = np.mean([level(os.path.join(AUDIO, f)) for f in files(entry)])
        key = f'"{cue}"' if '-' in cue else cue
        print(f'  {key}: {db:.1f},')


if __name__ == '__main__':
    main()
