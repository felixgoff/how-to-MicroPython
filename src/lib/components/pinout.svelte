<script lang="ts">
	import { cn } from "$lib/utils.js";
	import CodeBlock from "$lib/components/code-block.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import {
		categories,
		internalPins,
		leftPins,
		rightPins,
		pinCategories,
		pwmChannel,
		type Category,
		type Pin,
	} from "$lib/data/pinout.js";

	// Tom sträng = inget filter (så fungerar ToggleGroup med type="single")
	let filter = $state<Category | "">("");
	let selected = $state<Pin>(leftPins[0]);
	let hovered = $state<Pin | null>(null);
	let pinButtons: Record<number, HTMLButtonElement> = {};

	const shown = $derived(hovered ?? selected);
	const activeCategory = $derived(categories.find((c) => c.id === filter));

	function matches(pin: Pin) {
		return filter === "" || pinCategories(pin).includes(filter);
	}

	function colorClass(pin: Pin) {
		if (pin.adc) return "bg-sky-700 text-white";
		switch (pin.kind) {
			case "gpio":
				return "bg-emerald-700 text-white";
			case "gnd":
				return "bg-neutral-800 text-white dark:bg-neutral-600";
			case "power":
				return "bg-red-700 text-white";
			case "system":
				return "bg-amber-300 text-neutral-950";
		}
	}

	function kindLabel(pin: Pin) {
		if (pin.adc) return "GPIO med analog ingång";
		return { gpio: "GPIO", gnd: "Jord", power: "Strömförsörjning", system: "Systemstift" }[pin.kind];
	}

	function functions(pin: Pin): [string, string[]][] {
		if (pin.gpio === undefined) return [];
		const rows: [string, string[] | undefined][] = [
			["GPIO", [String(pin.gpio)]],
			["PWM", [pwmChannel(pin.gpio)]],
			["ADC", pin.adc ? [pin.adc] : undefined],
			["I2C", pin.i2c],
			["SPI", pin.spi],
			["UART", pin.uart],
		];
		return rows.filter((row): row is [string, string[]] => row[1] !== undefined);
	}

	function example(pin: Pin): string | null {
		if (pin.gpio === undefined) return null;
		if (pin.adc) return `sensor = ADC(Pin(${pin.gpio}))\nvarde = sensor.read_u16()`;
		return `led = Pin(${pin.gpio}, Pin.OUT)\nled.on()`;
	}

	// Piltangenter flyttar mellan stiften (roving tabindex), så att hela kortet
	// bara tar ett tabbsteg men ändå går att utforska med tangentbordet.
	function onKeydown(event: KeyboardEvent, side: Pin[], index: number) {
		let next: Pin | undefined;
		const other = side === leftPins ? rightPins : leftPins;
		switch (event.key) {
			case "ArrowDown":
				next = side[Math.min(index + 1, side.length - 1)];
				break;
			case "ArrowUp":
				next = side[Math.max(index - 1, 0)];
				break;
			case "ArrowLeft":
			case "ArrowRight":
				next = other[index];
				break;
			case "Home":
				next = side[0];
				break;
			case "End":
				next = side[side.length - 1];
				break;
			default:
				return;
		}
		event.preventDefault();
		selected = next;
		pinButtons[next.number]?.focus();
	}
</script>

