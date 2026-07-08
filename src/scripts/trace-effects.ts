import blehUrl from '../components/bleh.jpg';

type Pt = { x: number; y: number };

type SymbolName = 'circle' | 'zigzag' | 'star' | 'spiral' | 'wave';

function genCircle(): Pt[] {
	const p: Pt[] = [];
	for (let i = 0; i <= 64; i++) {
		const a = (i / 64) * Math.PI * 2;
		p.push({ x: Math.cos(a) * 100, y: Math.sin(a) * 100 });
	}
	return p;
}
function genSpiral(): Pt[] {
	const p: Pt[] = [];
	for (let i = 0; i <= 80; i++) {
		const t = i / 80;
		const a = t * 2 * Math.PI * 2;
		const r = 100 - 80 * t;
		p.push({ x: Math.cos(a) * r, y: Math.sin(a) * r });
	}
	return p;
}
function genStar(): Pt[] {
	const verts: Pt[] = [];
	for (let i = 0; i < 5; i++) {
		const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
		verts.push({ x: Math.cos(a) * 100, y: Math.sin(a) * 100 });
	}
	verts.push(verts[0]);
	const p: Pt[] = [];
	for (let s = 0; s < 5; s++) {
		const a = verts[s];
		const b = verts[s + 1];
		for (let i = 0; i < 16; i++) {
			const t = i / 16;
			p.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
		}
	}
	return p;
}
function genZigzag(): Pt[] {
	const p: Pt[] = [];
	const segs = 6;
	for (let s = 0; s < segs; s++) {
		const x0 = -120 + (240 / segs) * s;
		const x1 = -120 + (240 / segs) * (s + 1);
		const y0 = s % 2 === 0 ? -60 : 60;
		const y1 = s % 2 === 0 ? 60 : -60;
		for (let i = 0; i < 12; i++) {
			const t = i / 12;
			p.push({ x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t });
		}
	}
	return p;
}
function genWave(): Pt[] {
	const p: Pt[] = [];
	for (let i = 0; i <= 80; i++) {
		const t = i / 80;
		const x = -120 + t * 240;
		p.push({ x, y: Math.sin(t * Math.PI * 2 * 1.5) * 55 });
	}
	return p;
}

const GENERATORS: Record<SymbolName, () => Pt[]> = {
	circle: genCircle,
	zigzag: genZigzag,
	star: genStar,
	spiral: genSpiral,
	wave: genWave,
};

const N = 64;
const SQUARE = 250;
const HALF_DIAG = 0.5 * Math.hypot(SQUARE, SQUARE);
const ANGLE_RANGE = deg(60);
const ANGLE_PREC = deg(2);
const PHI = 0.5 * (-1 + Math.sqrt(5));

