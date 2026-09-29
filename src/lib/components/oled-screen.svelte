<script lang="ts">
	import "@wokwi/elements/dist/esm/ssd1306-element.js";
	import type { DisplayFrame } from "$lib/sim/devices.js";

	let { frame }: { frame: DisplayFrame | null } = $props();

	let element = $state<HTMLElement & { imageData: ImageData; redraw(): void }>();

	// Ritar skärmens minne (128 kolumner × 8 sidor à 8 pixlar) som en bild
	$effect(() => {
		if (!element) return;
		const pixels = new Uint8ClampedArray(128 * 64 * 4);
		for (let y = 0; y < 64; y++) {
			for (let x = 0; x < 128; x++) {
				let lit = frame ? ((frame.buffer[(y >> 3) * 128 + x] >> (y & 7)) & 1) === 1 : false;
				if (frame?.inverted) lit = !lit;
				if (!frame?.on) lit = false;
				const i = (y * 128 + x) * 4;
				pixels[i] = lit ? 186 : 0;
				pixels[i + 1] = lit ? 230 : 0;
				pixels[i + 2] = lit ? 253 : 0;
				pixels[i + 3] = 255;
			}
		}
		element.imageData = new ImageData(pixels, 128, 64);
		element.redraw();
	});
</script>

<div class="flex flex-col items-center gap-2">
	<!-- zoom (inte scale) så att den förstorade skärmen tar plats i layouten och inte lägger sig över knapparna -->
	<wokwi-ssd1306 bind:this={element} class="pointer-events-none block" style:zoom="1.6"></wokwi-ssd1306>
	<p class="sr-only" aria-live="polite">{frame?.on ? "Skärmen är på" : "Skärmen är släckt"}</p>
</div>
