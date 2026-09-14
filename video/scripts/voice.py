# Generates the narration clips with the macOS `say` voice and records their lengths for src/voice.ts.
# Usage: python3 scripts/voice.py [voice]   (default: Samantha; try "Ava (Premium)" if installed)
import subprocess, json, os, sys
VOICE = sys.argv[1] if len(sys.argv) > 1 else 'Samantha'
LINES = {
  'intro':      "Sound familiar? Half of these tabs are the same page.",
  'duplicates': "Tab Doctor closes duplicates for you. The newest copy stays, and Undo is one click away.",
  'stale':      "Tabs you haven't touched in a day fold into a Stale group. Click one, and it comes right back.",
  'snooze':     "Right-click, Snooze. Later today, tomorrow, or the weekend. The tab closes itself, and comes back on time.",
  'settings':   "One switch pauses everything. Rules and options live in their own settings tab.",
  'privacy':    "Zero network calls. No content scripts, no analytics. Open source.",
  'outro':      "Tab Doctor. Tabs, kept healthy.",
}
os.makedirs('public/voice', exist_ok=True)
durations = {}
for name, text in LINES.items():
    aiff = f'public/voice/{name}.aiff'; wav = f'public/voice/{name}.wav'
    subprocess.run(['say', '-v', VOICE, '-r', '168', '-o', aiff, text], check=True)
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', aiff, '-af',
                    'highpass=f=90,acompressor=threshold=-20dB:ratio=2.5:attack=6:release=90:makeup=3,alimiter=limit=0.9',
                    '-ar', '44100', '-ac', '1', wav], check=True)
    os.remove(aiff)
    durations[name] = round(float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', wav])), 2)
json.dump(durations, open('public/voice/durations.json', 'w'), indent=2)
print(durations, '→ update src/voice.ts if these changed')
