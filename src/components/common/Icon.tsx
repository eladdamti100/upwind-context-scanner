// Icon.tsx — inline SVG icon set, Lucide-style thin stroke (2px, round caps)
// All presentational — no app state, no business logic, props only.

export type IconName =
  | 'search'
  | 'chevron-down'
  | 'chevron-up'
  | 'plus'
  | 'x'
  | 'check'
  | 'eye'
  | 'more-vertical'
  | 'more-horizontal'
  | 'file'
  | 'key'
  | 'shield'
  | 'globe'
  | 'database'
  | 'settings'
  | 'filter'
  | 'download'
  | 'bell'
  | 'alert-triangle'
  | 'clock'
  | 'snooze'
  | 'thumbs-up'
  | 'thumbs-down'
  | 'info'
  | 'external-link'
  | 'map'
  | 'layers'
  | 'leaf'
  | 'chevron-right'
  | 'chevron-left'
  | 'rotate'
  | 'trash'
  | 'lock'
  | 'flag'
  | 'bar-chart'
  | 'cloud';

const PATHS: Record<IconName, string> = {
  'search':
    'M11 17a6 6 0 1 0 0-12 6 6 0 0 0 0 12zm4.243-1.757 3.514 3.514',
  'chevron-down':
    'M6 9l6 6 6-6',
  'chevron-up':
    'M18 15l-6-6-6 6',
  'plus':
    'M12 5v14M5 12h14',
  'x':
    'M18 6 6 18M6 6l12 12',
  'check':
    'M20 6 9 17l-5-5',
  'eye':
    'M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm11-3a3 3 0 1 1 0 6 3 3 0 0 1 0-6z',
  'more-vertical':
    'M12 5a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm0 7a1 1 0 1 0 0-2 1 1 0 0 0 0 2z',
  'more-horizontal':
    'M5 12a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm7 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0zm7 0a1 1 0 1 0-2 0 1 1 0 0 0 2 0z',
  'file':
    'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zm0 0v6h6',
  'key':
    'M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4',
  'shield':
    'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  'globe':
    'M12 2a10 10 0 1 0 0 20A10 10 0 0 0 12 2zm0 0c-2.8 3.3-4 6.6-4 10s1.2 6.7 4 10m0-20c2.8 3.3 4 6.6 4 10s-1.2 6.7-4 10M2 12h20',
  'database':
    'M12 2c4.97 0 9 1.12 9 2.5v3C21 8.88 16.97 10 12 10S3 8.88 3 7.5v-3C3 3.12 7.03 2 12 2zm9 6v5c0 1.38-4.03 2.5-9 2.5S3 14.38 3 13V8m18 5v5c0 1.38-4.03 2.5-9 2.5S3 19.38 3 18v-5',
  'settings':
    'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.2-2.4c.05-.32.08-.65.08-.98s-.03-.67-.08-1l2.16-1.69a.5.5 0 0 0 .12-.64l-2.04-3.53a.5.5 0 0 0-.61-.22l-2.55 1.03a7.32 7.32 0 0 0-1.67-.97l-.39-2.71A.49.49 0 0 0 13.77 2h-4.08a.49.49 0 0 0-.49.42l-.39 2.71a7.32 7.32 0 0 0-1.67.97L4.59 5.07a.5.5 0 0 0-.61.22L1.94 8.82a.49.49 0 0 0 .12.64L4.22 11.1c-.05.33-.08.67-.08 1s.03.66.08.98l-2.16 1.69a.5.5 0 0 0-.12.64l2.04 3.53a.5.5 0 0 0 .61.22l2.55-1.03c.52.37 1.08.68 1.67.97l.39 2.71c.06.24.27.42.49.42h4.08c.22 0 .43-.18.49-.42l.39-2.71a7.32 7.32 0 0 0 1.67-.97l2.55 1.03a.5.5 0 0 0 .61-.22l2.04-3.53a.49.49 0 0 0-.12-.64l-2.16-1.69z',
  'filter':
    'M22 3H2l8 9.46V19l4 2v-8.54z',
  'download':
    'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
  'bell':
    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9m-4.27 13a2 2 0 0 1-3.46 0',
  'alert-triangle':
    'M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4m0 4h.01',
  'clock':
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 6v6l4 2',
  'snooze':
    'M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M9 21a3 3 0 0 0 6 0M9 3.6a6 6 0 0 1 6 0M7 16h10l-4-4h4',
  'thumbs-up':
    'M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zm-7 11H5a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h2',
  'thumbs-down':
    'M10 15v4a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zm7-13h2a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-2',
  'info':
    'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zm0-14v4m0 4h.01',
  'external-link':
    'M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6m4-3h6v6m-11 5L21 3',
  'map':
    'M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4zm7-4v16m8-12v16',
  'layers':
    'M12 2 2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5',
  'leaf':
    'M6.3 20.3a2.4 2.4 0 0 0 3.4 0L12 18l6-6a8 8 0 0 0-12-10.49C4.69 3.81 3 7 3 11c0 2.12.74 4.07 1.97 5.6L2.3 19.3a1 1 0 0 0 0 1.4l.6.6a1 1 0 0 0 1.4 0l2-2zM12 18l-2-2',
  'chevron-right':
    'M9 18l6-6-6-6',
  'chevron-left':
    'M15 18l-6-6 6-6',
  'rotate':
    'M21 12a9 9 0 1 1-2.64-6.36M21 4v4h-4',
  'trash':
    'M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6',
  'lock':
    'M5 11a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-8zM8 11V7a4 4 0 0 1 8 0v4',
  'flag':
    'M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1zM4 22v-7',
  'bar-chart':
    'M3 3v18h18M8 17v-5M13 17V8M18 17v-9',
  'cloud':
    'M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z',
};

export function Icon({
  name,
  size = 16,
  stroke = 'currentColor',
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  stroke?: string;
  strokeWidth?: number;
}) {
  const d = PATHS[name];
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      width={size}
      height={size}
      aria-hidden="true"
    >
      {d ? <path d={d} /> : null}
    </svg>
  );
}
