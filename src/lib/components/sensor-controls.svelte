<script lang="ts">
	import SunIcon from "@lucide/svelte/icons/sun";
	import ThermometerIcon from "@lucide/svelte/icons/thermometer";
	import DropletsIcon from "@lucide/svelte/icons/droplets";
	import SproutIcon from "@lucide/svelte/icons/sprout";
	import RulerIcon from "@lucide/svelte/icons/ruler";
	import { Slider } from "$lib/components/ui/slider/index.js";
	import type { SensorValues } from "$lib/sim/devices.js";
	import type { SensorControl } from "$lib/data/components/index.js";

	let {
		values = $bindable(),
		controls,
		ranges = {},
	}: {
		values: SensorValues;
		controls: SensorControl[];
		/** Egna gränser för ett reglage, t.ex. DHT11 som bara mäter 0–50 °C */
		ranges?: Partial<Record<SensorControl, [number, number]>>;
	} = $props();

	const config = {
		light: { label: "Ljus", unit: "%", min: 0, max: 100, step: 1, icon: SunIcon, hint: "Hur mycket ljus som faller på fotoresistorn" },
		temperature: { label: "Temperatur", unit: "°C", min: -20, max: 60, step: 0.5, icon: ThermometerIcon, hint: "Luften runt sensorn" },
		humidity: { label: "Luftfuktighet", unit: "%", min: 20, max: 90, step: 1, icon: DropletsIcon, hint: "Relativ fuktighet" },
		moisture: { label: "Fukt i jorden", unit: "%", min: 0, max: 100, step: 1, icon: SproutIcon, hint: "Från torr till blöt jord" },
		distance: { label: "Avstånd", unit: "cm", min: 2, max: 450, step: 1, icon: RulerIcon, hint: "Över 400 cm är utom räckhåll" },
	} as const;

	function format(control: SensorControl, value: number) {
		return control === "temperature" ? value.toFixed(1).replace(".", ",") : String(Math.round(value));
	}
</script>

<div class="flex flex-col gap-5">
	{#each controls as control (control)}
		{@const item = config[control]}
		{@const [min, max] = ranges[control] ?? [item.min, item.max]}
		<div class="flex flex-col gap-3">
			<div class="flex items-end justify-between gap-3">
				<div class="flex items-center gap-2">
					<item.icon class="size-4 text-primary" aria-hidden="true" />
					<div>
						<p class="text-sm font-semibold" id={`control-${control}`}>{item.label}</p>
						<p class="text-xs text-muted-foreground">{item.hint}</p>
					</div>
				</div>
				<p class="font-mono text-2xl font-semibold tabular-nums">
					{format(control, values[control])}<span class="ml-1 text-sm text-muted-foreground">{item.unit}</span>
				</p>
			</div>
			<Slider
				type="single"
				bind:value={values[control]}
				{min}
				{max}
				step={item.step}
				aria-labelledby={`control-${control}`}
			/>
		</div>
	{/each}
</div>
