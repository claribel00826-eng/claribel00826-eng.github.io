import sys
s = open(sys.argv[1], encoding='utf-8').read().splitlines()
depth = 0
for i, line in enumerate(s, 1):
    for ch in line:
        if ch == '{':
            depth += 1
        elif ch == '}':
            depth -= 1
    if depth == 0 and i > 1 and i < len(s) - 2:
        print('depth 0 at line', i, ':', line[:60])
