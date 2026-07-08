type TypeInteraction = {
	type: 'type';
	prompt: string;
	hint: string;
	glyph: string;
	key: string;
	success: string;
};

type TraceInteraction = {
	type: 'trace';
	prompt: string;
	hint: string;
	shape: 'spiral' | 'beak' | 'release' | 'river';
	success: string;
};

type Scene = {
	id: string;
	order: number;
	chapter: string;
	theme: string;
	lines: string[];
	interaction?: TypeInteraction | TraceInteraction;
};

const VIEW = 300;

const prefersReducedMotion =
	typeof window !== 'undefined' &&
	window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function $<T extends HTMLElement>(id: string): T {
	const el = document.getElementById(id);
	if (!el) throw new Error(`story-engine: missing #${id}`);
	return el as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function shapePoints(shape: TraceInteraction['shape']): Array<[number, number]> {
	const pts: Array<[number, number]> = [];
	const N = 80;
	const c = VIEW / 2;

	if (shape === 'spiral') {
		const turns = 2.75;
		const maxR = 118;
		for (let i = 0; i <= N; i++) {
			const t = i / N;
			const a = t * turns * Math.PI * 2;
			const r = maxR * (1 - t) + 6;
			pts.push([c + r * Math.cos(a), c + r * Math.sin(a)]);
		}
	} else if (shape === 'beak') {
		for (let i = 0; i <= N; i++) {
			const t = i / N;
			pts.push([c + 34 * Math.sin(t * Math.PI), 38 + t * 224]);
		}
	} else if (shape === 'release') {
		const a: [number, number] = [64, 232];
		const b: [number, number] = [150, 156];
		const d: [number, number] = [236, 74];
		for (let i = 0; i <= N / 2; i++) {
			const t = i / (N / 2);
			pts.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
		}
		for (let i = 1; i <= N / 2; i++) {
			const t = i / (N / 2);
			pts.push([b[0] + (d[0] - b[0]) * t, b[1] + (d[1] - b[1]) * t]);
		}
	} else {
		for (let i = 0; i <= N; i++) {
			const t = i / N;
			pts.push([36 + t * 228, 70 + t * 150 + 26 * Math.sin(t * Math.PI * 3)]);
		}
	}
	return pts;
}

function toPolyline(pts: Array<[number, number]>): string {
	return pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
}

class StoryEngine {
	private scenes: Scene[];
	private i = 0;
	private root = $('story');
	private stage = $('stage');
	private chapterEl = $('chapter');
	private narration = $('narration');
	private advanceBtn = $<HTMLButtonElement>('advance');

	private skip = false;
	private busy = false;

	constructor(scenes: Scene[]) {
		this.scenes = [...scenes].sort((a, b) => a.order - b.order);

		$('begin').addEventListener('click', () => this.begin());
		$('replay').addEventListener('click', () => this.begin());
		this.advanceBtn.addEventListener('click', () => this.nudge());
		window.addEventListener('keydown', (e) => {
			if ((e.key === ' ' || e.key === 'Enter') && !this.root.dataset.gate) {
				e.preventDefault();
				this.nudge();
			}
		});
	}

	private setTheme(theme: string) {
		this.root.dataset.theme = theme;
	}

	private async begin() {
		$('start').hidden = true;
		$('end').hidden = true;
		this.stage.hidden = false;
		this.i = 0;
		await this.playScene();
	}

	private nudge() {
		if (this.busy) this.skip = true;
	}

	private async playScene() {
		const scene = this.scenes[this.i];
		this.setTheme(scene.theme);

		this.chapterEl.textContent = scene.chapter;
		this.chapterEl.classList.remove('show');
		void this.chapterEl.offsetWidth;
		this.chapterEl.classList.add('show');

		this.narration.innerHTML = '';

		this.advanceBtn.hidden = false;

		for (const line of scene.lines) {
			await this.typeLine(line);
			await this.pause(prefersReducedMotion ? 250 : 900);
		}

		if (scene.interaction) {
			this.advanceBtn.hidden = true;
			await this.runInteraction(scene.interaction);
		}

		await this.pause(prefersReducedMotion ? 250 : 700);
		this.next();
	}

	private next() {
		if (this.i < this.scenes.length - 1) {
			this.i++;
			this.stage.classList.add('fading');
			setTimeout(async () => {
				this.stage.classList.remove('fading');
				await this.playScene();
			}, prefersReducedMotion ? 0 : 500);
		} else {
			this.showEnd();
		}
	}

	private showEnd() {
		this.advanceBtn.hidden = true;
		this.stage.hidden = true;
		$('end').hidden = false;
	}

	private typeLine(text: string): Promise<void> {
		return new Promise((resolve) => {
			const p = document.createElement('p');
			p.className = 'line typing';
			this.narration.appendChild(p);
			this.narration.scrollTop = this.narration.scrollHeight;

			if (prefersReducedMotion) {
				p.textContent = text;
				p.classList.remove('typing');
				resolve();
				return;
			}

			this.busy = true;
			this.skip = false;
			let n = 0;
			const step = () => {
				if (this.skip) {
					p.textContent = text;
					this.finishLine(p);
					resolve();
					return;
				}
				n++;
				p.textContent = text.slice(0, n);
				this.narration.scrollTop = this.narration.scrollHeight;
				if (n >= text.length) {
					this.finishLine(p);
					resolve();
					return;
				}
				const ch = text[n - 1];
				const delay = /[,.;:—]/.test(ch) ? 170 : 26;
				setTimeout(step, delay);
			};
			setTimeout(step, 120);
		});
	}

	private finishLine(p: HTMLElement) {
		p.classList.remove('typing');
		this.busy = false;
		this.skip = false;
	}

	private pause(ms: number) {
		return sleep(ms);
	}

	private runInteraction(it: TypeInteraction | TraceInteraction): Promise<void> {
		return it.type === 'type' ? this.runType(it) : this.runTrace(it);
	}

	private runType(it: TypeInteraction): Promise<void> {
		return new Promise((resolve) => {
			this.root.dataset.gate = 'type';
			const gate = $('gate-type');
			const glyph = $('glyph');
			gate.hidden = false;
			glyph.textContent = it.glyph;
			$('type-prompt').textContent = it.prompt;
			$('type-hint').textContent = it.hint;
			gate.classList.add('show');

			const onKey = (e: KeyboardEvent) => {
				if (e.key.toLowerCase() === it.key.toLowerCase()) {
					e.preventDefault();
					window.removeEventListener('keydown', onKey);
					glyph.classList.add('hit');
					this.closeGate(gate, 'type');
					this.afterGate(it.success).then(resolve);
				} else if (e.key.length === 1) {
					glyph.classList.remove('miss');
					void glyph.offsetWidth;
					glyph.classList.add('miss');
				}
			};
			window.addEventListener('keydown', onKey);
		});
	}

	private runTrace(it: TraceInteraction): Promise<void> {
		return new Promise((resolve) => {
			this.root.dataset.gate = 'trace';
			const gate = $('gate-trace');
			const svg = $<HTMLElement>('trace-svg') as unknown as SVGSVGElement;
			const guide = svg.querySelector('.guide') as SVGPolylineElement;
			const progress = svg.querySelector('.progress') as SVGPolylineElement;
			const stroke = svg.querySelector('.stroke') as SVGPolylineElement;
			const startDot = svg.querySelector('.start-dot') as SVGCircleElement;

			gate.hidden = false;
			$('trace-prompt').textContent = it.prompt;
			$('trace-hint').textContent = it.hint;
			gate.classList.add('show');

			const pts = shapePoints(it.shape);
			guide.setAttribute('points', toPolyline(pts));
			progress.setAttribute('points', '');
			stroke.setAttribute('points', '');
			startDot.setAttribute('cx', String(pts[0][0]));
			startDot.setAttribute('cy', String(pts[0][1]));

			const radius = 46;
			let reached = 0;
			let drawing = false;
			const userPts: string[] = [];

			const toSvg = (e: PointerEvent): [number, number] => {
				const rect = svg.getBoundingClientRect();
				const x = ((e.clientX - rect.left) / rect.width) * VIEW;
				const y = ((e.clientY - rect.top) / rect.height) * VIEW;
				return [x, y];
			};

			const dist = (a: [number, number], b: [number, number]) =>
				Math.hypot(a[0] - b[0], a[1] - b[1]);

			const reset = () => {
				drawing = false;
				reached = 0;
				userPts.length = 0;
				stroke.setAttribute('points', '');
				progress.setAttribute('points', '');
				startDot.classList.remove('armed');
			};

			const cleanup = () => {
				svg.removeEventListener('pointerdown', onDown);
				svg.removeEventListener('pointermove', onMove);
				window.removeEventListener('pointerup', onUp);
			};

			const succeed = () => {
				cleanup();
				progress.setAttribute('points', toPolyline(pts));
				svg.classList.add('done');
				this.closeGate(gate, 'trace');
				setTimeout(() => svg.classList.remove('done'), 700);
				this.afterGate(it.success).then(resolve);
			};

			const onDown = (e: PointerEvent) => {
				const p = toSvg(e);
				if (dist(p, pts[0]) > radius * 1.4) return;
				drawing = true;
				reached = 1;
				userPts.length = 0;
				userPts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
				startDot.classList.add('armed');
				svg.setPointerCapture(e.pointerId);
			};

			const onMove = (e: PointerEvent) => {
				if (!drawing) return;
				const p = toSvg(e);
				userPts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
				stroke.setAttribute('points', userPts.join(' '));

				while (reached < pts.length && dist(p, pts[reached]) <= radius) {
					reached++;
				}
				progress.setAttribute('points', toPolyline(pts.slice(0, reached)));

				if (reached >= pts.length - 1) succeed();
			};

			const onUp = () => {
				if (drawing && reached < pts.length - 1) reset();
				drawing = false;
			};

			svg.addEventListener('pointerdown', onDown);
			svg.addEventListener('pointermove', onMove);
			window.addEventListener('pointerup', onUp);
		});
	}

	private closeGate(gate: HTMLElement, kind: string) {
		gate.classList.remove('show');
		delete this.root.dataset.gate;
		setTimeout(() => {
			gate.hidden = true;
			$('glyph').classList.remove('hit', 'miss');
			void kind;
		}, 400);
	}

	private async afterGate(success: string) {
		await this.pause(prefersReducedMotion ? 150 : 450);
		const p = document.createElement('p');
		p.className = 'line resolve';
		this.narration.appendChild(p);
		await this.typeLine2(p, success);
		await this.pause(prefersReducedMotion ? 200 : 800);
	}

	private typeLine2(p: HTMLElement, text: string): Promise<void> {
		return new Promise((resolve) => {
			if (prefersReducedMotion) {
				p.textContent = text;
				resolve();
				return;
			}
			let n = 0;
			const step = () => {
				n++;
				p.textContent = text.slice(0, n);
				this.narration.scrollTop = this.narration.scrollHeight;
				if (n >= text.length) return resolve();
				setTimeout(step, 24);
			};
			setTimeout(step, 80);
		});
	}
}

export function initStory(scenes: Scene[]) {
	new StoryEngine(scenes);
}
