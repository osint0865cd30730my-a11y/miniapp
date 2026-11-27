"""Перелік постанов і окремих думок ККС і ВП ВС у кримінальних справах 2018–2026 з відкритих даних ДСА → kks-index.txt.

Вхід — kksall.tsv конвеєра бази «LEX_A» (id, суд, вид, категорія, справа, дата, файл). Вихід — рядки
«справа|РРРРММДД|id|тип» (тип: K — постанова ККС, V — постанова ВП, k/v — окрема думка), відсортовані за справою.
Застосунок підвантажує файл лише під час «Перевірки посилань».

    python3 tools/kks_index.py шлях/до/kksall.tsv
"""
import sys, pathlib, datetime

def main(src):
    T = {('9941', '2'): 'K', ('9951', '2'): 'V', ('9941', '10'): 'k', ('9951', '10'): 'v'}
    rows, last = set(), ''
    for l in open(src, encoding='utf-8'):
        f = l.rstrip('\n').split('\t')
        if len(f) < 6 or (f[1], f[2]) not in T or not f[4] or not f[5]: continue
        rows.add(f"{f[4].strip()}|{f[5].replace('-', '')}|{f[0]}|{T[(f[1], f[2])]}")
        last = max(last, f[5])
    out = pathlib.Path(__file__).resolve().parent.parent / 'kks-index.txt'
    out.write_text(f"# ДСА, відкриті дані ЄДРСР (CC BY); постанови й окремі думки ККС і ВП ВС у кримінальних справах; по {last}\n" + '\n'.join(sorted(rows)) + '\n', encoding='utf-8')
    print(out.name, len(rows), 'рядків, по', last, out.stat().st_size // 1024, 'КБ')

if __name__ == '__main__':
    main(sys.argv[1])
