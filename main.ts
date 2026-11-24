// THE WORLD IN ONE DAY — news-image-20261124
// Single-file Node program: draws a 1024x1024 newspaper-style PNG summarising
// 24 November 2026 world news. Node stdlib only (node:zlib, node:fs, node:path).
// No network, no image API, no fonts from disk — own 5x7 bitmap font + own PNG encoder.
// Fully deterministic: two runs produce byte-identical output.
import { deflateSync } from "node:zlib";
import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

process.umask(0o022);

// ---------------------------------------------------------------- canvas
const W = 1024;
const H = 1024;
const PAPER: [number, number, number] = [246, 242, 233];
const NAVY: [number, number, number] = [18, 32, 62];
const GOLD: [number, number, number] = [201, 162, 39];
const INK: [number, number, number] = [28, 28, 28];
const GREY: [number, number, number] = [96, 92, 84];
const RED: [number, number, number] = [178, 34, 34];
const CARD: [number, number, number] = [255, 253, 247];
const BORDER: [number, number, number] = [198, 188, 168];
const WHITE: [number, number, number] = [255, 255, 255];
const TEAL: [number, number, number] = [24, 110, 96];

type RGB = [number, number, number];
const px = new Uint8Array(W * H * 3);
function fill(c: RGB): void {
  for (let i = 0; i < W * H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}
function setPix(x: number, y: number, c: RGB): void {
  if (x < 0 || y < 0 || x >= W || y >= H) return;
  const i = (y * W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}
function fillRect(x: number, y: number, w: number, h: number, c: RGB): void {
  for (let j = y; j < y + h; j++)
    for (let i = x; i < x + w; i++) setPix(i, j, c);
}
function rectBorder(x: number, y: number, w: number, h: number, c: RGB, t = 1): void {
  fillRect(x, y, w, t, c);
  fillRect(x, y + h - t, w, t, c);
  fillRect(x, y, t, h, c);
  fillRect(x + w - t, y, t, h, c);
}
function hline(x0: number, x1: number, y: number, c: RGB, t = 1): void {
  fillRect(x0, y, x1 - x0, t, c);
}
function drawLine(x0: number, y0: number, x1: number, y1: number, c: RGB, t = 1): void {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    fillRect(x - Math.floor(t / 2), y - Math.floor(t / 2), t, t, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
}
function fillCircle(cx: number, cy: number, r: number, c: RGB): void {
  for (let y = -r; y <= r; y++)
    for (let x = -r; x <= r; x++)
      if (x * x + y * y <= r * r) setPix(cx + x, cy + y, c);
}
function circleOutline(cx: number, cy: number, r: number, c: RGB): void {
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    setPix(Math.round(cx + r * Math.cos(rad)), Math.round(cy + r * Math.sin(rad)), c);
  }
}

// ---------------------------------------------------------------- 5x7 font
// Each glyph: 7 rows, each row a 5-bit number (bit 4 = leftmost column).
const FONT: Record<string, number[]> = {
  A: [0x0e, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  B: [0x1e, 0x11, 0x11, 0x1e, 0x11, 0x11, 0x1e],
  C: [0x0e, 0x11, 0x10, 0x10, 0x10, 0x11, 0x0e],
  D: [0x1e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x1e],
  E: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x1f],
  F: [0x1f, 0x10, 0x10, 0x1e, 0x10, 0x10, 0x10],
  G: [0x0e, 0x11, 0x10, 0x17, 0x11, 0x11, 0x0f],
  H: [0x11, 0x11, 0x11, 0x1f, 0x11, 0x11, 0x11],
  I: [0x0e, 0x04, 0x04, 0x04, 0x04, 0x04, 0x0e],
  J: [0x07, 0x02, 0x02, 0x02, 0x02, 0x12, 0x0c],
  K: [0x11, 0x12, 0x14, 0x18, 0x14, 0x12, 0x11],
  L: [0x10, 0x10, 0x10, 0x10, 0x10, 0x10, 0x1f],
  M: [0x11, 0x1b, 0x15, 0x15, 0x11, 0x11, 0x11],
  N: [0x11, 0x19, 0x15, 0x13, 0x11, 0x11, 0x11],
  O: [0x0e, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  P: [0x1e, 0x11, 0x11, 0x1e, 0x10, 0x10, 0x10],
  Q: [0x0e, 0x11, 0x11, 0x11, 0x15, 0x12, 0x0d],
  R: [0x1e, 0x11, 0x11, 0x1e, 0x14, 0x12, 0x11],
  S: [0x0f, 0x10, 0x10, 0x0e, 0x01, 0x01, 0x1e],
  T: [0x1f, 0x04, 0x04, 0x04, 0x04, 0x04, 0x04],
  U: [0x11, 0x11, 0x11, 0x11, 0x11, 0x11, 0x0e],
  V: [0x11, 0x11, 0x11, 0x11, 0x11, 0x0a, 0x04],
  W: [0x11, 0x11, 0x11, 0x15, 0x15, 0x1b, 0x11],
  X: [0x11, 0x11, 0x0a, 0x04, 0x0a, 0x11, 0x11],
  Y: [0x11, 0x11, 0x0a, 0x04, 0x04, 0x04, 0x04],
  Z: [0x1f, 0x01, 0x02, 0x04, 0x08, 0x10, 0x1f],
  "0": [0x0e, 0x11, 0x13, 0x15, 0x19, 0x11, 0x0e],
  "1": [0x04, 0x0c, 0x04, 0x04, 0x04, 0x04, 0x0e],
  "2": [0x0e, 0x11, 0x01, 0x06, 0x08, 0x10, 0x1f],
  "3": [0x1f, 0x02, 0x04, 0x02, 0x01, 0x11, 0x0e],
  "4": [0x02, 0x06, 0x0a, 0x12, 0x1f, 0x02, 0x02],
  "5": [0x1f, 0x10, 0x1e, 0x01, 0x01, 0x11, 0x0e],
  "6": [0x06, 0x08, 0x10, 0x1e, 0x11, 0x11, 0x0e],
  "7": [0x1f, 0x01, 0x02, 0x04, 0x08, 0x08, 0x08],
  "8": [0x0e, 0x11, 0x11, 0x0e, 0x11, 0x11, 0x0e],
  "9": [0x0e, 0x11, 0x11, 0x0f, 0x01, 0x02, 0x0c],
  " ": [0, 0, 0, 0, 0, 0, 0],
  ".": [0, 0, 0, 0, 0, 0x0c, 0x0c],
  ",": [0, 0, 0, 0, 0x0c, 0x04, 0x08],
  ":": [0, 0x0c, 0x0c, 0, 0x0c, 0x0c, 0],
  ";": [0, 0x0c, 0x0c, 0, 0x0c, 0x04, 0x08],
  "-": [0, 0, 0, 0x0e, 0, 0, 0],
  "'": [0x04, 0x04, 0x08, 0, 0, 0, 0],
  "%": [0x19, 0x19, 0x02, 0x04, 0x08, 0x13, 0x13],
  $: [0x04, 0x0f, 0x14, 0x0e, 0x05, 0x1e, 0x04],
  "/": [0x01, 0x01, 0x02, 0x04, 0x08, 0x10, 0x10],
  "(": [0x02, 0x04, 0x08, 0x08, 0x08, 0x04, 0x02],
  ")": [0x08, 0x04, 0x02, 0x02, 0x02, 0x04, 0x08],
  "&": [0x0c, 0x12, 0x14, 0x08, 0x15, 0x12, 0x0d],
  "!": [0x04, 0x04, 0x04, 0x04, 0x04, 0, 0x04],
  "?": [0x0e, 0x11, 0x01, 0x02, 0x04, 0, 0x04],
  "+": [0, 0x04, 0x04, 0x1f, 0x04, 0x04, 0],
  "=": [0, 0, 0x1f, 0, 0x1f, 0, 0],
  '"': [0x0a, 0x0a, 0x0a, 0, 0, 0, 0],
  _: [0, 0, 0, 0, 0, 0, 0x1f],
  "#": [0x0a, 0x0a, 0x1f, 0x0a, 0x1f, 0x0a, 0x0a],
  "*": [0, 0x04, 0x15, 0x0e, 0x15, 0x04, 0],
  "@": [0x0e, 0x11, 0x17, 0x15, 0x16, 0x10, 0x0e],
  "<": [0x02, 0x04, 0x08, 0x10, 0x08, 0x04, 0x02],
  ">": [0x08, 0x04, 0x02, 0x01, 0x02, 0x04, 0x08],
};
const BLANK = [0, 0, 0, 0, 0, 0, 0];

function textWidth(s: string, scale: number): number {
  if (!s) return 0;
  return s.length * 6 * scale - scale;
}
function drawText(x: number, y: number, s: string, scale: number, c: RGB): void {
  const up = s.toUpperCase();
  for (let ci = 0; ci < up.length; ci++) {
    const g = FONT[up[ci]] ?? BLANK;
    const ox = x + ci * 6 * scale;
    for (let r = 0; r < 7; r++)
      for (let col = 0; col < 5; col++)
        if (g[r] & (1 << (4 - col)))
          fillRect(ox + col * scale, y + r * scale, scale, scale, c);
  }
}
function drawTextCentered(cx: number, y: number, s: string, scale: number, c: RGB): void {
  drawText(cx - Math.floor(textWidth(s, scale) / 2), y, s, scale, c);
}
function wrapText(s: string, maxChars: number): string[] {
  const words = s.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const w of words) {
    if (!cur) {
      cur = w;
    } else if (cur.length + 1 + w.length <= maxChars) {
      cur += " " + w;
    } else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}
function drawWrapped(x: number, y: number, s: string, scale: number, maxChars: number, maxLines: number, c: RGB): number {
  const lines = wrapText(s, maxChars).slice(0, maxLines);
  lines.forEach((ln, i) => drawText(x, y + i * (7 * scale + 4), ln, scale, c));
  return lines.length;
}
function truncate(s: string, maxChars: number): string {
  if (s.length <= maxChars) return s;
  return s.slice(0, maxChars - 1) + ".";
}

// ---------------------------------------------------------------- PNG encoder
const CRC_TABLE: number[] = (() => {
  const t: number[] = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf: Buffer): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type, "ascii"), data])), 8 + data.length);
  return out;
}
function encodePNG(w: number, h: number, rgb: Uint8Array): Buffer {
  const raw = Buffer.alloc(h * (1 + w * 3));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 3)] = 0; // filter: none
    Buffer.from(rgb.buffer, rgb.byteOffset + y * w * 3, w * 3).copy(raw, y * (1 + w * 3) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: truecolour RGB
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------- stories
const LEAD_HEADLINE =
  "Nvidia shares surge 31% as Jensen Huang returns as CEO; Wall Street rallies";
const LEAD_DECK = [
  "Nasdaq 100 up 6.5%, S&P 500 up 4.7% as chip stocks lead a broad rebound.",
  "Gold up 2.9% to $3,661 an ounce.",
];

interface Featured {
  tag: string;
  headline: string;
  icon: number;
}
const FEATURED: Featured[] = [
  { tag: "EU", headline: "European Commission unveils latest sanctions package against Russia", icon: 0 },
  { tag: "ME", headline: "Iran vows every means to counter US Hormuz blockade after Trump threat", icon: 1 },
  { tag: "AS", headline: "Indonesia factory fire kills 24; rescuers search for 34 missing workers", icon: 2 },
  { tag: "AM", headline: "Democrats clinch historic House majority of at least 258 seats", icon: 3 },
  { tag: "AF", headline: "German President Steinmeier arrives in Ghana on state visit", icon: 4 },
  { tag: "SP", headline: "India-New Zealand first Test ends in a draw at Wellington", icon: 5 },
];

// 43 list stories: [tag, headline]
const LIST: [string, string][] = [
  ["EU", "UK sanctions top Myanmar military leaders after ICJ genocide ruling"],
  ["EU", "Catherine talks about mortality in new documentary clip"],
  ["EU", "Denmark to ban phones in schools from autumn 2027"],
  ["EU", "EU admits data breach after AI-generated cyberattack"],
  ["EU", "Romania rescuers find Ukrainian casualties in snow-hit peak"],
  ["EU", "Thousands flee Manchester concert after unknown substance released"],
  ["EU", "UK confirmed as 2035 Women's World Cup host"],
  ["AS", "PM Modi inaugurates AI centre at IIT Patna, launches Rs 400 crore research park"],
  ["AS", "India and China hold military talks in Arunachal Pradesh to ease border tensions"],
  ["AS", "World Chess Championship: Gukesh defends title against Sindarov in Geneva"],
  ["AS", "South Korea president picks new foreign minister and intelligence chief"],
  ["AS", "China sets 2030 elderly-care and childcare targets"],
  ["AS", "Bangladesh vows to arrest Sheikh Hasina if she returns from India"],
  ["AS", "CJP's Saurav Das says stopped at Delhi airport from travelling to UK"],
  ["ME", "Oxfam report: Gaza contamination threatens Palestinians for decades"],
  ["ME", "IRGC Navy: mine blasts set three oil tankers ablaze in Strait of Hormuz"],
  ["ME", "UKMTO reports tanker incident involving military forces in Gulf of Oman"],
  ["ME", "Israel's incoming leader: no imminent Iran threat before government forms"],
  ["ME", "Settler arson hits five Palestinian villages in West Bank overnight"],
  ["ME", "Saudi Arabia condemns attack on UN building in Khartoum"],
  ["AM", "Waymo suspends driverless taxis from all US freeways"],
  ["AM", "Trump backs Nvidia board decision to reinstate Jensen Huang"],
  ["AM", "Democrats plan 12 debates for 2028 presidential primary, first in June"],
  ["AM", "Trump orders US Army to pause lead azide detonation in Iowa"],
  ["AM", "Colombia files charges over Starlink over prison communications"],
  ["AM", "Father and daughter detained by ICE at Seattle airport en route to baptism"],
  ["AF", "At least 24 civilians killed in South Sudan's Warrap State"],
  ["AF", "Kenya joins Africa CDC governing board for two-year term"],
  ["AF", "Kenya and DRC agree to restore full diplomatic relations"],
  ["AF", "Ghana beat Morocco 1-0 to win Amputee Football World Cup"],
  ["AF", "Heavy fighting in Ituri traps DR Congo Ebola responders"],
  ["AF", "Gambia intercepts 491 would-be irregular migrants"],
  ["MK", "Crude oil falls about 3% on higher Middle East shipments, Libya pipeline restart"],
  ["MK", "Gold rebounds 3.2% despite stronger dollar and higher yields"],
  ["MK", "US Treasury sells $69bn of two-year notes at 4.700%"],
  ["MK", "Sensex falls 1,484 points to 82,435; Nifty drops 451"],
  ["MK", "India's oil and gas import bill rises 60% to $16bn in October"],
  ["MK", "Bitcoin ETFs record $1.12bn net outflows"],
  ["SP", "South Africa bowl Bangladesh out for 91 on rain-hit opening day at Centurion"],
  ["SP", "Brentford beat Everton 4-0"],
  ["SP", "Champions League matchday 5 tonight: Arsenal v Dortmund, Man City v Napoli, Real Madrid v PSV"],
  ["SP", "Afghanistan A beat Hong Kong by 7 wickets, Asia Cup Rising Stars"],
  ["SP", "Advani and Ramachandran win opening group matches at World Snooker Championship"],
];

// ---------------------------------------------------------------- pictograms
function drawChipPictogram(x: number, y: number, w: number, h: number): void {
  // Chip body with pins + rising arrow chart.
  const bodyX = x + 8;
  const bodyY = y + h - 78;
  const bodyW = 92;
  const bodyH = 62;
  for (let i = 0; i < 5; i++) {
    fillRect(bodyX + 8 + i * 18, bodyY - 10, 6, 10, NAVY);
    fillRect(bodyX + 8 + i * 18, bodyY + bodyH, 6, 10, NAVY);
  }
  fillRect(bodyX, bodyY, bodyW, bodyH, NAVY);
  fillRect(bodyX + 8, bodyY + 8, bodyW - 16, bodyH - 16, GOLD);
  drawText(bodyX + 22, bodyY + 24, "NVDA", 2, NAVY);
  // Rising arrow chart above the chip.
  const pts: [number, number][] = [
    [x + 130, y + h - 30],
    [x + 165, y + h - 55],
    [x + 195, y + h - 45],
    [x + 230, y + h - 80],
    [x + 265, y + h - 100],
  ];
  for (let i = 0; i < pts.length - 1; i++)
    drawLine(pts[i][0], pts[i][1], pts[i + 1][0], pts[i + 1][1], TEAL, 4);
  const [ax, ay] = pts[pts.length - 1];
  drawLine(ax, ay, ax - 16, ay + 2, TEAL, 4);
  drawLine(ax, ay, ax - 4, ay + 16, TEAL, 4);
  drawText(x + 130, y + 6, "+31%", 3, TEAL);
}
function drawMiniIcon(x: number, y: number, kind: number): void {
  // Small 44x28 pictogram per featured card.
  if (kind === 0) {
    // EU: ring of stars.
    circleOutline(x + 22, y + 14, 12, NAVY);
    for (let a = 0; a < 360; a += 45) {
      const rad = (a * Math.PI) / 180;
      fillCircle(Math.round(x + 22 + 12 * Math.cos(rad)), Math.round(y + 14 + 12 * Math.sin(rad)), 2, GOLD);
    }
  } else if (kind === 1) {
    // ME: flame over waves.
    drawLine(x + 22, y + 2, x + 14, y + 18, RED, 3);
    drawLine(x + 22, y + 2, x + 30, y + 18, RED, 3);
    fillRect(x + 18, y + 16, 8, 8, RED);
    hline(x + 2, x + 42, y + 26, NAVY, 2);
  } else if (kind === 2) {
    // AS: factory with smoke.
    fillRect(x + 4, y + 12, 26, 14, NAVY);
    fillRect(x + 30, y + 6, 6, 20, NAVY);
    fillCircle(x + 33, y + 2, 3, GREY);
    fillRect(x + 8, y + 18, 4, 4, GOLD);
    fillRect(x + 18, y + 18, 4, 4, GOLD);
  } else if (kind === 3) {
    // AM: capitol dome.
    fillRect(x + 6, y + 18, 32, 8, NAVY);
    drawLine(x + 10, y + 18, x + 22, y + 6, NAVY, 3);
    drawLine(x + 34, y + 18, x + 22, y + 6, NAVY, 3);
    fillRect(x + 20, y + 2, 4, 6, NAVY);
  } else if (kind === 4) {
    // AF: flag on a pole.
    fillRect(x + 8, y + 2, 3, 24, NAVY);
    fillRect(x + 11, y + 2, 26, 8, TEAL);
    fillRect(x + 11, y + 10, 26, 8, GOLD);
  } else {
    // SP: ball.
    circleOutline(x + 22, y + 14, 12, NAVY);
    drawLine(x + 12, y + 10, x + 32, y + 18, NAVY, 2);
    drawLine(x + 32, y + 10, x + 12, y + 18, NAVY, 2);
  }
}

// ---------------------------------------------------------------- layout
fill(PAPER);

// Masthead: navy band.
fillRect(0, 0, W, 108, NAVY);
fillRect(0, 104, W, 4, GOLD);
drawTextCentered(W / 2, 20, "THE WORLD IN ONE DAY", 5, WHITE);
drawTextCentered(W / 2, 68, "TUESDAY 24 NOVEMBER 2026", 2, GOLD);
drawText(24, 68, "50 STORIES", 1, GOLD);
drawText(W - 24 - textWidth("ONE DAY - ONE IMAGE", 1), 68, "ONE DAY - ONE IMAGE", 1, GOLD);

// Lead story block.
fillRect(16, 116, 992, 180, CARD);
rectBorder(16, 116, 992, 180, BORDER, 2);
drawText(28, 128, "MK MARKETS - LEAD STORY", 1, RED);
drawWrapped(28, 146, LEAD_HEADLINE, 3, 34, 4, INK);
drawWrapped(28, 226, LEAD_DECK[0], 2, 52, 2, INK);
drawText(28, 258, LEAD_DECK[1], 2, INK);
drawText(28, 280, "SOURCE: THE HINDU BUSINESSLINE", 1, GREY);
drawChipPictogram(700, 128, 290, 160);

// Featured cards: 3 x 2 grid.
const cardW = 320;
const cardH = 116;
const cardXs = [16, 352, 688];
const cardYs = [304, 428];
FEATURED.forEach((f, i) => {
  const cx = cardXs[i % 3];
  const cy = cardYs[Math.floor(i / 3)];
  fillRect(cx, cy, cardW, cardH, CARD);
  rectBorder(cx, cy, cardW, cardH, BORDER, 1);
  drawText(cx + 12, cy + 10, f.tag, 1, RED);
  drawWrapped(cx + 12, cy + 26, f.headline, 2, 24, 3, INK);
  drawMiniIcon(cx + cardW - 60, cy + cardH - 36, f.icon);
});

// UTC timeline strip.
fillRect(16, 552, 992, 40, CARD);
rectBorder(16, 552, 992, 40, BORDER, 1);
drawText(28, 564, "REPORTED (UTC)", 2, NAVY);
const marks: [string, string, number][] = [
  ["00:56", "EU", 240],
  ["01:00", "ME", 350],
  ["06:30", "AS", 470],
  ["08:15", "AM", 580],
  ["09:40", "AF", 690],
  ["11:20", "SP", 800],
  ["14:30", "MK", 920],
];
hline(230, 990, 578, NAVY, 2);
for (const [t, tag, mx] of marks) {
  fillRect(mx - 1, 572, 3, 12, RED);
  drawText(mx - 12, 558, t, 1, INK);
  drawText(mx - 6, 585, tag, 1, GREY);
}

// List section: remaining 43 stories, 2 columns.
drawText(16, 604, "MORE FROM 24 NOVEMBER - 43 STORIES", 2, NAVY);
hline(16, 1008, 626, NAVY, 2);
const colX = [16, 524];
const colW = 484;
const rowH = 15;
const startY = 636;
LIST.forEach((item, i) => {
  const col = i < 22 ? 0 : 1;
  const row = i < 22 ? i : i - 22;
  const y = startY + row * rowH;
  const x = colX[col];
  const maxHead = Math.floor((colW - textWidth(item[0] + "  ", 1)) / 6);
  const head = truncate(item[1], maxHead);
  drawText(x, y, item[0], 1, RED);
  drawText(x + textWidth(item[0] + "  ", 1), y, head, 1, INK);
});

// Footer: navy band with the exact date-check line.
fillRect(0, 968, W, 56, NAVY);
fillRect(0, 968, W, 3, GOLD);
drawTextCentered(
  W / 2,
  990,
  "DATE CHECK: ALL 50 STORIES FIRST REPORTED TUESDAY 24 NOVEMBER 2026",
  2,
  GOLD
);

// ---------------------------------------------------------------- output
const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
fs.mkdirSync(outDir, { recursive: true });
const outPath = path.join(outDir, "entry.png");
const png = encodePNG(W, H, px);
fs.writeFileSync(outPath, png);
fs.chmodSync(outPath, 0o644);
console.log(`wrote ${outPath} (${png.length} bytes, ${W}x${H})`);
