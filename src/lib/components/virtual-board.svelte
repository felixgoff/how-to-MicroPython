<script lang="ts">
	import "@wokwi/elements/dist/esm/led-element.js";
	import "@wokwi/elements/dist/esm/buzzer-element.js";
	import "@wokwi/elements/dist/esm/pushbutton-element.js";
	import Volume2Icon from "@lucide/svelte/icons/volume-2";
	import VolumeXIcon from "@lucide/svelte/icons/volume-x";
	import XIcon from "@lucide/svelte/icons/x";
	import PlusIcon from "@lucide/svelte/icons/plus";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import type { PinSnapshot } from "$lib/sim/pico-simulator.svelte.js";
	import {
		availablePins,
		catalog,
		entryFor,
		firstFreePin,
		ledColors,
		type Part,
		type PartKind,
	} from "$lib/sim/parts.js";

	let {
		parts = $bindable([]),
		pins,
		running,
		onpress,
		editable = true,
	}: {
		parts: Part[];
		pins: Record<number, PinSnapshot>;
		running: boolean;
		/** Anropas när en knapp trycks ner eller släpps upp */
		onpress?: (pin: number, pressed: boolean) => void;
		/** Går det att lägga till, ta bort och flytta komponenter? */
		editable?: boolean;
	} = $props();

	const off: PinSnapshot = { value: false, duty: 0, frequency: 0 };
	const pinState = (pin: number) => pins[pin] ?? off;

	// Wokwi-elementen är web components, så värdena sätts som egenskaper på
	// elementet i stället för som attribut.
	let elements: Record<string, HTMLElement & Record<string, unknown>> = $state({});

	$effect(() => {
		for (const part of parts) {
			const element = elements[part.id];
			if (!element) continue;
			const snapshot = pinState(part.pin);

			if (part.kind === "led") {
				// Vid PWM blinkar stiftet snabbare än ögat hinner se – då visar vi
				// pulskvoten som ljusstyrka i stället.
				const dimmed = snapshot.frequency > 50;
				element.value = dimmed ? snapshot.duty > 0.02 : snapshot.value;
				element.brightness = dimmed ? snapshot.duty : 1;
				element.color = part.color ?? "red";
			} else if (part.kind === "buzzer") {
				element.hasSignal = snapshot.frequency > 0 || snapshot.value;
			}
		}
	});

	// Ljud för buzzern: en ton med samma frekvens som stiftet pulsar i
	let muted = $state(false);
	let audio: AudioContext | undefined;
	let oscillator: OscillatorNode | undefined;
	let gain: GainNode | undefined;

	$effect(() => {
		const buzzer = parts.find((part) => part.kind === "buzzer");
		const snapshot = buzzer ? pinState(buzzer.pin) : off;
		const frequency = Math.round(snapshot.frequency);
		const shouldPlay = !muted && running && frequency >= 30 && frequency <= 12_000;

		if (!shouldPlay) {
			stopTone();
			return;
		}

		audio ??= new AudioContext();
		void audio.resume();
		if (!oscillator) {
			gain = audio.createGain();
			gain.gain.value = 0.05;
			gain.connect(audio.destination);
			oscillator = audio.createOscillator();
			oscillator.type = "square";
			oscillator.connect(gain);
			oscillator.start();
		}
		oscillator.frequency.setValueAtTime(frequency, audio.currentTime);
	});

	function stopTone() {
		oscillator?.stop();
		oscillator?.disconnect();
		gain?.disconnect();
		oscillator = undefined;
		gain = undefined;
	}

	$effect(() => () => {
		stopTone();
		void audio?.close();
	});

	function addPart(kind: PartKind) {
		const entry = entryFor(kind);
		const pin = firstFreePin(parts, entry.defaultPin);
		parts = [...parts, { id: `${kind}-${pin}-${Date.now()}`, kind, pin, color: entry.defaultColor }];
	}

	function removePart(id: string) {
		parts = parts.filter((part) => part.id !== id);
		delete elements[id];
	}

	function updatePart(id: string, changes: Partial<Part>) {
		parts = parts.map((part) => (part.id === id ? { ...part, ...changes } : part));
	}

	/** Stift som används av någon annan komponent går inte att välja */
	function pinTaken(pin: number, self: Part) {
		return parts.some((part) => part.id !== self.id && part.pin === pin);
	}

	const selectClass =
		"border bg-background px-2 py-1 font-mono text-xs outline-none focus-visible:ring-3 focus-visible:ring-ring";
