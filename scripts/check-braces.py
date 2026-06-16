import sys
s = open(sys.argv[1], encoding='utf-8').read()
depth = 0
line = 1
for ch in s:
    if ch == '\n':
        line += 1
    if ch == '{':
        depth += 1
    elif ch == '}':
        depth -= 1
        if depth == 0 and line < len(s.splitlines()) - 5:
            print('depth 0 at line', line)
print('final brace depth', depth)