function deg(d: number) {
	return (d * Math.PI) / 180;
}
function centroid(pts: Pt[]): Pt {
	let x = 0,
		y = 0;
	for (const p of pts) {
		x += p.x;
		y += p.y;
	}
	return { x: x / pts.length, y: y / pts.length };
}
function pathLength(pts: Pt[]): number {
	let d = 0;
	for (let i = 1; i < pts.length; i++) d += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
	return d;
}
function resample(pts: Pt[], n: number): Pt[] {
	const I = pathLength(pts) / (n - 1);
	let D = 0;
	const out: Pt[] = [pts[0]];
	const src = pts.slice();
	for (let i = 1; i < src.length; i++) {
		const d = Math.hypot(src[i].x - src[i - 1].x, src[i].y - src[i - 1].y);
		if (D + d >= I) {
			const t = (I - D) / d;
			const q = { x: src[i - 1].x + t * (src[i].x - src[i - 1].x), y: src[i - 1].y + t * (src[i].y - src[i - 1].y) };
			out.push(q);
			src.splice(i, 0, q);
			D = 0;
		} else {
			D += d;
		}
	}
	while (out.length < n) out.push(src[src.length - 1]);
	return out.slice(0, n);
}
function rotateBy(pts: Pt[], a: number): Pt[] {
	const c = centroid(pts);
	const cos = Math.cos(a),
		sin = Math.sin(a);
	return pts.map((p) => ({
		x: (p.x - c.x) * cos - (p.y - c.y) * sin + c.x,
		y: (p.x - c.x) * sin + (p.y - c.y) * cos + c.y,
	}));
}
function scaleToSquare(pts: Pt[], size: number): Pt[] {
	let minX = Infinity,
		minY = Infinity,
		maxX = -Infinity,
		maxY = -Infinity;
	for (const p of pts) {
		minX = Math.min(minX, p.x);
		minY = Math.min(minY, p.y);
		maxX = Math.max(maxX, p.x);
		maxY = Math.max(maxY, p.y);
	}
	const w = maxX - minX || 1;
	const h = maxY - minY || 1;
	return pts.map((p) => ({ x: p.x * (size / w), y: p.y * (size / h) }));
}
function translateToOrigin(pts: Pt[]): Pt[] {
	const c = centroid(pts);
	return pts.map((p) => ({ x: p.x - c.x, y: p.y - c.y }));
}
function preprocess(pts: Pt[]): Pt[] {
	let p = resample(pts, N);
	const c = centroid(p);
	const angle = Math.atan2(c.y - p[0].y, c.x - p[0].x);
	p = rotateBy(p, -angle);
	p = scaleToSquare(p, SQUARE);
	p = translateToOrigin(p);
	return p;
}
function pathDistance(a: Pt[], b: Pt[]): number {
	let d = 0;
	for (let i = 0; i < a.length; i++) d += Math.hypot(a[i].x - b[i].x, a[i].y - b[i].y);
	return d / a.length;
}
function distanceAtAngle(pts: Pt[], tmpl: Pt[], a: number): number {
	return pathDistance(rotateBy(pts, a), tmpl);
}
function distanceAtBestAngle(pts: Pt[], tmpl: Pt[]): number {
	let lo = -ANGLE_RANGE,
		hi = ANGLE_RANGE;
	let x1 = PHI * lo + (1 - PHI) * hi;
	let f1 = distanceAtAngle(pts, tmpl, x1);
	let x2 = (1 - PHI) * lo + PHI * hi;
	let f2 = distanceAtAngle(pts, tmpl, x2);
	while (Math.abs(hi - lo) > ANGLE_PREC) {
		if (f1 < f2) {
			hi = x2;
			x2 = x1;
			f2 = f1;
			x1 = PHI * lo + (1 - PHI) * hi;
			f1 = distanceAtAngle(pts, tmpl, x1);
		} else {
			lo = x1;
			x1 = x2;
			f1 = f2;
			x2 = (1 - PHI) * lo + PHI * hi;
			f2 = distanceAtAngle(pts, tmpl, x2);
		}
	}
	return Math.min(f1, f2);
}

const TEMPLATES: { name: SymbolName; pts: Pt[] }[] = (Object.keys(GENERATORS) as SymbolName[]).map(
	(name) => ({ name, pts: preprocess(GENERATORS[name]()) })
);

function isSpiralGesture(raw: Pt[]): boolean {
	const c = centroid(raw);
	let totalTurn = 0;
	let prevAngle = Math.atan2(raw[0].y - c.y, raw[0].x - c.x);
	const radii: number[] = [Math.hypot(raw[0].x - c.x, raw[0].y - c.y)];
	for (let i = 1; i < raw.length; i++) {
		const angle = Math.atan2(raw[i].y - c.y, raw[i].x - c.x);
		let d = angle - prevAngle;
		while (d > Math.PI) d -= Math.PI * 2;
		while (d < -Math.PI) d += Math.PI * 2;
		totalTurn += d;
		prevAngle = angle;
		radii.push(Math.hypot(raw[i].x - c.x, raw[i].y - c.y));
	}
	if (Math.abs(totalTurn) < deg(300)) return false;
	const third = Math.max(1, Math.floor(radii.length / 3));
	const startAvg = radii.slice(0, third).reduce((a, b) => a + b, 0) / third;
	const endAvg = radii.slice(-third).reduce((a, b) => a + b, 0) / third;
	const hi = Math.max(startAvg, endAvg);
	const lo = Math.min(startAvg, endAvg);
	return hi / Math.max(lo, 1) > 1.6;
}

