'use client';

import { type ReactNode } from 'react';
import DataTable, { type DataTableColumn } from './data-table';
import ChannelLogo from './channel-logo';
import ChannelRowActions from './channel-row-actions';

interface ChannelActions {
  onDetail?: () => void;
  onPlay?: () => void;
  onTest?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  testing?: boolean;
}

interface ChannelDataTableProps<T> {
  data: T[];
  gridTemplate: string;
  ariaLabel: string;
  emptyMessage?: string;
  rowKey: (item: T) => string;
  breakpoint?: 'md' | 'lg';
  rowClassName?: string | ((item: T) => string);
  getName: (item: T) => string;
  getLogo: (item: T) => string | undefined;
  onDetail: (item: T) => void;
  nameHeader?: ReactNode;
  nameAriaSort?: 'ascending' | 'descending' | 'none';
  columns: DataTableColumn<T>[];
  getActions: (item: T) => ChannelActions;
}

const HEADER_TEXT = 'text-xs uppercase tracking-[0.15em] text-muted-foreground font-medium';

export default function ChannelDataTable<T>({
  data,
  gridTemplate,
  ariaLabel,
  emptyMessage,
  rowKey,
  breakpoint,
  rowClassName,
  getName,
  getLogo,
  onDetail,
  nameHeader,
  nameAriaSort,
  columns,
  getActions,
}: ChannelDataTableProps<T>) {
  const allColumns: DataTableColumn<T>[] = [
    {
      key: 'name',
      ariaSort: nameAriaSort,
      mobileStyle: 'flex:1;min-width:0',
      header: nameHeader || <span className={HEADER_TEXT}>Name</span>,
      cell: (item) => (
        <div
          tabIndex={0}
          aria-label={getName(item)}
          className="flex items-center gap-3 min-w-0 cursor-pointer"
          onClick={() => onDetail(item)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onDetail(item);
            }
          }}
        >
          <ChannelLogo src={getLogo(item)} alt={`${getName(item)} logo`} size="sm" />
          <span className="text-sm font-medium truncate">{getName(item)}</span>
        </div>
      ),
    },
    ...columns,
    {
      key: 'actions',
      headerClassName: `text-right`,
      mobileStyle: 'margin-left:auto',
      header: <span className={HEADER_TEXT}>Actions</span>,
      cell: (item) => <ChannelRowActions {...getActions(item)} />,
    },
  ];

  return (
    <DataTable
      columns={allColumns}
      data={data}
      gridTemplate={gridTemplate}
      ariaLabel={ariaLabel}
      emptyMessage={emptyMessage}
      rowKey={rowKey}
      breakpoint={breakpoint}
      rowClassName={rowClassName}
    />
  );
}
