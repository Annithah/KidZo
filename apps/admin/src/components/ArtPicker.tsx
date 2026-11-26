import { useMemo, useState } from 'react';
import { ART, artLabel, type ArtGroup } from '@kidzo/art';
import { Art } from './Art';
import { Icon } from './Icon';
import { Modal } from './feedback';

const GROUP_LABELS: Partial<Record<ArtGroup, string>> = {
  sticker: 'Stickers',
  object: 'Objects',
  category: 'Categories',
  zo: 'Zo',
  scene: 'Scenes',
  avatar: 'Avatars',
};

/** Visual grid of art keys from the shared library. Replaces free-text emoji fields. */
export function ArtPicker({
  value,
  onChange,
  groups = ['object', 'zo', 'scene'],
  label,
  color,
  id,
  invalid,
}: {
  value: string;
  onChange: (key: string) => void;
  groups?: ArtGroup[];
  label: string;
  color?: string;
  id?: string;
  invalid?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [group, setGroup] = useState<ArtGroup>(groups[0] ?? 'object');
  const [q, setQ] = useState('');
  const options = useMemo(
    () => [...ART.values()].filter((a) => a.group === group && (!q.trim() || a.label.toLowerCase().includes(q.trim().toLowerCase()))),
    [group, q],
  );

  return (
    <>
      <button type="button" id={id} className="art-pick" aria-invalid={invalid} aria-label={`${label}: ${artLabel(value)}. Change`} onClick={() => setOpen(true)}>
        <span className="art-swatch" style={{ background: color ?? 'var(--surface-sunken)', width: 44, height: 44 }}>
          <Art art={value} size={38} />
        </span>
        <span>{artLabel(value)}</span>
        <Icon name="chevronDown" size={14} />
      </button>
      <Modal open={open} title={label} onClose={() => setOpen(false)} wide>
        <div className="row">
          {groups.length > 1 ? (
            <div className="art-tabs" role="tablist">
              {groups.map((g) => (
                <button key={g} type="button" role="tab" aria-selected={g === group} className="chip" aria-pressed={g === group} onClick={() => setGroup(g)}>
                  {GROUP_LABELS[g] ?? g}
                </button>
              ))}
            </div>
          ) : null}
          <div className="search" style={{ marginLeft: 'auto', width: 220 }}>
            <Icon name="search" size={16} />
            <input aria-label="Search pictures" placeholder="Search pictures" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
        </div>
        <div className="art-grid" role="listbox" aria-label={label}>
          {options.map((a) => (
            <button
              key={a.key}
              type="button"
              role="option"
              aria-selected={a.key === value}
              className="art-option"
              aria-pressed={a.key === value}
              onClick={() => {
                onChange(a.key);
                setOpen(false);
              }}
            >
              <Art art={a.key} size={56} />
              {a.label}
            </button>
          ))}
        </div>
      </Modal>
    </>
  );
}