function recognize(raw: Pt[]): { name: SymbolName; score: number } | null {
	if (raw.length < 8) return null;
	if (pathLength(raw) < 80) return null;
	if (isSpiralGesture(raw)) return { name: 'spiral', score: 0.95 };
	const cand = preprocess(raw);
	const candRev = preprocess(raw.slice().reverse());
	let best = Infinity;
	let bestName: SymbolName = 'circle';
	for (const t of TEMPLATES) {
		const d = Math.min(distanceAtBestAngle(cand, t.pts), distanceAtBestAngle(candRev, t.pts));
		if (d < best) {
			best = d;
			bestName = t.name;
		}
	}
	const score = 1 - best / HALF_DIAG;
	return { name: bestName, score };
}

type Particle = {
	x: number;
	y: number;
	vx: number;
	vy: number;
	life: number;
	max: number;
	size: number;
	color: string;
	kind: 'spark' | 'mote' | 'vortex';
	angle?: number;
	angVel?: number;
	radius?: number;
	cx?: number;
	cy?: number;
	drift?: number;
	sway?: number;
};

type Ring = { x: number; y: number; r: number; speed: number; life: number; max: number; color: string; w: number };
type Bolt = { pts: Pt[]; life: number; max: number };
type Sprite = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; rot: number; rotVel: number };

const particles: Particle[] = [];
const rings: Ring[] = [];
const bolts: Bolt[] = [];
const sprites: Sprite[] = [];
let flash = 0;

const blehImg = new Image();
blehImg.src = blehUrl.src;

const rand = (a: number, b: number) => a + Math.random() * (b - a);

function drawPixel(ctx: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) {
	ctx.fillStyle = color;
	ctx.fillRect(Math.round(x - size / 2), Math.round(y - size / 2), Math.round(size), Math.round(size));
}
function drawPixelRing(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string, pxSize: number) {
	if (r <= 0) return;
	const steps = Math.max(10, Math.round((2 * Math.PI * r) / (pxSize * 2)));
	ctx.fillStyle = color;
	for (let i = 0; i < steps; i++) {
		const a = (i / steps) * Math.PI * 2;
		drawPixel(ctx, cx + Math.cos(a) * r, cy + Math.sin(a) * r, pxSize, color);
	}
}

function spawn(name: SymbolName, cx: number, cy: number) {
	if (name === 'circle') {
		const cols = ['#5f8fae', '#7fa8c2', '#3f6f8e'];
		for (let i = 0; i < 4; i++) {
			rings.push({ x: cx, y: cy, r: i * -22, speed: 3.4, life: 90, max: 90, color: cols[i % cols.length], w: 4 });
		}
	} else if (name === 'zigzag') {
		flash = 0.55;
		const n = 5;
		for (let b = 0; b < n; b++) {
			const dir = (b / n) * Math.PI * 2 + rand(-0.3, 0.3);
			const len = rand(160, 320);
			const steps = 8;
			const pts: Pt[] = [{ x: cx, y: cy }];
			for (let i = 1; i <= steps; i++) {
				const t = i / steps;
				const perp = dir + Math.PI / 2;
				const jitter = (Math.random() - 0.5) * 46 * (1 - t);
				pts.push({
					x: cx + Math.cos(dir) * len * t + Math.cos(perp) * jitter,
					y: cy + Math.sin(dir) * len * t + Math.sin(perp) * jitter,
				});
			}
			bolts.push({ pts, life: 22, max: 22 });
		}
	} else if (name === 'star') {
		const cols = ['#d9a441', '#e6bd6c', '#f0d9a0', '#b8842f'];
		for (let i = 0; i < 60; i++) {
			const a = rand(0, Math.PI * 2);
			const sp = rand(2, 9);
			particles.push({
				x: cx,
				y: cy,
				vx: Math.cos(a) * sp,
				vy: Math.sin(a) * sp,
				life: rand(40, 80),
				max: 80,
				size: rand(1.5, 3.5),
				color: cols[(Math.random() * cols.length) | 0],
				kind: 'spark',
			});
		}
	} else if (name === 'spiral') {
		const cols = ['#8a6a45', '#a5825c', '#6e4f30'];
		for (let i = 0; i < 70; i++) {
			const angle = rand(0, Math.PI * 2);
			const radius = rand(20, 150);
			particles.push({
				x: cx + Math.cos(angle) * radius,
				y: cy + Math.sin(angle) * radius,
				vx: 0,
				vy: 0,
				life: rand(60, 120),
				max: 120,
				size: rand(1.5, 3),
				color: cols[(Math.random() * cols.length) | 0],
				kind: 'vortex',
				angle,
				angVel: rand(0.06, 0.12) * (Math.random() < 0.5 ? 1 : -1),
				radius,
				cx,
				cy,
				drift: rand(0.985, 0.998),
			});
		}
	} else {
		const cols = ['#6f9260', '#8bab7a', '#547147'];
		for (let i = 0; i < 34; i++) {
			particles.push({
				x: cx + rand(-90, 90),
				y: cy + rand(-10, 40),
				vx: 0,
				vy: rand(-1.4, -2.8),
				life: rand(70, 130),
				max: 130,
				size: rand(2, 4.5),
				color: cols[(Math.random() * cols.length) | 0],
				kind: 'mote',
				sway: rand(0, Math.PI * 2),
			});
		}
	}

	sprites.push({
		x: cx,
		y: cy,
		vx: rand(-0.6, 0.6),
		vy: rand(-1.6, -0.8),
		life: 150,
		max: 150,
		size: rand(60, 90),
		rot: rand(-0.15, 0.15),
		rotVel: rand(-0.01, 0.01),
	});
}

