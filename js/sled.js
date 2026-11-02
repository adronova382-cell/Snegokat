'use strict';
// ===== Рисование снегоката и наездника (локальные координаты, ось Y вверх, земля y=0) =====
const POSES = {
  sit:      { hip: [-16, 32], sh: [-6, 60], head: [-2, 72], el: [5, 50], hand: [14, 53], el2: [3, 49], hand2: [12, 52], kn: [6, 40], ft: [16, 28], kn2: [3, 38], ft2: [13, 27] },
  lean:     { hip: [-14, 32], sh: [2, 56], head: [8, 66], el: [8, 47], hand: [14, 53], el2: [6, 46], hand2: [12, 52], kn: [6, 40], ft: [16, 28], kn2: [3, 38], ft2: [13, 27] },
  back:     { hip: [-18, 32], sh: [-14, 60], head: [-12, 72], el: [0, 52], hand: [14, 53], el2: [-2, 51], hand2: [12, 52], kn: [6, 40], ft: [16, 28], kn2: [3, 38], ft2: [13, 27] },
  push:     { hip: [-16, 32], sh: [-4, 58], head: [0, 70], el: [5, 50], hand: [14, 53], el2: [3, 49], hand2: [12, 52], kn: [6, 40], ft: [16, 28], kn2: [-10, 18], ft2: [-18, 0] },
  superman: { hip: [-34, 52], sh: [-6, 57], head: [4, 62], el: [4, 52], hand: [14, 53], el2: [3, 51], hand2: [12, 52], kn: [-56, 55], ft: [-80, 58], kn2: [-56, 50], ft2: [-80, 52] },
  nohands:  { hip: [-16, 32], sh: [-8, 60], head: [-5, 72], el: [-1, 76], hand: [6, 92], el2: [-18, 74], hand2: [-24, 90], kn: [6, 40], ft: [16, 28], kn2: [3, 38], ft2: [13, 27] },
  kankan:   { hip: [-18, 32], sh: [-10, 60], head: [-7, 72], el: [5, 50], hand: [14, 53], el2: [3, 49], hand2: [12, 52], kn: [10, 54], ft: [32, 68], kn2: [3, 38], ft2: [13, 27] },
  split:    { hip: [-12, 42], sh: [-4, 68], head: [0, 80], el: [6, 58], hand: [14, 53], el2: [4, 57], hand2: [12, 52], kn: [10, 52], ft: [34, 62], kn2: [-34, 48], ft2: [-58, 58] },
  sprawl:   { hip: [0, 0], sh: [26, 0], head: [38, 2], el: [30, 14], hand: [40, 22], el2: [30, -14], hand2: [40, -22], kn: [-20, 8], ft: [-40, 14], kn2: [-20, -8], ft2: [-40, -14] },
};
const JOINTS = Object.keys(POSES.sit);