</script>

<div class="flex min-h-0 flex-col gap-4 p-4">
	<div class="flex flex-wrap items-center justify-between gap-2">
		<p class="text-sm text-muted-foreground">
			{#if running}
				Kopplingen är igång
			{:else}
				{editable ? "Välj komponenter och tryck på Kör" : "Tryck på Kör för att starta"}
			{/if}
		</p>
		<Button
			variant="ghost"
			size="icon-sm"
			onclick={() => (muted = !muted)}
			aria-label={muted ? "Slå på ljudet" : "Stäng av ljudet"}
			title={muted ? "Slå på ljudet" : "Stäng av ljudet"}
		>
			{#if muted}<VolumeXIcon />{:else}<Volume2Icon />{/if}
		</Button>
	</div>

	{#if parts.length === 0}
		<p class="border border-dashed p-6 text-center text-sm text-muted-foreground">
			Inga komponenter är inkopplade. Lägg till en nedan.
		</p>
	{:else}
		<ul class={editable ? "grid gap-4 sm:grid-cols-2 xl:grid-cols-3" : "flex flex-wrap justify-center gap-4"}>
			{#each parts as part (part.id)}
				{@const entry = entryFor(part.kind)}
				{@const snapshot = pinState(part.pin)}
				<li class="relative flex min-w-44 flex-col items-center gap-2 border bg-card p-4 text-center">
					{#if editable}
						<Button
							variant="ghost"
							size="icon-xs"
							class="absolute top-1 right-1"
							onclick={() => removePart(part.id)}
							aria-label={`Ta bort ${entry.label} på GP${part.pin}`}
							title="Ta bort"
						>
							<XIcon />
						</Button>
					{/if}

					<div class="grid h-20 place-items-center">
						{#if part.kind === "led"}
							<wokwi-led bind:this={elements[part.id]} label={String(part.pin)}></wokwi-led>
						{:else if part.kind === "buzzer"}
							<wokwi-buzzer bind:this={elements[part.id]}></wokwi-buzzer>
						{:else}
							<wokwi-pushbutton
								bind:this={elements[part.id]}
								color="green"
								onbutton-press={() => onpress?.(part.pin, true)}
								onbutton-release={() => onpress?.(part.pin, false)}
							></wokwi-pushbutton>
						{/if}
					</div>

					<p class="text-sm font-semibold">{entry.label}</p>
					<p class="font-mono text-xs text-muted-foreground">{entry.code(part.pin)}</p>
					<p class="text-xs text-muted-foreground">{entry.wiring(part.pin)}</p>

					{#if entry.direction === "out"}
						<Badge variant="outline" class="font-mono">
							{#if snapshot.frequency > 50}
								{Math.round(snapshot.frequency)} Hz · {Math.round(snapshot.duty * 100)} %
							{:else}
								{snapshot.value ? "HÖG" : "LÅG"}
							{/if}
						</Badge>
					{:else}
						<Badge variant="outline">Håll ner för att trycka</Badge>
					{/if}

					{#if editable}
					<div class="mt-1 flex flex-wrap items-center justify-center gap-2 border-t pt-3">
						<label class="flex items-center gap-1 text-xs text-muted-foreground">
							Stift
							<select
								class={selectClass}
								value={part.pin}
								onchange={(event) => updatePart(part.id, { pin: Number(event.currentTarget.value) })}
								aria-label={`Stift för ${entry.label}`}
							>
								{#each availablePins as pin (pin)}
									<option value={pin} disabled={pinTaken(pin, part)}>GP{pin}</option>
								{/each}
							</select>
						</label>

						{#if part.kind === "led"}
							<label class="flex items-center gap-1 text-xs text-muted-foreground">
								Färg
								<select
									class={selectClass}
									value={part.color}
									onchange={(event) => updatePart(part.id, { color: event.currentTarget.value })}
									aria-label={`Färg för lysdioden på GP${part.pin}`}
								>
									{#each ledColors as option (option.value)}
										<option value={option.value}>{option.label}</option>
									{/each}
								</select>
							</label>
						{/if}
					</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}

	{#if editable}
		<div class="flex flex-wrap items-center gap-2 border-t pt-4">
			<span class="text-sm text-muted-foreground">Lägg till:</span>
			{#each catalog as entry (entry.kind)}
				<Button variant="outline" size="sm" onclick={() => addPart(entry.kind)}>
					<PlusIcon />
					{entry.label}
				</Button>
			{/each}
		</div>
	{/if}
</div>
