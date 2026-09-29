<script lang="ts">
	import "@wokwi/elements/dist/esm/hc-sr04-element.js";
	import PlayIcon from "@lucide/svelte/icons/play";
	import SquareIcon from "@lucide/svelte/icons/square";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
	import FootprintsIcon from "@lucide/svelte/icons/footprints";
	import UndoIcon from "@lucide/svelte/icons/undo-2";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import CodeEditor from "$lib/components/code-editor.svelte";
	import SerialConsole from "$lib/components/serial-console.svelte";
	import VirtualBoard from "$lib/components/virtual-board.svelte";
	import SensorControls from "$lib/components/sensor-controls.svelte";
	import OledScreen from "$lib/components/oled-screen.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Toggle } from "$lib/components/ui/toggle/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { PicoSimulator } from "$lib/sim/pico-simulator.svelte.js";
	import { defaultSensorValues, type SensorValues } from "$lib/sim/devices.js";
	import type { ComponentGuide } from "$lib/data/components/index.js";
	import { untrack } from "svelte";

	let { guide }: { guide: ComponentGuide } = $props();

	const simulator = new PicoSimulator();

	// Komponentsidan skapas om för varje komponent (se {#key} i App.svelte),
	// så startvärdena behöver bara läsas en gång.
	let code = $state(untrack(() => guide.code.source));
	let trackLines = $state(true);
	let parts = $state(untrack(() => guide.sim.parts ?? []));
	let values = $state<SensorValues>({ ...defaultSensorValues });

	const controls = $derived(guide.sim.controls ?? []);
	const edited = $derived(code !== guide.code.source);

	untrack(() => simulator.setDevices(guide.sim.devices ?? []));

	// Skicka nya sensorvärden till simulatorn när eleven drar i ett reglage
	$effect(() => {
		simulator.setSensors($state.snapshot(values));
	});

	// Stäng av emulatorn när man lämnar sidan
	$effect(() => () => simulator.stop());

	const statusText = $derived(
		{
			idle: "Stoppad",
			loading: "Hämtar firmware…",
			booting: "Startar MicroPython…",
			running: "Kör",
			error: "Fel",
		}[simulator.status],
	);

	function run() {
		void simulator.runCode(code, { trackLines, files: guide.sim.files });
	}

	/** HC-SR04: föremålets läge längs banan, i procent */
	const objectPosition = $derived(28 + (Math.min(values.distance, 400) / 400) * 64);
</script>

<Card.Root size="sm" class="gap-0 py-0">
	<Card.Header class="items-center border-b py-2 [.border-b]:pb-2">
		<Card.Description class="flex flex-wrap items-center gap-2">
			<span class="font-mono text-xs">{guide.code.filename}</span>
			<Badge variant={simulator.status === "error" ? "destructive" : "secondary"}>{statusText}</Badge>
			{#if trackLines && simulator.currentLine !== null}
				<Badge variant="outline" class="font-mono">Rad {simulator.currentLine}</Badge>
			{/if}
		</Card.Description>
		<Card.Action class="flex flex-wrap items-center justify-end gap-1 self-center">
			<Toggle size="sm" bind:pressed={trackLines} aria-label="Följ raden som körs" title="Markera raden som körs">
				<FootprintsIcon />
				Följ rad
			</Toggle>
			{#if edited}
				<Button variant="ghost" size="sm" onclick={() => (code = guide.code.source)} title="Återställ exempelkoden">
					<UndoIcon />
					Återställ
				</Button>
			{/if}
			<Button size="sm" onclick={run} disabled={simulator.status === "loading"}>
				<PlayIcon />
				Kör
			</Button>
			<Button variant="ghost" size="sm" onclick={() => simulator.interrupt()} disabled={!simulator.running}>
				<SquareIcon />
				Avbryt
			</Button>
			<Button
				variant="ghost"
				size="icon-sm"
				onclick={() => simulator.stop()}
				disabled={!simulator.running}
				aria-label="Stäng av simulatorn"
				title="Stäng av simulatorn"
			>
				<RotateCcwIcon />
			</Button>
		</Card.Action>
	</Card.Header>

	<div class="grid lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
		<div class="h-[24rem] min-h-0 border-b lg:h-[30rem] lg:border-r lg:border-b-0">
			<CodeEditor bind:value={code} activeLine={trackLines ? simulator.currentLine : null} class="h-full overflow-auto" />
		</div>

		<div class="flex min-h-0 flex-col gap-6 p-5">
			{#if parts.length > 0}
				<VirtualBoard bind:parts pins={simulator.pins} running={simulator.running} editable={false} />
			{/if}

			{#if guide.sim.display}
				<OledScreen frame={simulator.display} />
			{/if}

			{#if controls.includes("distance")}
				<!-- Sensorn till vänster och föremålet den mäter mot till höger -->
				<div class="relative h-32 overflow-hidden border bg-muted/30" aria-hidden="true">
					<wokwi-hc-sr04 class="absolute top-1/2 left-3 origin-left -translate-y-1/2 scale-[0.62]"></wokwi-hc-sr04>
					{#if simulator.running}
						{#each [0, 1, 2] as wave (wave)}
							<span class="wave" style:animation-delay={`${wave * 0.5}s`} style:--travel={`${objectPosition - 22}%`}></span>
						{/each}
					{/if}
					<div
						class="absolute top-1/2 h-20 w-4 -translate-y-1/2 bg-foreground/80 transition-[left] duration-200"
						class:opacity-30={values.distance > 400}
						style:left={`${objectPosition}%`}
					></div>
				</div>
			{/if}

			{#if controls.length > 0}
				<SensorControls bind:values {controls} ranges={guide.sim.ranges} />
			{/if}

			{#if simulator.error}
				<Alert.Root variant="destructive">
					<TriangleAlertIcon />
					<Alert.Title>Simulatorn kunde inte starta</Alert.Title>
					<Alert.Description>{simulator.error}</Alert.Description>
				</Alert.Root>
			{/if}
		</div>
	</div>

	<div class="h-44 border-t">
		<SerialConsole
			class="h-full"
			text={simulator.output}
			placeholder="Tryck på Kör – utskrifterna från print() hamnar här."
			onsend={(text) => simulator.write(text)}
		/>
	</div>
</Card.Root>

<style>
	/* Ljudvågor från sensorn mot föremålet */
	.wave {
		position: absolute;
		top: 50%;
		left: 22%;
		width: 14px;
		height: 44px;
		border: 2px solid var(--primary);
		border-left: none;
		border-radius: 0 50% 50% 0;
		transform: translateY(-50%);
		opacity: 0;
		animation: travel 1.5s linear infinite;
	}

	@keyframes travel {
		from {
			opacity: 0.9;
			margin-left: 0;
		}
		to {
			opacity: 0;
			margin-left: var(--travel);
		}
	}
</style>
