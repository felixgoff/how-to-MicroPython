<script lang="ts">
	import ChevronLeftIcon from "@lucide/svelte/icons/chevron-left";
	import ChevronRightIcon from "@lucide/svelte/icons/chevron-right";
	import PlayIcon from "@lucide/svelte/icons/play";
	import PauseIcon from "@lucide/svelte/icons/pause";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { cn } from "$lib/utils.js";
	import {
		BAND_COLORS,
		COLUMNS,
		MARGIN_X,
		MODULE_PIN_Y,
		PICO_FIRST_COL,
		PITCH,
		ROW_Y,
		WIRE_COLORS,
		holeX,
		holeY,
		isModulePin,
		picoPinName,
		point,
		stripOf,
		wirePath,
	} from "$lib/wiring/geometry.js";
	import type { BoardPart, Diagram, Endpoint, Hole, Module, Row } from "$lib/wiring/types.js";

	let { diagram }: { diagram: Diagram } = $props();

	/** Hur länge varje steg visas när animationen spelas upp */
	const STEP_MS = 4800;

	let step = $state(0);
	let playing = $state(false);
	let container = $state<HTMLDivElement>();

	const lastStep = $derived(diagram.steps.length - 1);
	const current = $derived(diagram.steps[step]);

	/** Allt som ska synas: det som tillkommit i det här steget och alla tidigare */
	const visible = $derived(new Set(diagram.steps.slice(0, step + 1).flatMap((item) => item.show)));
	const fresh = $derived(new Set(current.show));

	// --- Uppspelning --------------------------------------------------------

	$effect(() => {
		if (!playing) return;
		if (step >= lastStep) {
			playing = false;
			return;
		}
		const timer = setTimeout(() => step++, STEP_MS);
		return () => clearTimeout(timer);
	});

	// Starta animationen automatiskt första gången schemat syns på skärmen
	$effect(() => {
		if (!container) return;
		const observer = new IntersectionObserver(
			(entries) => {
				if (entries.some((entry) => entry.isIntersecting)) {
					playing = true;
					observer.disconnect();
				}
			},
			{ threshold: 0.45 },
		);
		observer.observe(container);
		return () => observer.disconnect();
	});

	function go(to: number) {
		step = Math.max(0, Math.min(lastStep, to));
	}

	function togglePlay() {
		if (step >= lastStep) step = 0;
		playing = !playing;
	}

	function onKeydown(event: KeyboardEvent) {
		if (event.key === "ArrowRight") go(step + 1);
		else if (event.key === "ArrowLeft") go(step - 1);
		else return;
		event.preventDefault();
		playing = false;
	}

	// --- Geometri -------------------------------------------------------------

	const hasModules = $derived(diagram.modules.length > 0);
	const top = $derived((hasModules ? -11 : -2) * PITCH);
	const bottom = 18.8 * PITCH;
	const width = (COLUMNS + MARGIN_X * 2) * PITCH;
	const viewBox = $derived(`0 ${top} ${width} ${bottom - top}`);

	const railRows: Row[] = ["top+", "top-", "bot-", "bot+"];
	const halfRows: Row[] = ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"];
	const columns = Array.from({ length: COLUMNS }, (_, i) => i);

	const at = (endpoint: Endpoint) => point(endpoint, diagram.modules);

	/** Picons kretskort sträcker sig lite utanför stiftraderna */
	const pico = {
		left: holeX(PICO_FIRST_COL) - PITCH * 0.95,
		right: holeX(PICO_FIRST_COL + 19) + PITCH * 0.95,
		y1: (ROW_Y.c - 0.8) * PITCH,
		y2: (ROW_Y.h + 0.8) * PITCH,
	};

	/** Pico-stift som sladdarna går till, så att de kan märkas ut på kortet */
	const usedPicoPins = $derived.by(() => {
		const pins = new Set<number>();
		for (const wire of diagram.wires) {
			for (const end of [wire.from, wire.to]) {
				if (isModulePin(end)) continue;
				const col = end.col - PICO_FIRST_COL;
				if (col < 0 || col > 19) continue;
				if (end.row === "a" || end.row === "b") pins.add(40 - col);
				if (end.row === "i" || end.row === "j") pins.add(col + 1);
			}
		}
		return [...pins];
	});

	function stripRect(hole: Hole) {
		const strip = stripOf(hole);
		const pad = PITCH * 0.45;
		if ("rail" in strip) {
			const y = holeY(strip.rail);
			return { x: holeX(0) - pad, y: y - pad, w: holeX(COLUMNS - 1) - holeX(0) + pad * 2, h: pad * 2 };
		}
		const y1 = holeY(strip.rows[0]);
		const y2 = holeY(strip.rows[strip.rows.length - 1]);
		return { x: holeX(strip.col) - pad, y: y1 - pad, w: pad * 2, h: y2 - y1 + pad * 2 };
	}

	function calloutBox(endpoint: Endpoint, text: string) {
		const p = at(endpoint);
		const w = text.length * 6.4 + 16;
		const h = 20;
		const above = p.y < ROW_Y.f * PITCH;
		let x = p.x + 10;
		if (x + w > width - 6) x = p.x - w - 10;
		const y = above ? p.y - h - 16 : p.y + 16;
		return { x, y, w, h, px: p.x, py: p.y, lineY: above ? y + h : y };
	}

	function midpoint(a: Hole, b: Hole) {
		return { x: (holeX(a.col) + holeX(b.col)) / 2, y: (holeY(a.row) + holeY(b.row)) / 2 };
	}

	function moduleBox(module: Module) {
		const first = holeX(module.col);
		const last = holeX(module.col + module.pins.length - 1);
		const center = (first + last) / 2;
		const sizes = { dht11: [3.6, 4.4], hcsr04: [9.5, 4.6], oled: [6.4, 5.6] } as const;
		const [w, h] = sizes[module.kind];
		const bottomY = (MODULE_PIN_Y - 0.9) * PITCH;
		return { x: center - (w * PITCH) / 2, y: bottomY - h * PITCH, w: w * PITCH, h: h * PITCH, center, bottomY };
	}

	const partClass = (id: string) => cn("part", fresh.has(id) && "is-new");
