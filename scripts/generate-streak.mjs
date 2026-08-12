import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input =
  process.env.CONTRIB_JSON ||
  path.join(process.env.TEMP || "/tmp", "gh-contrib.json");

function readJson(filePath) {
  const buf = fs.readFileSync(filePath);
  let text;
  if (buf.length >= 2 && buf[0] === 0xff && buf[1] === 0xfe) {
    text = buf.toString("utf16le");
  } else if (buf.length >= 2 && buf[0] === 0xfe && buf[1] === 0xff) {
    text = buf.swap16().toString("utf16le");
  } else {
    text = buf.toString("utf8");
  }
  return JSON.parse(text.replace(/^\uFEFF/, ""));
}

const data = readJson(input);
const calendar = data.data.user.contributionsCollection.contributionCalendar;
const days = calendar.weeks
  .flatMap((w) => w.contributionDays)
  .map((d) => ({ date: d.date, count: d.contributionCount }));
const total = calendar.totalContributions;

function fmt(d) {
  return new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function esc(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

let longest = 0;
let longestStart = null;
let longestEnd = null;
let run = 0;
let runStart = null;
for (const d of days) {
  if (d.count > 0) {
    if (run === 0) runStart = d.date;
    run += 1;
    if (run > longest) {
      longest = run;
      longestStart = runStart;
      longestEnd = d.date;
    }
  } else {
    run = 0;
    runStart = null;
  }
}

let current = 0;
let currentStart = null;
let currentEnd = null;
const rev = [...days].reverse();
let i = 0;
if (rev[0] && rev[0].count === 0) i = 1;
for (; i < rev.length; i += 1) {
  if (rev[i].count > 0) {
    current += 1;
    currentEnd = currentEnd || rev[i].date;
    currentStart = rev[i].date;
  } else break;
}

const first = days.find((d) => d.count > 0)?.date || days[0].date;

const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="495" height="195" viewBox="0 0 495 195" role="img" aria-label="Contribution streak">
  <defs>
    <style>
      .label { fill: #94A3B8; font: 600 14px 'Segoe UI', Ubuntu, Sans-Serif; }
      .value { fill: #F8FAFC; font: 700 28px 'Segoe UI', Ubuntu, Sans-Serif; }
      .date { fill: #64748B; font: 400 12px 'Segoe UI', Ubuntu, Sans-Serif; }
      .title { fill: #3B82F6; font: 700 14px 'Segoe UI', Ubuntu, Sans-Serif; }
    </style>
  </defs>
  <rect width="495" height="195" rx="8" fill="#0D1117" stroke="#1F2937"/>
  <g transform="translate(24,28)">
    <text class="label" x="56" y="0" text-anchor="middle">Total Contributions</text>
    <text class="value" x="56" y="40" text-anchor="middle">${total}</text>
    <text class="date" x="56" y="62" text-anchor="middle">${esc(fmt(first))} - Present</text>
  </g>
  <g transform="translate(190,20)">
    <circle cx="56" cy="40" r="38" fill="none" stroke="#3B82F6" stroke-width="4"/>
    <text class="title" x="56" y="-2" text-anchor="middle">Current Streak</text>
    <text class="value" x="56" y="48" text-anchor="middle">${current}</text>
    <text class="date" x="56" y="95" text-anchor="middle">${
      current
        ? `${esc(fmt(currentStart))} - ${esc(fmt(currentEnd))}`
        : "No current streak"
    }</text>
  </g>
  <g transform="translate(356,28)">
    <text class="label" x="56" y="0" text-anchor="middle">Longest Streak</text>
    <text class="value" x="56" y="40" text-anchor="middle">${longest}</text>
    <text class="date" x="56" y="62" text-anchor="middle">${
      longest
        ? `${esc(fmt(longestStart))} - ${esc(fmt(longestEnd))}`
        : "—"
    }</text>
  </g>
</svg>
`;

const out = path.join(root, "assets", "streak.svg");
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, svg);
console.log(
  JSON.stringify(
    { total, current, currentStart, currentEnd, longest, longestStart, longestEnd, out },
    null,
    2,
  ),
);
