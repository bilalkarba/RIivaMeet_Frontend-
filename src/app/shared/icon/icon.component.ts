import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

/**
 * Icons.
 *
 * Hand-drawn inline SVG on a 24×24 grid, stroked with `currentColor` so icons inherit
 * text colour (and therefore work on both cream and forest backgrounds). No icon font,
 * no runtime dependency, no emoji.
 */

interface IconDefinition {
  /** Stroked path data. */
  paths?: readonly string[];
  /** `[cx, cy, r]` triplets. */
  circles?: readonly (readonly [number, number, number])[];
  /** Filled silhouette instead of an outline. */
  fill?: boolean;
}

const CIRCLE_85: readonly (readonly [number, number, number])[] = [[12, 12, 8.5]];

const ICONS: Record<string, IconDefinition> = {
  menu: { paths: ['M4 7h16', 'M4 12h16', 'M4 17h16'] },
  close: { paths: ['M6.5 6.5l11 11', 'M17.5 6.5l-11 11'] },
  'chevron-down': { paths: ['M6 9.5l6 6 6-6'] },
  'chevron-left': { paths: ['M14.5 6l-6 6 6 6'] },
  'chevron-right': { paths: ['M9.5 6l6 6-6 6'] },
  'arrow-right': { paths: ['M4.5 12h14', 'M12.5 6l6 6-6 6'] },
  'arrow-left': { paths: ['M19.5 12h-14', 'M11.5 6l-6 6 6 6'] },
  search: { circles: [[10.8, 10.8, 6.6]], paths: ['M20 20l-4.3-4.3'] },
  'map-pin': {
    paths: ['M12 21s7-6.1 7-11.1a7 7 0 0 0-14 0C5 14.9 12 21 12 21z', 'M12 12.6a2.6 2.6 0 1 0 0-5.2 2.6 2.6 0 0 0 0 5.2z'],
  },
  locate: { paths: ['M12 3.2l7.4 17.6-7.4-4.2-7.4 4.2L12 3.2z'] },
  compass: { circles: CIRCLE_85, paths: ['M15.2 8.8l-2 4.4-4.4 2 2-4.4 4.4-2z'] },
  star: {
    fill: true,
    paths: ['M12 3.6l2.6 5.3 5.8.85-4.2 4.1 1 5.8L12 16.9l-5.2 2.75 1-5.8-4.2-4.1 5.8-.85L12 3.6z'],
  },
  'star-outline': {
    paths: ['M12 4.6l2.2 4.5 4.9.7-3.55 3.45.85 4.9L12 15.8l-4.4 2.35.85-4.9L4.9 9.8l4.9-.7L12 4.6z'],
  },
  user: { circles: [[12, 8, 3.9]], paths: ['M4.6 20c0-3.4 3.3-5.3 7.4-5.3s7.4 1.9 7.4 5.3'] },
  users: {
    circles: [[9.4, 8.4, 3.4]],
    paths: ['M2.6 19.8c0-3 2.9-4.7 6.8-4.7s6.8 1.7 6.8 4.7', 'M16.2 5.3a3.4 3.4 0 0 1 0 6.2', 'M18.4 15.4c1.9.5 3 1.7 3 3.4'],
  },
  'log-out': { paths: ['M14.4 4.5h4.1a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-4.1', 'M9.5 12h9.2', 'M15.4 8.4l3.4 3.6-3.4 3.6'] },
  calendar: {
    paths: [
      'M4.2 7.2a1.2 1.2 0 0 1 1.2-1.2h13.2a1.2 1.2 0 0 1 1.2 1.2v12.4a1.2 1.2 0 0 1-1.2 1.2H5.4a1.2 1.2 0 0 1-1.2-1.2V7.2z',
      'M4.2 11h15.6',
      'M8.6 3.6v3.2',
      'M15.4 3.6v3.2',
    ],
  },
  clock: { circles: CIRCLE_85, paths: ['M12 7.4V12l3.2 2.1'] },
  check: { paths: ['M5 12.6l4.4 4.4L19 7.6'] },
  'check-circle': { circles: CIRCLE_85, paths: ['M8.2 12.3l2.7 2.7 5-5.8'] },
  alert: { paths: ['M12 3.8l8.6 15.4H3.4L12 3.8z', 'M12 9.8v4.3', 'M12 16.8v.1'] },
  info: { circles: CIRCLE_85, paths: ['M12 11.2v5', 'M12 8v.1'] },
  'x-circle': { circles: CIRCLE_85, paths: ['M9.6 9.6l4.8 4.8', 'M14.4 9.6l-4.8 4.8'] },
  trash: {
    paths: ['M4.6 7.2h14.8', 'M9.4 7.2V5.2h5.2v2', 'M6.8 7.2l.8 12a1 1 0 0 0 1 .9h7a1 1 0 0 0 1-.9l.8-12', 'M10.4 11v5.6', 'M13.6 11v5.6'],
  },
  plus: { paths: ['M12 5.2v13.6', 'M5.2 12h13.6'] },
  globe: { circles: CIRCLE_85, paths: ['M3.5 12h17', 'M12 3.5c2.4 2.4 3.7 5.4 3.7 8.5s-1.3 6.1-3.7 8.5c-2.4-2.4-3.7-5.4-3.7-8.5S9.6 5.9 12 3.5z'] },
  sliders: {
    paths: ['M4 7.6h8.4', 'M17.6 7.6H20', 'M4 16.4h3.4', 'M12.6 16.4H20'],
    circles: [
      [15.2, 7.6, 2.3],
      [9.8, 16.4, 2.3],
    ],
  },
  filter: { paths: ['M4 6.6h16', 'M7 12h10', 'M10 17.4h4'] },
  mail: { paths: ['M3.6 6.6h16.8v11H3.6z', 'M3.6 7.2l8.4 6 8.4-6'] },
  phone: {
    paths: [
      'M6.8 3.8h3l1.5 3.8-2 1.6a11.4 11.4 0 0 0 5.5 5.5l1.6-2 3.8 1.5v3a1.5 1.5 0 0 1-1.7 1.5C11.8 18 5.9 12.1 5.3 5.5a1.5 1.5 0 0 1 1.5-1.7z',
    ],
  },
  lock: { paths: ['M6.6 10.6h10.8v9H6.6z', 'M9.2 10.6V8.2a2.8 2.8 0 0 1 5.6 0v2.4'] },
  eye: { paths: ['M2.6 12S6.2 6.6 12 6.6 21.4 12 21.4 12 17.8 17.4 12 17.4 2.6 12 2.6 12z'], circles: [[12, 12, 2.6]] },
  'eye-off': { paths: ['M4 4l16 16', 'M10 5.3A9.8 9.8 0 0 1 12 5.1c5.8 0 9.4 5.4 9.4 5.4a17.6 17.6 0 0 1-3.1 3.9', 'M6.4 7.7A16.9 16.9 0 0 0 2.6 10.5S6.2 15.9 12 15.9a9.8 9.8 0 0 0 3.9-.8'] },
  sparkles: {
    paths: ['M11.4 3.8l1.7 4.5 4.5 1.7-4.5 1.7-1.7 4.5-1.7-4.5L5.2 10l4.5-1.7 1.7-4.5z', 'M18.4 14.4l.8 2.1 2.1.8-2.1.8-.8 2.1-.8-2.1-2.1-.8 2.1-.8.8-2.1z'],
  },
  shield: { paths: ['M12 3.4l7 2.6v5.4c0 4.3-2.9 7.7-7 9.2-4.1-1.5-7-4.9-7-9.2V6l7-2.6z', 'M9.2 12l2.2 2.2 4-4.6'] },
  wallet: { paths: ['M4.2 8.4h15.6v10.4H4.2z', 'M4.2 8.4a2.4 2.4 0 0 1 2.4-2.4h9.6v2.4', 'M16.2 13.6h.1'] },
  refresh: {
    paths: ['M20 11.2a8 8 0 0 0-13.7-5.1L3.8 8.6', 'M3.8 4.4v4.2h4.2', 'M4 12.8a8 8 0 0 0 13.7 5.1l2.5-2.5', 'M20.2 19.6v-4.2h-4.2'],
  },
  'external-link': { paths: ['M14 4.4h5.6v5.6', 'M19.6 4.4l-8 8', 'M18 14v5a1.2 1.2 0 0 1-1.2 1.2H5.4A1.2 1.2 0 0 1 4.2 19V7.6A1.2 1.2 0 0 1 5.4 6.4h5'] },
  dashboard: { paths: ['M4.2 4.6h6.8v6H4.2z', 'M13 4.6h6.8v4H13z', 'M13 10.6h6.8v8.8H13z', 'M4.2 12.6h6.8v6.8H4.2z'] },
  image: {
    paths: ['M4.2 5.6h15.6v12.8H4.2z', 'M4.2 15.2l4.6-4.6 4 4 3-2.6 4 3.6'],
    circles: [[9.2, 9.4, 1.4]],
  },
  inbox: { paths: ['M3.4 12.6h4.2l1.5 2.6h5.8l1.5-2.6h4.2', 'M3.4 12.6l2.6-7h12l2.6 7v6.6H3.4v-6.6z'] },
  play: { paths: ['M9 7.4l8 4.6-8 4.6z'] },
  // --- Calls --------------------------------------------------------------
  video: {
    paths: ['M4.2 6.6h9.6a1.2 1.2 0 0 1 1.2 1.2v8.4a1.2 1.2 0 0 1-1.2 1.2H4.2z', 'M15 10.2l4.8-2.8v9.2L15 13.8v-3.6z'],
  },
  'video-off': {
    paths: ['M4.2 6.6h9.6a1.2 1.2 0 0 1 1.2 1.2v8.4a1.2 1.2 0 0 1-1.2 1.2H4.2z', 'M15 10.2l4.8-2.8v9.2L15 13.8v-3.6z', 'M3.6 3.6l16.8 16.8'],
  },
  mic: {
    paths: ['M12 4.4a2.4 2.4 0 0 1 2.4 2.4v4.4a2.4 2.4 0 0 1-4.8 0V6.8A2.4 2.4 0 0 1 12 4.4z', 'M6.8 11.4a5.2 5.2 0 0 0 10.4 0', 'M12 16.6v3.2'],
  },
  'mic-off': {
    paths: ['M3.6 3.6l16.8 16.8', 'M6.8 11.4a5.2 5.2 0 0 0 8 4.5', 'M12 16.6v3.2', 'M9.6 5.4a2.4 2.4 0 0 1 4.8 1.4v4.4'],
  },
  'phone-off': {
    paths: [
      'M6.8 3.8h3l1.5 3.8-2 1.6a11.4 11.4 0 0 0 5.5 5.5l1.6-2 3.8 1.5v3a1.5 1.5 0 0 1-1.7 1.5C11.8 18 5.9 12.1 5.3 5.5a1.5 1.5 0 0 1 1.5-1.7z',
      'M3.6 3.6l16.8 16.8',
    ],
  },
  // --- Sports -------------------------------------------------------------
  dumbbell: { paths: ['M4 10.2v3.6', 'M7.2 8v8', 'M16.8 8v8', 'M20 10.2v3.6', 'M7.2 12h9.6'] },
  glove: {
    paths: [
      'M8.6 7.6A5.6 5.6 0 0 1 14.2 2h.6a5.6 5.6 0 0 1 5.6 5.6V12a5 5 0 0 1-5 5H8.6A4.6 4.6 0 0 1 4 12.4V12a4.4 4.4 0 0 1 4.6-4.4z',
      'M4.6 20.6h11.2',
    ],
  },
  swimmer: {
    circles: [[14.4, 6.8, 1.9]],
    paths: [
      'M7.6 12.6l3.6-2.6 2.8 2.6 3.2-1.6',
      'M4 17.4c1.5 0 2.6-1.1 4.2-1.1s2.6 1.1 4.2 1.1 2.6-1.1 4.2-1.1 2.6 1.1 4.2 1.1',
      'M4 21c1.5 0 2.6-1.1 4.2-1.1s2.6 1.1 4.2 1.1 2.6-1.1 4.2-1.1 2.6 1.1 4.2 1.1',
    ],
  },
  football: {
    circles: CIRCLE_85,
    paths: ['M12 8.4l3 2.2-1.1 3.5H10.1L9 10.6 12 8.4z', 'M12 3.5v4.9', 'M4.3 9.5l4.9 1.3', 'M19.7 9.5l-4.9 1.3', 'M7.5 19l2.6-4.9', 'M16.5 19l-2.6-4.9'],
  },
  tennis: { circles: CIRCLE_85, paths: ['M6.2 5.9A9.4 9.4 0 0 1 8.5 18.6', 'M17.8 18.1A9.4 9.4 0 0 1 15.5 5.4'] },
  whistle: { paths: ['M3.6 9.4h11.8v4.2a5.2 5.2 0 1 1-5.2-5.2H3.6z', 'M15.4 9.4h5v0a2.2 2.2 0 0 1-2.2 2.2h-2.8', 'M7.4 15.6h.1'], circles: [[10.2, 13.8, 2.6]] },
  medal: { circles: [[12, 14.6, 4.6]], paths: ['M8.5 4.2l3.5 6.2-3 5.3-3.5-6.2z', 'M15.5 4.2l-3.5 6.2 3 5.3 3.5-6.2z'] },
  spark: { fill: true, paths: ['M12 3.2l1.9 6.4 6.4 1.9-6.4 1.9L12 19.8l-1.9-6.4-6.4-1.9 6.4-1.9L12 3.2z'] },
  circle: { circles: CIRCLE_85 },
};

type IconName = keyof typeof ICONS;

@Component({
  selector: 'app-icon',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { 'aria-hidden': 'true' },
  template: `
    <svg
      [attr.viewBox]="'0 0 24 24'"
      [attr.width]="size()"
      [attr.height]="size()"
      [attr.fill]="definition().fill ? 'currentColor' : 'none'"
      [attr.stroke]="definition().fill ? 'none' : 'currentColor'"
      stroke-width="1.7"
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
    >
      @for (circle of definition().circles ?? []; track $index) {
        <circle [attr.cx]="circle[0]" [attr.cy]="circle[1]" [attr.r]="circle[2]" />
      }
      @for (path of definition().paths ?? []; track $index) {
        <path [attr.d]="path" />
      }
    </svg>
  `,
  styles: `
    :host {
      display: inline-flex;
      flex: none;
      line-height: 0;
    }
  `,
})
export class IconComponent {
  readonly name = input.required<string>();
  readonly size = input(20);

  protected readonly definition = computed<IconDefinition>(() => ICONS[this.name()] ?? ICONS['circle']);
}

export type { IconName };
