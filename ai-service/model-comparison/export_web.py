"""ย่อ results/summary.json เหลือเฉพาะที่หน้าเว็บ /research-study ใช้ แล้วเขียนไปที่ web/src/data/modelComparison.json"""
import json, os

from common import HERE, MODELS, RECIPE, RESULTS_DIR

S = json.load(open(os.path.join(RESULTS_DIR, 'summary.json'), encoding='utf-8'))
ms = lambda v: {'mean': v['mean'], 'sd': v['sd']}  # noqa: E731
# The model the system runs now (ai-service/model/metrics.json, written by training/build_v3.py)
D = json.load(open(os.path.join(HERE, '..', 'model', 'metrics.json'), encoding='utf-8'))
deployed = {
    'version': D['model_version'], 'classes': D.get('classes'), 'threshold': D.get('threshold'),
    'accuracy': D['test']['accuracy'], 'correct': D['test']['correct'], 'macroF1': D['test']['macro']['f1'], 'auc': D['test']['auc_macro_ovr'],
    'sentToOther': D['test'].get('sent_to_other'), 'userView': D['test'].get('user_view'),
    'other': D.get('test_other'), 'otherSplit': D.get('split', {}).get('other'), 'tflite': D.get('tflite'),
    'perClass': D['test']['per_class'], 'test5': D.get('test_5class'),
    'previousPerClass': json.load(open(os.path.join(HERE, '..', 'model', 'metrics.v2.json'), encoding='utf-8'))['test']['per_class'],
    'previousMacroF1': D['previous']['test']['macro']['f1'],
    'previous': {'version': D['previous']['model_version'], 'accuracy': D['previous']['test']['accuracy'],
                 'userView': D['previous']['test'].get('user_view'), 'other': D['previous'].get('test_other'),
                 'mcnemar': D['previous'].get('mcnemar_vs_v3_in_scope')},
}
out = {
    'evaluated': S['evaluated'], 'testSize': S['test_size'], 'seeds': S['seeds'], 'classes': S['classes'],
    'recipe': RECIPE,
    'deployed': deployed,
    'models': [],
}
for m in S['models']:
    h = m['hardware']
    out['models'].append({
        'key': m['key'], 'name': m['name'], 'role': m['role'], 'year': m['year'], 'paper': m['paper'],
        'finetuneLr': MODELS[m['key']].get('finetune_lr', RECIPE['finetune']['lr']),
        'params': h['params'], 'gflops': round((h['flops'] or 0) / 1e9, 6),
        'kerasMb': round(h['keras_mb'], 6), 'tfliteMb': round(h.get('tflite_mb', 0), 6),
        'tfliteMs': round(h.get('tflite_ms', {}).get('median', 0), 6), 'tfliteAgreement': h.get('tflite_agreement'),
        'trainMin': ms(m['train_minutes']), 'accuracy': ms(m['accuracy']), 'macroF1': ms(m['macro_f1']), 'auc': ms(m['auc']),
        'perClassF1': {c: ms(v) for c, v in m['per_class_f1'].items()},
        'confusion': m['runs'][0]['confusion_matrix'],
        'runs': [{'seed': r['seed'], 'accuracy': r['accuracy'], 'correct': r['correct'], 'macroF1': r['macro_f1']} for r in m['runs']],
        'mcnemar': m['mcnemar_vs_main'],
    })
dst = os.path.join(HERE, '..', '..', 'web', 'src', 'data', 'modelComparison.json')
os.makedirs(os.path.dirname(dst), exist_ok=True)
json.dump(out, open(dst, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)
print('wrote', os.path.normpath(dst))