{#snippet pinButton(pin: Pin, side: Pin[], index: number, align: "left" | "right")}
	<button
		bind:this={pinButtons[pin.number]}
		type="button"
		tabindex={selected.number === pin.number ? 0 : -1}
		aria-pressed={selected.number === pin.number}
		aria-label={`Stift ${pin.number}: ${pin.name}${pin.adc ? `, ${pin.adc}` : ""}`}
		class={cn(
			"group flex h-full items-center gap-1.5 outline-none transition-opacity",
			align === "left" ? "flex-row justify-end" : "flex-row-reverse justify-end",
			!matches(pin) && "opacity-25",
		)}
		onclick={() => (selected = pin)}
		onkeydown={(e) => onKeydown(e, side, index)}
		onmouseenter={() => (hovered = pin)}
		onmouseleave={() => (hovered = null)}
	>
		<span class="w-5 text-center font-mono text-[0.65rem] text-muted-foreground tabular-nums">{pin.number}</span>
		<span
			class={cn(
				"min-w-[4.25rem] px-1.5 py-0.5 text-center font-mono text-xs font-semibold whitespace-nowrap ring-offset-2 ring-offset-background transition-shadow sm:min-w-[5.5rem]",
				colorClass(pin),
				"group-hover:ring-2 group-hover:ring-ring group-focus-visible:ring-3 group-focus-visible:ring-foreground",
				selected.number === pin.number && "ring-2 ring-foreground",
			)}
		>
			{pin.name}{#if pin.adc}<span class="hidden sm:inline"> · {pin.adc}</span>{/if}
		</span>
		<span aria-hidden="true" class="h-px w-2 bg-muted-foreground sm:w-4"></span>
	</button>
{/snippet}

<div class="flex flex-col gap-6">
	<ToggleGroup.Root
		type="single"
		variant="outline"
		size="sm"
		spacing={2}
		bind:value={filter}
		aria-label="Filtrera stift efter typ"
		class="flex-wrap"
	>
		{#each categories as category (category.id)}
			<ToggleGroup.Item value={category.id}>{category.label}</ToggleGroup.Item>
		{/each}
	</ToggleGroup.Root>

	<div class="grid gap-8 xl:grid-cols-[auto_minmax(0,1fr)]">
		<div
			role="group"
			aria-label="Raspberry Pi Pico WH, 40 stift. Använd piltangenterna för att flytta mellan stiften."
			class="relative mx-auto grid w-full max-w-xl grid-cols-[1fr_6.5rem_1fr] grid-rows-[repeat(20,1.75rem)] pt-8 sm:grid-cols-[1fr_9rem_1fr] sm:grid-rows-[repeat(20,2rem)]"
		>
			<!-- Själva kortet -->
			<div
				aria-hidden="true"
				class="relative col-start-2 row-span-20 row-start-1 flex justify-between rounded-sm bg-emerald-900 px-1.5 shadow-lg"
			>
				<!-- USB-kontakten sticker ut i kortets övre ände, vid stift 1 och 40 -->
				<div class="absolute -top-7 left-1/2 h-9 w-10 -translate-x-1/2 rounded-t-sm bg-neutral-300 shadow-inner sm:w-12 dark:bg-neutral-400"></div>
				<div class="flex flex-col justify-around">
					{#each leftPins as pin (pin.number)}
						<span class={cn("size-2.5 rounded-full border-2 border-amber-400 bg-amber-300 sm:size-3", !matches(pin) && "opacity-40")}></span>
					{/each}
				</div>
				<div class="flex flex-col items-center justify-between gap-4 py-6">
					<div class="flex flex-col items-center gap-4">
						<div class="flex items-center gap-2">
							<span class="size-2 rounded-full bg-lime-400 shadow-[0_0_6px] shadow-lime-400"></span>
							<span class="text-[0.55rem] text-emerald-100">LED</span>
						</div>
						<span class="size-5 rounded-full border-2 border-neutral-300 bg-neutral-100"></span>
						<div class="grid size-14 place-items-center bg-neutral-900 text-[0.55rem] font-semibold text-neutral-300 sm:size-16">
							RP2040
						</div>
					</div>
					<span class="font-mono text-[0.6rem] tracking-widest text-emerald-100 [writing-mode:vertical-rl]">
						Raspberry Pi Pico WH
					</span>
					<!-- WiFi-chippet och antennen sitter i andra änden, vid stift 20 och 21 -->
					<div class="flex flex-col items-center gap-2">
						<div class="grid size-9 place-items-center rounded-xs bg-neutral-300 text-center text-[0.45rem] leading-tight text-neutral-700 sm:size-11">
							CYW43439<br />WiFi + BT
						</div>
						<svg viewBox="0 0 40 12" class="h-3 w-10 sm:w-12" aria-hidden="true">
							<path d="M1 11 V2 H8 V10 H15 V2 H22 V10 H29 V2 H36 V11" fill="none" class="stroke-amber-300" stroke-width="1.6" />
						</svg>
					</div>
				</div>
				<div class="flex flex-col justify-around">
					{#each rightPins as pin (pin.number)}
						<span class={cn("size-2.5 rounded-full border-2 border-amber-400 bg-amber-300 sm:size-3", !matches(pin) && "opacity-40")}></span>
					{/each}
				</div>
			</div>

			{#each leftPins as pin, i (pin.number)}
				<div class="col-start-1" style:grid-row={i + 1}>
					{@render pinButton(pin, leftPins, i, "left")}
				</div>
			{/each}
			{#each rightPins as pin, i (pin.number)}
				<div class="col-start-3" style:grid-row={i + 1}>
					{@render pinButton(pin, rightPins, i, "right")}
				</div>
			{/each}
		</div>

		<Card.Root size="sm" aria-live="polite" class="self-start xl:sticky xl:top-20">
			<Card.Header>
				<Card.Description>Stift {shown.number} · {kindLabel(shown)}</Card.Description>
				<Card.Title class="font-mono text-2xl normal-case">{shown.name}</Card.Title>
			</Card.Header>

			<Card.Content class="flex flex-col gap-4">
				{#if shown.description}
					<p>{shown.description}</p>
				{/if}

				{#if shown.gpio !== undefined}
					<dl class="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2">
						{#each functions(shown) as [label, values] (label)}
							<dt class="text-muted-foreground">{label}</dt>
							<dd class="flex flex-wrap gap-2">
								{#each values as value (value)}
									<Badge variant="outline" class="font-mono">{value}</Badge>
								{/each}
							</dd>
						{/each}
					</dl>
				{/if}

				{#if example(shown)}
					<CodeBlock code={example(shown)!} filename="Exempel" />
				{/if}

				<Separator />

				{#if activeCategory}
					<div class="flex flex-col gap-1">
						<p class="font-semibold">{activeCategory.label}</p>
						<p class="text-muted-foreground">{activeCategory.description}</p>
					</div>
				{:else}
					<p class="text-muted-foreground">
						Hovra eller klicka på ett stift för att se vad det gör. Välj en kategori ovan för att markera alla stift av
						samma typ.
					</p>
				{/if}
			</Card.Content>
		</Card.Root>
	</div>

	<section aria-labelledby="interna-stift" class="flex flex-col gap-3 border-t pt-6">
		<h3 id="interna-stift" class="font-semibold">Stift som inte går ut till kanten</h3>
		<p class="max-w-3xl text-sm text-muted-foreground">
			Pico WH har fyra GPIO-stift som är upptagna av WiFi- och Bluetooth-chippet inuti kortet. Du kan alltså inte
			använda dem själv, men det är bra att veta att de finns.
		</p>
		<dl class="grid gap-x-6 gap-y-2 sm:grid-cols-2">
			{#each internalPins as pin (pin.name)}
				<div class="flex gap-3">
					<dt class="font-mono text-sm font-semibold">{pin.name}</dt>
					<dd class="text-sm text-muted-foreground">{pin.description}</dd>
				</div>
			{/each}
		</dl>
	</section>
</div>
