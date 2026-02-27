import re

with open('script.js', 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

# Track bracket balance
balance = 0
open_braces_stack = []

for i, line in enumerate(lines, 1):
    # Remove strings to avoid counting brackets in comments/strings
    temp_line = re.sub(r'"[^"]*"', '""', line)
    temp_line = re.sub(r"'[^']*'", "''", temp_line)
    temp_line = re.sub(r'`[^`]*`', '``', temp_line)
    temp_line = re.sub(r'//.*', '', temp_line)
    
    for j, char in enumerate(temp_line):
        if char == '{':
            open_braces_stack.append(i)
            balance += 1
        elif char == '}':
            if open_braces_stack:
                open_braces_stack.pop()
            balance -= 1

print(f"Final balance: {balance}")  

if balance > 0 and open_braces_stack:
    unclosed_lines = open_braces_stack[-2:] if len(open_braces_stack) >= 2 else open_braces_stack
    print(f"Unclosed braces at lines: {unclosed_lines}")
    
    for line_num in unclosed_lines:
        print(f"\nContent around line {line_num}:")
        start = max(0, line_num - 5)
        end = min(len(lines), line_num + 5) 
        for i in range(start, end):
            marker = ">>> " if i == line_num - 1 else "    "
            print(f"{marker}{i+1}: {lines[i]}", end='')