</script>

{#snippet hole(x: number, y: number)}
	<rect x={x - 2.6} y={y - 2.6} width="5.2" height="5.2" rx="1" class="fill-neutral-500/70" />
{/snippet}

{#snippet boardPart(part: BoardPart)}
	{#if part.kind === "led"}
		{@const a = { x: holeX(part.anode.col), y: holeY(part.anode.row) }}
		{@const c = { x: holeX(part.cathode.col), y: holeY(part.cathode.row) }}
		{@const m = midpoint(part.anode, part.cathode)}
		{@const r = PITCH * 0.72}
		{@const cy = m.y - PITCH * 1.75}
		<g class={partClass(part.id)}>
			<!-- Benen upp till lysdioden. Anoden (+) är längre, det syns som en knyck. -->
			<path
				d={`M ${a.x} ${a.y} V ${a.y - 6} l -3 -3 V ${cy + r * 0.6}`}
				stroke="#9a9ca3"
				stroke-width="2"
				fill="none"
			/>
			<path d={`M ${c.x} ${c.y} V ${cy + r * 0.6}`} stroke="#9a9ca3" stroke-width="2" fill="none" />
			<circle cx={m.x} cy={cy} r={r} fill={part.color} />
			<circle cx={m.x - 4} cy={cy - 4} r={r * 0.3} fill="white" opacity="0.6" />
			<!-- Den platta kanten markerar katoden (−) -->
			<rect x={m.x + r * 0.62} y={cy - r} width={r * 0.4} height={r * 2} fill="#f3f0e8" />
			<line x1={m.x + r * 0.62} y1={cy - r * 0.78} x2={m.x + r * 0.62} y2={cy + r * 0.78} stroke={part.color} stroke-width="2" />
			<text x={a.x - 7} y={a.y + 3.5} fill="#27272a" class="font-mono text-[10px] font-bold" text-anchor="end">+</text>
			<text x={c.x + 7} y={c.y + 3.5} fill="#27272a" class="font-mono text-[10px] font-bold">−</text>
		</g>
	{:else if part.kind === "resistor"}
		{@const a = { x: holeX(part.from.col), y: holeY(part.from.row) }}
		{@const b = { x: holeX(part.to.col), y: holeY(part.to.row) }}
		{@const angle = (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI}
		{@const length = Math.hypot(b.x - a.x, b.y - a.y)}
		{@const body = Math.min(length - 10, PITCH * 2.4)}
		<!-- Animationen ligger på den yttre gruppen och placeringen på den inre, annars skriver CSS-animationen över placeringen -->
		<g class={partClass(part.id)}>
		<g transform={`translate(${a.x} ${a.y}) rotate(${angle})`}>
			<line x1="0" y1="0" x2={length} y2="0" stroke="#9a9ca3" stroke-width="2" />
			<rect x={(length - body) / 2} y="-5" width={body} height="10" rx="4" fill="#dcc8a0" stroke="#b39a6b" />
			{#each part.bands as band, i (i)}
				<rect
					x={(length - body) / 2 + 5 + i * ((body - 10) / (part.bands.length - 1)) - 1.6}
					y="-5"
					width="3.2"
					height="10"
					fill={BAND_COLORS[band]}
				/>
			{/each}
		</g>
		<text
			x={(a.x + b.x) / 2 + (a.y === b.y ? 0 : 12)}
			y={(a.y + b.y) / 2 + (a.y === b.y ? -9 : 4)}
			text-anchor={a.y === b.y ? "middle" : "start"}
			fill="#27272a"
			class="font-mono text-[9px] font-semibold">{part.ohms}</text
		>
		</g>
	{:else if part.kind === "buzzer"}
		{@const m = midpoint(part.plus, part.minus)}
		<g class={partClass(part.id)}>
			<circle cx={m.x} cy={m.y} r={PITCH * 1.15} fill="#1c1c1e" />
			<circle cx={m.x} cy={m.y} r={PITCH * 0.8} fill="none" stroke="#3a3a3d" stroke-width="2" />
			<circle cx={m.x} cy={m.y} r="3" fill="#0c0c0d" />
			<text x={m.x - PITCH * 0.62} y={m.y - PITCH * 0.4} fill="white" class="font-mono text-[10px] font-bold">+</text>
		</g>
	{:else if part.kind === "ldr"}
		{@const a = { x: holeX(part.a.col), y: holeY(part.a.row) }}
		{@const b = { x: holeX(part.b.col), y: holeY(part.b.row) }}
		{@const m = midpoint(part.a, part.b)}
		<g class={partClass(part.id)}>
			<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class="stroke-neutral-400" stroke-width="2" />
			<circle cx={m.x} cy={m.y} r={PITCH * 0.72} fill="#e9a064" stroke="#b86b35" />
			<path
				d={`M ${m.x - 7} ${m.y - 6} h 11 v 3 h -11 v 3 h 11 v 3 h -11 v 3 h 11`}
				fill="none"
				stroke="#8a3f14"
				stroke-width="1.4"
				transform={`translate(${-2} ${-4})`}
			/>
		</g>
	{:else if part.kind === "to92"}
		{@const xs = part.legs.map((leg) => holeX(leg.col))}
		{@const y = holeY(part.legs[0].row)}
		{@const cx = xs[1]}
		<g class={partClass(part.id)}>
			{#each part.legs as leg, i (i)}
				<line x1={xs[i]} y1={y} x2={xs[i]} y2={y - PITCH * 0.7} class="stroke-neutral-400" stroke-width="2" />
				<text x={xs[i]} y={y + 13} text-anchor="middle" fill="#27272a" class="font-mono text-[7.5px] font-semibold"
					>{part.legNames[i]}</text
				>
			{/each}
			<path
				d={`M ${cx - PITCH * 1.25} ${y - PITCH * 0.7} A ${PITCH * 1.25} ${PITCH * 1.25} 0 0 1 ${cx + PITCH * 1.25} ${y - PITCH * 0.7} Z`}
				fill="#1c1c1e"
			/>
			<text x={cx} y={y - PITCH * 1.05} text-anchor="middle" fill="#d4d4d8" class="font-mono text-[6.5px]">{part.label}</text>
		</g>
	{/if}
{/snippet}

{#snippet moduleDrawing(module: Module)}
	{@const box = moduleBox(module)}
	<g class={partClass(module.id)}>
		<!-- Stiftlist med stift som pekar ned mot kopplingsdäcket -->
		{#each module.pins as pin, i (pin)}
			{@const x = holeX(module.col + i)}
			<line x1={x} y1={box.bottomY} x2={x} y2={MODULE_PIN_Y * PITCH} stroke="#d4a92a" stroke-width="2.4" />
		{/each}
		<rect
			x={holeX(module.col) - PITCH * 0.5}
			y={box.bottomY - 4}
			width={PITCH * module.pins.length}
			height="7"
			fill="#1f1f22"
		/>

		{#if module.kind === "dht11"}
			<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="#2b6fd6" />
			<rect x={box.x + 6} y={box.y + 6} width={box.w - 12} height={box.h * 0.62} rx="3" fill="#e9eef7" />
			{#each Array.from({ length: 5 }, (_, i) => i) as row (row)}
				{#each Array.from({ length: 3 }, (_, i) => i) as col (col)}
					<rect
						x={box.x + 12 + col * ((box.w - 24) / 2) - 3}
						y={box.y + 11 + row * ((box.h * 0.62 - 10) / 4.6)}
						width="6"
						height="3"
						rx="1.5"
						fill="#7d8aa3"
					/>
				{/each}
			{/each}
			<text x={box.center} y={box.y + box.h * 0.62 + 17} text-anchor="middle" fill="white" class="font-mono text-[8px] font-bold">DHT11</text>
		{:else if module.kind === "hcsr04"}
			<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="#1f5aa6" />
			{#each [-1, 1] as side (side)}
				{@const cx = box.center + side * box.w * 0.29}
				<circle cx={cx} cy={box.y + box.h * 0.45} r={PITCH * 1.55} fill="#c9ccd1" stroke="#9aa0a8" stroke-width="2" />
				<circle cx={cx} cy={box.y + box.h * 0.45} r={PITCH * 1.05} fill="#5b6068" />
				<circle cx={cx} cy={box.y + box.h * 0.45} r={PITCH * 0.55} fill="#3a3e45" />
			{/each}
			<text x={box.center} y={box.y + box.h * 0.5} text-anchor="middle" fill="white" class="font-mono text-[8px] font-bold">HC-SR04</text>
			<text x={box.center - box.w * 0.29} y={box.y + box.h - 6} text-anchor="middle" fill="#bcd3f5" class="font-mono text-[6.5px]">T</text>
			<text x={box.center + box.w * 0.29} y={box.y + box.h - 6} text-anchor="middle" fill="#bcd3f5" class="font-mono text-[6.5px]">R</text>
		{:else if module.kind === "oled"}
			<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" fill="#1b2a4a" />
			<rect x={box.x + 7} y={box.y + 7} width={box.w - 14} height={box.h - 26} rx="2" fill="#050608" />
			<text x={box.x + 13} y={box.y + 22} fill="#7dd3fc" class="font-mono text-[9px] font-bold">Hej!</text>
			<rect x={box.x + 13} y={box.y + 28} width={box.w * 0.55} height="2" fill="#7dd3fc" opacity="0.7" />
			<rect x={box.x + 13} y={box.y + 34} width={box.w * 0.35} height="2" fill="#7dd3fc" opacity="0.5" />
			<text x={box.center} y={box.y + box.h - 7} text-anchor="middle" fill="#c7d2fe" class="font-mono text-[6.5px]">SSD1306 128×64</text>
		{/if}

		{#each module.pins as pin, i (pin)}
			<text
				x={holeX(module.col + i)}
				y={box.bottomY - 8}
				text-anchor="middle"
				fill="white"
				class="font-mono text-[6.5px] font-bold">{pin}</text
			>
		{/each}
	</g>
{/snippet}

{#snippet picoBoard()}
	{@const { left, right, y1, y2 } = pico}
	<g>
		<rect x={left - 13} y={(y1 + y2) / 2 - 12} width="22" height="24" rx="2" fill="#c9cdd2" stroke="#9ea4ab" />
		<rect x={left} y={y1} width={right - left} height={y2 - y1} rx="5" fill="#1d6b45" />
		<rect x={left + PITCH * 3} y={(y1 + y2) / 2 - 20} width="40" height="40" rx="2" fill="#18181b" />
		<text x={left + PITCH * 3 + 20} y={(y1 + y2) / 2 + 3} text-anchor="middle" fill="#a1a1aa" class="font-mono text-[7px]">RP2040</text>
		<rect x={right - PITCH * 4.9} y={(y1 + y2) / 2 - 17} width="44" height="34" rx="3" fill="#b9bdc4" stroke="#8f959d" />
		<text x={right - PITCH * 4.9 + 22} y={(y1 + y2) / 2 + 3} text-anchor="middle" fill="#4b5058" class="font-mono text-[6px]">CYW43439</text>
		<!-- WiFi-antennen: ett slingrande kopparspår längst ut på kortet -->
		<path
			d={`M ${right - 20} ${(ROW_Y.c + 1.9) * PITCH} ${Array.from({ length: 4 }, () => "h 12 v 7 h -12 v 7").join(" ")}`}
			stroke="#d4a92a"
			stroke-width="1.6"
			fill="none"
		/>
		<text
			x={left + PITCH * 11.4}
			y={(y1 + y2) / 2 + 3}
			text-anchor="middle"
			fill="#cfe9da"
			class="font-mono text-[8px] font-semibold tracking-wider">Raspberry Pi Pico WH</text
		>
		{#each [ROW_Y.c, ROW_Y.h] as row (row)}
			<rect x={left + 4} y={row * PITCH - 5} width={right - left - 8} height="10" rx="1.5" fill="#111113" />
			{#each Array.from({ length: 20 }, (_, i) => i) as i (i)}
				<rect x={holeX(PICO_FIRST_COL + i) - 2.4} y={row * PITCH - 2.4} width="4.8" height="4.8" fill="#d9b13b" />
			{/each}
		{/each}
		{#each usedPicoPins as pin (pin)}
			{@const topSide = pin > 20}
			{@const x = holeX(PICO_FIRST_COL + (topSide ? 40 - pin : pin - 1))}
			{@const y = topSide ? (ROW_Y.c + 0.62) * PITCH : (ROW_Y.h - 0.62) * PITCH}
			<text
				{x}
				{y}
				transform={`rotate(-90 ${x} ${y})`}
				text-anchor={topSide ? "end" : "start"}
				dominant-baseline="middle"
				fill="white"
				class="font-mono text-[7.5px] font-bold">{picoPinName(pin).replace("(OUT)", "")}</text
			>
		{/each}
	</g>
{/snippet}

<Card.Root class="gap-0 overflow-hidden py-0">
	<!-- Schemat går att fokusera och bläddra i med piltangenterna -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions -->
	<div
		bind:this={container}
		tabindex="0"
		onkeydown={onKeydown}
		role="group"
		aria-roledescription="kopplingsschema"
		aria-label="Kopplingsschema steg för steg. Använd vänster- och högerpil för att byta steg."
		class="overflow-x-auto bg-muted/30 outline-none focus-visible:ring-3 focus-visible:ring-ring"
	>
		<svg {viewBox} class="block w-full min-w-[640px]" role="img" aria-label={diagram.description}>
			<!-- Kopplingsdäcket -->
			<rect
				x={PITCH * 0.4}
				y={-1.3 * PITCH}
				width={width - PITCH * 0.8}
				height={19.6 * PITCH}
				rx="10"
				fill="#f3f0e8"
				stroke="#d8d2c4"
			/>
			<rect
				x={PITCH * 0.6}
				y={(ROW_Y.e + 0.9) * PITCH}
				width={width - PITCH * 1.2}
				height={1.2 * PITCH}
				fill="#e3ddcf"
			/>

			<!-- Strömskenorna: röd linje för plus, blå för minus -->
			{#each [
				{ y: ROW_Y["top+"] - 0.65, color: "#d93636" },
				{ y: ROW_Y["top-"] + 0.65, color: "#2f6fd6" },
				{ y: ROW_Y["bot-"] - 0.65, color: "#2f6fd6" },
				{ y: ROW_Y["bot+"] + 0.65, color: "#d93636" },
			] as line (line.y)}
				<line x1={holeX(0) - 6} x2={holeX(COLUMNS - 1) + 6} y1={line.y * PITCH} y2={line.y * PITCH} stroke={line.color} stroke-width="1.6" />
			{/each}
			{#each railRows as row (row)}
				<text x={holeX(0) - 12} y={holeY(row) + 3.5} text-anchor="middle" class="font-mono text-[10px] font-bold" fill={row.endsWith("+") ? "#d93636" : "#2f6fd6"}>
					{row.endsWith("+") ? "+" : "−"}
				</text>
				{#if diagram.railLabels?.[row]}
					<text x={holeX(COLUMNS - 1) + 10} y={holeY(row) + 3.5} class="font-mono text-[8px] font-semibold" fill={row.endsWith("+") ? "#d93636" : "#2f6fd6"}>
						{diagram.railLabels[row]}
					</text>
				{/if}
				{#each columns as col (col)}
					{#if col % 6 !== 5}
						{@render hole(holeX(col), holeY(row))}
					{/if}
				{/each}
			{/each}

			<!-- Hålen, radbokstäver och kolumnnummer -->
			{#each halfRows as row (row)}
				<text x={holeX(0) - 12} y={holeY(row) + 3} text-anchor="middle" class="fill-neutral-500 font-mono text-[8px]">{row}</text>
				{#each columns as col (col)}
					{@render hole(holeX(col), holeY(row))}
				{/each}
			{/each}
			{#each columns as col (col)}
				{#if (col + 1) % 5 === 0 || col === 0}
					<text x={holeX(col)} y={(ROW_Y.a - 1.05) * PITCH} text-anchor="middle" class="fill-neutral-500 font-mono text-[7px]">{col + 1}</text>
				{/if}
			{/each}

			<!-- Pico WH med USB åt vänster och antennen i andra änden -->
			{@render picoBoard()}

			<!-- Kolumner som hör ihop lyses upp i det aktuella steget -->
			{#each current.strips ?? [] as strip, i (`${step}-${i}`)}
				{@const r = stripRect(strip)}
				<rect x={r.x} y={r.y} width={r.w} height={r.h} rx="5" class="strip fill-primary/25 stroke-primary" stroke-width="1.5" />
			{/each}

			{#each diagram.parts as part (part.id)}
				{#if visible.has(part.id)}
					{@render boardPart(part)}
				{/if}
			{/each}

			{#each diagram.modules as module (module.id)}
				{#if visible.has(module.id)}
					{@render moduleDrawing(module)}
				{/if}
			{/each}

			{#each diagram.wires as wire (wire.id)}
				{#if visible.has(wire.id)}
					{@const a = at(wire.from)}
					{@const b = at(wire.to)}
					{@const d = wirePath(a, b, isModulePin(wire.from) || isModulePin(wire.to))}
					{@const isNew = fresh.has(wire.id)}
					<g class={cn("wire", isNew && "is-new")}>
						<path {d} pathLength="1" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="5.5" stroke-linecap="round" class="draw" />
						<path {d} pathLength="1" fill="none" stroke={WIRE_COLORS[wire.color]} stroke-width="3.6" stroke-linecap="round" class="draw" />
						{#each [a, b] as end, i (i)}
							<rect x={end.x - 3.2} y={end.y - 3.2} width="6.4" height="6.4" rx="1" fill="#27272a" class="plug" />
						{/each}
					</g>
				{/if}
			{/each}

			<!-- Punkter att titta på i det här steget -->
			{#each current.focus ?? [] as target, i (`${step}-${i}`)}
				{@const p = at(target)}
				<circle cx={p.x} cy={p.y} r="6" class="focus fill-none stroke-primary" stroke-width="2.5" />
				<circle cx={p.x} cy={p.y} r="4.5" class="fill-primary/30 stroke-primary" stroke-width="1.5" />
			{/each}

			{#if current.callout}
				{@const box = calloutBox(current.callout.at, current.callout.text)}
				{#key step}
					<g class="callout">
						<line x1={box.px} y1={box.py} x2={box.x + 10} y2={box.lineY} class="stroke-foreground" stroke-width="1.2" />
						<rect x={box.x} y={box.y} width={box.w} height={box.h} rx="4" class="fill-foreground" />
						<text x={box.x + 8} y={box.y + 13.5} class="fill-background font-mono text-[10px] font-semibold">{current.callout.text}</text>
					</g>
				{/key}
			{/if}
		</svg>
	</div>

	<p class="border-t px-5 pt-3 text-xs text-muted-foreground sm:hidden">Svep i sidled för att se hela kopplingen.</p>

	<div class="flex flex-col gap-4 border-t p-5 max-sm:border-t-0">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<Badge variant="outline">Steg {step + 1} av {diagram.steps.length}</Badge>
			<div class="flex items-center gap-1">
				<Button variant="ghost" size="icon-sm" onclick={() => ((playing = false), go(step - 1))} disabled={step === 0} aria-label="Föregående steg">
					<ChevronLeftIcon />
				</Button>
				<Button variant="outline" size="sm" onclick={togglePlay} aria-label={playing ? "Pausa animationen" : "Spela animationen"}>
					{#if playing}
						<PauseIcon />
						Pausa
					{:else if step >= lastStep}
						<RotateCcwIcon />
						Spela igen
					{:else}
						<PlayIcon />
						Spela
					{/if}
				</Button>
				<Button variant="ghost" size="icon-sm" onclick={() => ((playing = false), go(step + 1))} disabled={step === lastStep} aria-label="Nästa steg">
					<ChevronRightIcon />
				</Button>
			</div>
		</div>

		<!-- Förloppsmätare som också går att klicka på -->
		<div class="flex gap-1.5" role="group" aria-label="Välj steg">
			{#each diagram.steps as item, i (i)}
				<button
					type="button"
					onclick={() => ((playing = false), go(i))}
					aria-label={`Steg ${i + 1}: ${item.title}`}
					aria-current={i === step ? "step" : undefined}
					class="group h-6 flex-1 outline-none focus-visible:ring-3 focus-visible:ring-ring"
				>
					<span class="block h-1 w-full overflow-hidden bg-muted">
						<span
							class={cn(
								"block h-full bg-primary",
								i < step && "w-full",
								i > step && "w-0",
								i === step && (playing ? "progress w-full" : "w-full"),
							)}
							style:animation-duration={i === step && playing ? `${STEP_MS}ms` : undefined}
						></span>
					</span>
				</button>
			{/each}
		</div>

		<div aria-live="polite" class="flex flex-col gap-1">
			<h3 class="font-semibold">{current.title}</h3>
			<p class="text-muted-foreground">{current.text}</p>
		</div>
	</div>
</Card.Root>

<style>
	/* Sladdar ritas fram från ena änden till den andra */
	.wire.is-new .draw {
		stroke-dasharray: 1;
		stroke-dashoffset: 1;
		animation: draw 1100ms cubic-bezier(0.65, 0, 0.35, 1) forwards;
	}
	.wire.is-new .plug {
		animation: fade-in 250ms 1000ms both;
	}

	/* Komponenter "trycks ner" i kopplingsdäcket */
	.part.is-new {
		transform-box: fill-box;
		transform-origin: center;
		animation: drop 650ms cubic-bezier(0.2, 0.9, 0.25, 1.2) both;
	}

	.strip {
		animation: glow 1.6s ease-in-out infinite alternate;
	}

	.focus {
		transform-box: fill-box;
		transform-origin: center;
		animation: pulse 1.5s ease-out infinite;
	}

	.callout {
		animation: fade-in 400ms 300ms both;
	}

	.progress {
		transform-origin: left;
		animation-name: progress;
		animation-timing-function: linear;
		animation-fill-mode: both;
	}

	@keyframes draw {
		to {
			stroke-dashoffset: 0;
		}
	}
	@keyframes drop {
		from {
			opacity: 0;
			transform: translateY(-14px) scale(1.08);
		}
		to {
			opacity: 1;
			transform: none;
		}
	}
	@keyframes fade-in {
		from {
			opacity: 0;
		}
	}
	@keyframes glow {
		from {
			opacity: 0.45;
		}
		to {
			opacity: 1;
		}
	}
	@keyframes pulse {
		from {
			opacity: 0.95;
			transform: scale(1);
		}
		to {
			opacity: 0;
			transform: scale(2.6);
		}
	}
	@keyframes progress {
		from {
			transform: scaleX(0);
		}
		to {
			transform: scaleX(1);
		}
	}
</style>
