# Minimal SPSS .sav reader (uncompressed or bytecode-compressed), enough for survey microdata. Pure Python.
import struct

def read_meta(f):
    h = f.read(176)
    assert h[:4] == b"$FL2", "not a sav file"
    nominal, comp, wi, ncases = struct.unpack("<4i", h[68:84])
    bias = struct.unpack("<d", h[84:92])[0]
    vars_, slot, pending, longnames, labels_by_idx, valuelabels = [], 0, None, {}, [], []
    while True:
        rt = struct.unpack("<i", f.read(4))[0]
        if rt == 2:
            typ, has_label, nmiss, _p, _w = struct.unpack("<5i", f.read(20))
            name = f.read(8).decode("latin1").strip()
            label = ""
            if has_label:
                n = struct.unpack("<i", f.read(4))[0]
                label = f.read((n + 3) // 4 * 4)[:n].decode("utf8", "replace")
            if nmiss: f.read(8 * abs(nmiss))
            if typ == -1:
                continue_slot = True
                slot += 1
                if vars_: vars_[-1]["slots"] += 1
                continue
            vars_.append({"name": name, "label": label, "type": typ, "slot": slot, "slots": 1})
            slot += 1
        elif rt == 3:
            n = struct.unpack("<i", f.read(4))[0]
            pairs = []
            for _ in range(n):
                val = f.read(8)
                ln = f.read(1)[0]
                lab = f.read((ln + 1 + 7) // 8 * 8 - 1)[:ln].decode("utf8", "replace")
                pairs.append((struct.unpack("<d", val)[0], lab))
            assert struct.unpack("<i", f.read(4))[0] == 4
            k = struct.unpack("<i", f.read(4))[0]
            idx = struct.unpack("<%di" % k, f.read(4 * k))
            valuelabels.append((idx, pairs))
        elif rt == 6:
            n = struct.unpack("<i", f.read(4))[0]; f.read(80 * n)
        elif rt == 7:
            sub, size, count = struct.unpack("<3i", f.read(12))
            data = f.read(size * count)
            if sub == 13:
                for pair in data.decode("utf8", "replace").split("\t"):
                    if "=" in pair:
                        a, b = pair.split("=", 1); longnames[a.strip()] = b.strip()
        elif rt == 999:
            f.read(4); break
        else:
            raise ValueError("unknown record %d" % rt)
    # variable index here counts physical var records (not continuation); valuelabels index is 1-based over var records incl. continuation slots
    by_slot = {v["slot"]: v for v in vars_}
    for v in vars_: v["name"] = longnames.get(v["name"], v["name"])
    vlabels = {}
    for idx, pairs in valuelabels:
        for i in idx:
            v = by_slot.get(i - 1)
            if v: vlabels[v["name"]] = dict(pairs)
    return {"vars": vars_, "ncases": ncases, "comp": comp, "bias": bias, "nominal": nominal, "vlabels": vlabels}

def read_cases(f, meta, want_slots):
    """Yield dict slot->float (numeric only) for each case, only the wanted slots."""
    nominal, bias, comp = meta["nominal"], meta["bias"], meta["comp"]
    want = set(want_slots)
    row = {}
    pos = 0
    def emit_value(val):
        nonlocal pos, row
        if pos in want: row[pos] = val
        pos += 1
    if comp == 0:
        while True:
            b = f.read(8 * nominal)
            if len(b) < 8 * nominal: return
            vals = struct.unpack("<%dd" % nominal, b)
            yield {s: (None if vals[s] < -1e300 else vals[s]) for s in want}
    buf = b""
    while True:
        ctl = f.read(8)
        if len(ctl) < 8: return
        for c in ctl:
            if c == 0: continue
            if c == 252: return
            if c == 253:
                raw = f.read(8)
                v = struct.unpack("<d", raw)[0]
                emit_value(v)
            elif c == 254: emit_value(None)
            elif c == 255: emit_value(None)
            else: emit_value(c - bias)
            if pos == nominal:
                yield {s: row.get(s) for s in want}
                row, pos = {}, 0