export function initTraceEffects() {
	const canvas = document.getElementById('fx') as HTMLCanvasElement | null;
	const toast = document.getElementById('fx-toast');
	if (!canvas) return;
	const ctx = canvas.getContext('2d')!;
	ctx.imageSmoothingEnabled = false;
	let dpr = Math.min(window.devicePixelRatio || 1, 2);

	function resize() {
		dpr = Math.min(window.devicePixelRatio || 1, 2);
		canvas!.width = Math.floor(window.innerWidth * dpr);
		canvas!.height = Math.floor(window.innerHeight * dpr);
		canvas!.style.width = window.innerWidth + 'px';
		canvas!.style.height = window.innerHeight + 'px';
		ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	}
	resize();
	window.addEventListener('resize', resize);

	const strokes: { pts: { x: number; y: number; t: number }[]; color: string }[] = [];
	let current: Pt[] | null = null;
	let drawing = false;
	const TRAIL_MS = 2600;

	const showToast = (label: string, ok: boolean) => {
		if (!toast) return;
		toast.textContent = label;
		toast.dataset.ok = String(ok);
		toast.classList.remove('show');
		void toast.offsetWidth;
		toast.classList.add('show');
	};

	const LABEL: Record<SymbolName, string> = {
		circle: 'ripples',
		zigzag: 'lightning',
		star: 'sparks',
		spiral: 'vortex',
		wave: 'rising motes',
	};

	canvas.addEventListener('pointerdown', (e) => {
		if (e.pointerType === 'touch') return;
		drawing = true;
		current = [];
		strokes.push({ pts: [], color: `hsl(${Math.floor(rand(0, 360))}, 75%, 62%)` });
		addPoint(e);
		canvas.setPointerCapture(e.pointerId);
	});
	canvas.addEventListener('pointermove', (e) => {
		if (!drawing) return;
		addPoint(e);
	});
	const end = () => {
		if (!drawing) return;
		drawing = false;
		if (current && current.length > 4) {
			const res = recognize(current);
			if (res && res.score >= 0.65) {
				const c = centroid(current);
				spawn(res.name, c.x, c.y);
				showToast(LABEL[res.name], true);
			} else {
				showToast('no symbol', false);
			}
		}
		current = null;
	};
	window.addEventListener('pointerup', end);
	window.addEventListener('pointercancel', end);

	function addPoint(e: PointerEvent) {
		const x = e.clientX;
		const y = e.clientY;
		current!.push({ x, y });
		strokes[strokes.length - 1].pts.push({ x, y, t: performance.now() });
	}

	function frame() {
		const now = performance.now();
		ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

		if (flash > 0) {
			ctx.fillStyle = `rgba(200,150,90,${flash})`;
			ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
			flash = Math.max(0, flash - 0.04);
		}

		ctx.save();
		ctx.lineCap = 'square';
		ctx.lineJoin = 'miter';

		for (let i = rings.length - 1; i >= 0; i--) {
			const r = rings[i];
			r.r += r.speed;
			r.life--;
			if (r.life <= 0) {
				rings.splice(i, 1);
				continue;
			}
			if (r.r <= 0) continue;
			const a = r.life / r.max;
			ctx.globalAlpha = a * 0.9;
			drawPixelRing(ctx, r.x, r.y, r.r, r.color, r.w);
		}
		ctx.globalAlpha = 1;

		for (let i = bolts.length - 1; i >= 0; i--) {
			const b = bolts[i];
			b.life--;
			if (b.life <= 0) {
				bolts.splice(i, 1);
				continue;
			}
			const a = b.life / b.max;
			ctx.beginPath();
			ctx.strokeStyle = '#e0b070';
			ctx.globalAlpha = a;
			ctx.lineWidth = 3;
			ctx.moveTo(b.pts[0].x, b.pts[0].y);
			for (let j = 1; j < b.pts.length; j++) ctx.lineTo(b.pts[j].x, b.pts[j].y);
			ctx.stroke();
		}
		ctx.globalAlpha = 1;

		for (let i = particles.length - 1; i >= 0; i--) {
			const p = particles[i];
			p.life--;
			if (p.life <= 0) {
				particles.splice(i, 1);
				continue;
			}
			if (p.kind === 'spark') {
				p.x += p.vx;
				p.y += p.vy;
				p.vy += 0.12;
				p.vx *= 0.98;
			} else if (p.kind === 'mote') {
				p.sway! += 0.05;
				p.x += Math.sin(p.sway!) * 0.7;
				p.y += p.vy;
			} else {
				p.angle! += p.angVel!;
				p.radius! *= p.drift!;
				p.x = p.cx! + Math.cos(p.angle!) * p.radius!;
				p.y = p.cy! + Math.sin(p.angle!) * p.radius!;
			}
			const a = p.life / p.max;
			ctx.globalAlpha = a;
			drawPixel(ctx, p.x, p.y, p.size * 2, p.color);
		}
		ctx.globalAlpha = 1;

		for (let i = sprites.length - 1; i >= 0; i--) {
			const sp = sprites[i];
			sp.life--;
			if (sp.life <= 0) {
				sprites.splice(i, 1);
				continue;
			}
			sp.x += sp.vx;
			sp.y += sp.vy;
			sp.vy -= 0.01;
			sp.rot += sp.rotVel;
			if (blehImg.complete && blehImg.naturalWidth > 0) {
				const w = sp.size;
				const h = sp.size * (blehImg.naturalHeight / blehImg.naturalWidth);
				ctx.globalAlpha = sp.life / sp.max;
				ctx.save();
				ctx.translate(sp.x, sp.y);
				ctx.rotate(sp.rot);
				ctx.drawImage(blehImg, -w / 2, -h / 2, w, h);
				ctx.restore();
			}
		}
		ctx.globalAlpha = 1;

		for (let s = strokes.length - 1; s >= 0; s--) {
			const pts = strokes[s].pts;
			const color = strokes[s].color;
			while (pts.length && now - pts[0].t > TRAIL_MS) pts.shift();
			if (pts.length === 0) {
				if (s !== strokes.length - 1 || !drawing) strokes.splice(s, 1);
				continue;
			}
			for (let i = 1; i < pts.length; i++) {
				const age = now - pts[i].t;
				const a = Math.max(0, 1 - age / TRAIL_MS);
				ctx.beginPath();
				ctx.strokeStyle = color;
				ctx.globalAlpha = a;
				ctx.lineWidth = 3 * a + 1;
				ctx.moveTo(pts[i - 1].x, pts[i - 1].y);
				ctx.lineTo(pts[i].x, pts[i].y);
				ctx.stroke();
			}
		}
		ctx.restore();

		requestAnimationFrame(frame);
	}
	requestAnimationFrame(frame);

	const io = new IntersectionObserver(
		(entries) => {
			for (const en of entries) if (en.isIntersecting) en.target.classList.add('in');
		},
		{ threshold: 0.25 }
	);
	document.querySelectorAll('.reveal').forEach((el) => io.observe(el));
}
