import { useMemo, useState, type ReactNode } from 'react';
import { Icon } from './Icon';
import { Button, Empty } from './ui';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** Value used for sorting; omit to make the column unsortable. */
  sort?: (row: T) => string | number;
  numeric?: boolean;
  className?: string;
}

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  /** Client side search over this text. Omit to hide the search box. */
  searchText?: (row: T) => string;
  searchLabel?: string;
  tools?: ReactNode;
  pageSize?: number;
  empty?: { title: string; body?: string };
  caption: string;
  initialSort?: { key: string; dir: 'asc' | 'desc' };
}

/** Data table with search, sortable headers and pagination. */
export function DataTable<T>({ rows, columns, rowKey, searchText, searchLabel = 'Search', tools, pageSize = 20, empty, caption, initialSort }: Props<T>) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState(initialSort ?? null);
  const [page, setPage] = useState(0);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let out = needle && searchText ? rows.filter((r) => searchText(r).toLowerCase().includes(needle)) : rows;
    const col = sort && columns.find((c) => c.key === sort.key);
    if (col?.sort) {
      const get = col.sort;
      out = [...out].sort((a, b) => {
        const x = get(a);
        const y = get(b);
        const cmp = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
        return sort?.dir === 'desc' ? -cmp : cmp;
      });
    }
    return out;
  }, [rows, q, sort, columns, searchText]);

  const pages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const current = Math.min(page, pages - 1);
  const visible = filtered.slice(current * pageSize, current * pageSize + pageSize);

  const toggleSort = (key: string) => {
    setPage(0);
    setSort((s) => (s?.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  };

  return (
    <div className="card flush">
      {searchText || tools ? (
        <div className="table-tools">
          {searchText ? (
            <div className="search" style={{ width: 280 }}>
              <Icon name="search" size={16} />
              <input
                aria-label={searchLabel}
                placeholder={searchLabel}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setPage(0);
                }}
              />
            </div>
          ) : null}
          <div className="grow" />
          {tools}
        </div>
      ) : null}
      {visible.length === 0 ? (
        <Empty title={empty?.title ?? 'Nothing here yet'}>{empty?.body}</Empty>
      ) : (
        <div className="table-scroll">
          <table>
            <caption className="sr-only">{caption}</caption>
            <thead>
              <tr>
                {columns.map((c) => {
                  const active = sort?.key === c.key;
                  return (
                    <th key={c.key} className={c.numeric ? 'num' : c.className} aria-sort={active ? (sort?.dir === 'asc' ? 'ascending' : 'descending') : undefined} scope="col">
                      {c.sort ? (
                        <button type="button" onClick={() => toggleSort(c.key)}>
                          {c.header}
                          <Icon name={active ? (sort?.dir === 'asc' ? 'sortAsc' : 'sortDesc') : 'sortNone'} size={14} />
                        </button>
                      ) : (
                        c.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {visible.map((row) => (
                <tr key={rowKey(row)}>
                  {columns.map((c) => (
                    <td key={c.key} className={c.numeric ? 'num' : c.className}>
                      {c.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="pager">
        <span className="muted">
          {filtered.length === 0 ? '0 items' : `${current * pageSize + 1} to ${Math.min(filtered.length, (current + 1) * pageSize)} of ${filtered.length}`}
        </span>
        <div className="row">
          <Button tone="secondary" small icon="back" disabled={current === 0} onClick={() => setPage(current - 1)}>
            Previous
          </Button>
          <Button tone="secondary" small disabled={current >= pages - 1} onClick={() => setPage(current + 1)}>
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
