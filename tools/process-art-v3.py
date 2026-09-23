"""Process image-generated sources with the project's sprite skill; never draws art."""
import json, subprocess, sys, shutil
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor

ROOT = Path(__file__).resolve().parents[1]
JOBS = json.loads((ROOT / 'tools/art-v3-manifest.json').read_text(encoding='utf-8'))

def run(job):
    out = ROOT / 'assets/grok' / job['key']
    out.mkdir(parents=True, exist_ok=True)
    prompt = out / 'prompt-used.txt'
    prompt.write_text(job['prompt'] + '\n' + job.get('fixPrompt', ''), encoding='utf-8')
    cmd = [sys.executable, str(ROOT / '.agents/skills/generate2dsprite/scripts/generate2dsprite.py'), 'process',
           '--input', job['raw'], '--target', 'creature' if any(s in job['key'] for s in ['shrimp', 'crab', 'fish', 'scallop', 'rat']) else 'asset',
           '--mode', 'idle' if 'idle' in job['key'] else 'attack', '--rows', str(job['rows']), '--cols', str(job['cols']),
           '--output-dir', str(out), '--cell-size', str(job.get('cell',256)), '--fit-scale', str(job.get('fit',.78)),
           '--align', job.get('align','center'), '--shared-scale', '--scale-strategy', 'fit',
           '--component-mode', job.get('component','largest'), '--strict-qc', '--duration', str(job.get('duration',150)),
           '--prompt-file', str(prompt)]
    if job.get('allowSourceEdge'): cmd.append('--allow-source-edge-touch')
    result = subprocess.run(cmd, cwd=ROOT, capture_output=True, text=True, encoding='utf-8')
    if result.returncode: return job['key'] + ': FAILED\n' + result.stderr
    shutil.copy2(out / 'sheet-transparent.png', ROOT / 'assets/resources/art' / (job['key'] + '.png'))
    return job['key'] + ': PASS'

if __name__ == '__main__':
    selected = [j for j in JOBS if not sys.argv[1:] or j['key'] in sys.argv[1:]]
    with ThreadPoolExecutor(max_workers=3) as pool:
        results=list(pool.map(run, selected))
    print('\n'.join(results),flush=True)
    if any(': FAILED' in r for r in results): sys.exit(1)