const Sled = {
  makeJoints(pose = 'sit') {
    const j = {};
    for (const k of JOINTS) j[k] = POSES[pose][k].slice();
    return j;
  },
  blendJoints(j, pose, k) {
    const t = POSES[pose] || POSES.sit;
    for (const n of JOINTS) {
      j[n][0] = lerp(j[n][0], t[n][0], k);
      j[n][1] = lerp(j[n][1], t[n][1], k);
    }
  },

  // o: {t, joints, mods, paint, glow, lights:{head,left,right,brake}, wheelRot, throttle, noRider, alarmBlink}
  draw(ctx, o) {
    const m = o.mods || {};
    const L = o.lights || {};
    const t = o.t || 0;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    // --- подсветка днища
    if (m.underglow && L.glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(-10, 4, 2, -10, 4, 70);
      const pulse = 0.75 + 0.25 * Math.sin(t * 3);
      g.addColorStop(0, hexA(o.glow, 0.9 * pulse));
      g.addColorStop(0.5, hexA(o.glow, 0.35 * pulse));
      g.addColorStop(1, hexA(o.glow, 0));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(-10, 4, 70, 18, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
    }

    // --- мотор и колесо (сзади)
    if (m.motor) {
      // кронштейны
      ctx.strokeStyle = '#455a64'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-36, 22); ctx.lineTo(-50, 10); ctx.moveTo(-38, 30); ctx.lineTo(-56, 26); ctx.stroke();
      // колесо
      ctx.save();
      ctx.translate(-50, 10);
      ctx.fillStyle = '#212121';
      ctx.beginPath(); ctx.arc(0, 0, 12, 0, TAU); ctx.fill();
      ctx.rotate(-(o.wheelRot || 0));
      ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 1.5;
      for (let i = 0; i < 8; i++) {
        const a = i * TAU / 8;
        ctx.beginPath(); ctx.moveTo(Math.cos(a) * 11, Math.sin(a) * 11); ctx.lineTo(Math.cos(a) * 14, Math.sin(a) * 14); ctx.stroke();
      }
      ctx.fillStyle = '#757575';
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, TAU); ctx.fill();
      ctx.strokeStyle = '#424242'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(-4, 0); ctx.lineTo(4, 0); ctx.stroke();
      ctx.restore();
      // цепь
      ctx.strokeStyle = '#616161'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(-52, 34); ctx.lineTo(-56, 12); ctx.moveTo(-46, 34); ctx.lineTo(-44, 12); ctx.stroke();
      // корпус пилы
      const shake = o.throttle ? Math.sin(t * 90) * 0.6 : (o.engineOn ? Math.sin(t * 60) * 0.3 : 0);
      ctx.save(); ctx.translate(0, shake);
      ctx.fillStyle = '#ff6d00';
      roundRect(ctx, -66, 24, 30, 20, 4); ctx.fill();
      ctx.fillStyle = '#263238';
      for (let i = 0; i < 4; i++) { ctx.fillRect(-60 + i * 5, 44, 3, 6); }
      ctx.fillStyle = '#37474f'; ctx.fillRect(-64, 26, 8, 8);
      ctx.strokeStyle = '#111'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-68, 38); ctx.lineTo(-72, 40); ctx.stroke(); // стартер
      ctx.strokeStyle = '#9e9e9e'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-66, 28); ctx.lineTo(-76, 26); ctx.stroke(); // глушитель
      ctx.restore();
    }

    // --- задний полоз и передняя лыжа
    ctx.strokeStyle = '#263238';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(-46, 6); ctx.quadraticCurveTo(-44, 2, -38, 2); ctx.lineTo(-2, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4, 2); ctx.lineTo(38, 2); ctx.quadraticCurveTo(48, 2, 50, 11); ctx.stroke();

    // --- задняя нога наездника (за рамой)
    const J = o.joints;
    if (J && !o.noRider) this.drawLimb(ctx, J.hip, J.kn2, J.ft2, '#1a237e', 7);

    // --- рама
    ctx.strokeStyle = o.paint || '#e53935';
    ctx.lineWidth = 4.5;
    ctx.beginPath();
    ctx.moveTo(-34, 3); ctx.lineTo(-30, 22);
    ctx.moveTo(-8, 3); ctx.lineTo(-10, 22);
    ctx.moveTo(-38, 22); ctx.lineTo(0, 22); ctx.lineTo(18, 30);
    ctx.moveTo(22, 3); ctx.lineTo(14, 52);
    ctx.stroke();
    ctx.strokeStyle = '#37474f'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(16, 3); ctx.lineTo(28, 3); ctx.stroke();
    // руль
    ctx.strokeStyle = '#263238'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(8, 52); ctx.lineTo(20, 55); ctx.stroke();
    ctx.strokeStyle = '#111'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(15, 54); ctx.lineTo(20, 55); ctx.stroke();
    // сиденье
    ctx.fillStyle = '#3e2723';
    roundRect(ctx, -38, 22, 34, 7, 3); ctx.fill();

    // --- электроника
    if (m.speaker) {
      ctx.fillStyle = '#37474f'; roundRect(ctx, -30, 8, 15, 12, 2); ctx.fill();
      ctx.fillStyle = '#90a4ae'; ctx.beginPath(); ctx.arc(-22.5, 14, 4 + (o.music ? Math.abs(Math.sin(t * 16)) : 0), 0, TAU); ctx.fill();
    }
    if (m.horn) { ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(9, 28, 3.5, 0, TAU); ctx.fill(); }
    if (m.alarm) {
      const on = o.alarmBlink && Math.sin(t * 4) > 0.6;
      this.lamp(ctx, -13, 25, 2, on ? '#ff1744' : '#5d0000', on);
    }
    if (m.speedo) {
      ctx.fillStyle = '#111'; roundRect(ctx, 7, 56, 10, 6, 1.5); ctx.fill();
      ctx.fillStyle = '#00e676'; ctx.fillRect(8.5, 58, 7, 2);
    }
    if (m.stoplight) {
      ctx.fillStyle = '#333'; ctx.fillRect(-44, 17, 5, 7);
      this.lamp(ctx, -41.5, 20.5, 2.5, L.brake ? '#ff1744' : (L.head ? '#b71c1c' : '#5d0000'), L.brake);
    }
    if (m.turn) {
      const blink = Math.sin(t * 14) > 0;
      this.lamp(ctx, 21, 34, 2.4, L.left && blink ? '#ffab00' : '#6d4c00', L.left && blink);
      this.lamp(ctx, -40, 27, 2.4, L.right && blink ? '#ffab00' : '#6d4c00', L.right && blink);
    }
    if (m.headlight) {
      ctx.fillStyle = '#424242'; roundRect(ctx, 15, 40, 9, 8, 2); ctx.fill();
      this.lamp(ctx, 24.5, 44, 3, L.head ? '#fffde7' : '#9e9e9e', L.head, 16);
    }

    // --- наездник
    if (J && !o.noRider) this.drawRider(ctx, J, false);
    ctx.restore();
  },

  lamp(ctx, x, y, r, color, glow, glowR = 9) {
    if (glow) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(x, y, 0, x, y, glowR);
      g.addColorStop(0, hexA(color, 0.9)); g.addColorStop(1, hexA(color, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, glowR, 0, TAU); ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
  },

  drawLimb(ctx, a, b, c, color, w) {
    ctx.strokeStyle = color; ctx.lineWidth = w;
    ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.lineTo(c[0], c[1]); ctx.stroke();
    // ботинок
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(c[0], c[1], w * 0.55, 0, TAU); ctx.fill();
  },

  drawRider(ctx, J, withBackLeg) {
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (withBackLeg) this.drawLimb(ctx, J.hip, J.kn2, J.ft2, '#1a237e', 7);
    // задняя рука
    ctx.strokeStyle = '#0d47a1'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(J.sh[0], J.sh[1]); ctx.lineTo(J.el2[0], J.el2[1]); ctx.lineTo(J.hand2[0], J.hand2[1]); ctx.stroke();
    // туловище (куртка)
    ctx.strokeStyle = '#1976d2'; ctx.lineWidth = 13;
    ctx.beginPath(); ctx.moveTo(J.hip[0], J.hip[1]); ctx.lineTo(J.sh[0], J.sh[1]); ctx.stroke();
    // передняя нога
    this.drawLimb(ctx, J.hip, J.kn, J.ft, '#283593', 7.5);
    // шарф
    ctx.strokeStyle = '#fdd835'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(J.sh[0] - 2, J.sh[1] + 2); ctx.lineTo(J.sh[0] + 3, J.sh[1] + 3); ctx.stroke();
    // голова
    const hx = J.head[0], hy = J.head[1];
    ctx.fillStyle = '#ffcc99';
    ctx.beginPath(); ctx.arc(hx, hy, 7.5, 0, TAU); ctx.fill();
    // шапка с помпоном
    const ang = Math.atan2(hy - J.sh[1], hx - J.sh[0]) - Math.PI / 2;
    ctx.save(); ctx.translate(hx, hy); ctx.rotate(ang);
    ctx.fillStyle = '#e53935';
    ctx.beginPath(); ctx.arc(0, 1, 8, 0, Math.PI); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-8.5, 0, 17, 3);
    ctx.beginPath(); ctx.arc(-2, 10, 3.5, 0, TAU); ctx.fill();
    // глаз
    ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(4, -2, 1.2, 0, TAU); ctx.fill();
    ctx.restore();
    // передняя рука (варежка)
    ctx.strokeStyle = '#1565c0'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(J.sh[0], J.sh[1]); ctx.lineTo(J.el[0], J.el[1]); ctx.lineTo(J.hand[0], J.hand[1]); ctx.stroke();
    ctx.fillStyle = '#e53935'; ctx.beginPath(); ctx.arc(J.hand[0], J.hand[1], 3.5, 0, TAU); ctx.fill();
  },
};
