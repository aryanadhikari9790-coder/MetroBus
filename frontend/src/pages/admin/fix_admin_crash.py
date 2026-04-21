import os

file_path = r'c:\Users\adhik\MetroBus\frontend\src\pages\admin\AdminHome.jsx'

with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
    lines = f.readlines()

insertion = [
    '\n',
    'const LAYOUT_PRESETS = [\n',
    '  { id: "2x2", label: "2x2", left: 2, right: 2, description: "Standard comfort" },\n',
    '  { id: "2x1", label: "2x1", left: 2, right: 1, description: "Executive style" },\n',
    '  { id: "1x1", label: "1x1", left: 1, right: 1, description: "Micro bus" }\n',
    '];\n',
    '\n'
]

# Find the line with "function GlassCard"
insert_index = -1
for i, line in enumerate(lines):
    if 'function GlassCard' in line:
        insert_index = i
        break

if insert_index != -1:
    new_lines = lines[:insert_index] + insertion + lines[insert_index:]
    with open(file_path, 'w', encoding='utf-8') as f:
        f.writelines(new_lines)
    print("Successfully updated AdminHome.jsx")
else:
    print("Could not find insertion point")
