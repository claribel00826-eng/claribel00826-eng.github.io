import sys, re
s = open(sys.argv[1], encoding='utf-8').read()
# remove strings roughly
s2 = re.sub(r"'(?:\\.|[^'\\])*'", "''", s)
s2 = re.sub(r'"(?:\\.|[^"\\])*"', '""', s2)
s2 = re.sub(r'`(?:\\.|[^`\\])*`', '``', s2)
depth = 0
line = 1
for ch in s2:
    if ch == '\n':
        line += 1
    if ch == '(':
        depth += 1
    elif ch == ')':
        depth -= 1
    if depth < 0:
        print('neg paren at line', line)
        break
print('final paren depth', depth)
