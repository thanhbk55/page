import fs from "fs";
import path from "path";
import { createCanvas, loadImage, registerFont } from "canvas";
import confetti from "canvas-confetti";

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function wrapText(ctx, text, maxWidth) {
  // wrap theo pixel (đơn giản, ổn cho CI)
  const words = text.split(/\s+/);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (ctx.measureText(test).width <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

async function render({
  width,
  height,
  fps,
  durationSec,
  bgPath,
  outDir,
  summaryText,
  fontPath // optional
}) {
  ensureDir(outDir);

  if (fontPath && fs.existsSync(fontPath)) {
    registerFont(fontPath, { family: "NotoSans" });
  }

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext("2d");

  // confetti trực tiếp trên canvas này
  const myConfetti = confetti.create(canvas, { resize: false, useWorker: false });

  const bg = await loadImage(bgPath);

  const totalFrames = Math.max(1, Math.round(durationSec * fps));

  // pre-style text
  const fontSize = Math.round(Math.min(width, height) * (height > width ? 0.05 : 0.045)); // tiktok/youtube ổn
  const boxPad = Math.round(fontSize * 0.8);
  const maxTextWidth = Math.round(width * 0.78);

  for (let i = 0; i < totalFrames; i++) {
    // ===== Background (cover) =====
    // cover scale
    const scale = Math.max(width / bg.width, height / bg.height);
    const sw = bg.width * scale;
    const sh = bg.height * scale;
    const sx = (width - sw) / 2;
    const sy = (height - sh) / 2;
    ctx.drawImage(bg, sx, sy, sw, sh);

    // ===== Slight dark overlay for readability =====
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.fillRect(0, 0, width, height);

    // ===== Confetti schedule =====
    // burst đầu + nhịp mỗi 0.5s
    if (i === 0 || i % Math.round(fps * 0.5) === 0) {
      myConfetti({
        particleCount: i === 0 ? 160 : 60,
        spread: 110,
        startVelocity: 35,
        ticks: Math.round(fps * 0.9),
        origin: { x: 0.5, y: 0.65 }
      });
    }

    // ===== Text overlay (giống summary) =====
    if (summaryText) {
      ctx.font = `600 ${fontSize}px ${fontPath ? "NotoSans" : "sans-serif"}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";

      const lines = wrapText(ctx, summaryText, maxTextWidth).slice(0, height > width ? 7 : 5);

      // box size
      const lineH = Math.round(fontSize * 1.35);
      const boxW = Math.min(maxTextWidth + boxPad * 2, Math.round(width * 0.86));
      const boxH = lines.length * lineH + boxPad * 2;
      const bx = Math.round((width - boxW) / 2);
      const by = Math.round((height - boxH) / 2);

      // box
      ctx.fillStyle = "rgba(0,0,0,0.50)";
      roundRect(ctx, bx, by, boxW, boxH, Math.round(fontSize * 0.6));
      ctx.fill();

      // text
      ctx.fillStyle = "rgba(255,255,255,1)";
      const centerY = by + boxH / 2;
      const startY = centerY - ((lines.length - 1) * lineH) / 2;
      lines.forEach((ln, idx) => {
        ctx.fillText(ln, width / 2, startY + idx * lineH);
      });
    }

    const file = path.join(outDir, `${String(i).padStart(4, "0")}.png`);
    fs.writeFileSync(file, canvas.toBuffer("image/png"));
  }
}

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// ===== CLI =====
const args = Object.fromEntries(
  process.argv.slice(2).map(s => {
    const [k, ...rest] = s.replace(/^--/, "").split("=");
    return [k, rest.join("=")];
  })
);

const width = Number(args.w || 1080);
const height = Number(args.h || 1920);
const fps = Number(args.fps || 30);
const durationSec = Number(args.dur || 4);
const bgPath = args.bg || "work/background.jpg";
const outDir = args.out || "work/frames_tiktok";
const summaryText = (args.text || "").trim();
const fontPath = args.font || "/usr/share/fonts/truetype/noto/NotoSans-Regular.ttf";

await render({ width, height, fps, durationSec, bgPath, outDir, summaryText, fontPath });
console.log(`OK frames: ${outDir}`);
