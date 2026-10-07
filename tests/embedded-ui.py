"""Reject an EXE built from a stale compiled resource after a frontend update."""
from pathlib import Path
import sys
exe, html = map(Path, sys.argv[1:])
packed = html.read_bytes()
assert len(packed) > 10000, 'Packed UI is unexpectedly empty'
assert packed in exe.read_bytes(), 'EXE contains stale UI resources; rebuild app.res.o after packing frontend'
print('Passed: shipped EXE embeds the exact checked frontend bytes.')
