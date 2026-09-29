<script lang="ts">
	import SunIcon from "@lucide/svelte/icons/sun";
	import MoonIcon from "@lucide/svelte/icons/moon";
	import { mode, toggleMode } from "mode-watcher";
	import { Button } from "$lib/components/ui/button/index.js";
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";

	const label = $derived(mode.current === "dark" ? "Byt till ljust läge" : "Byt till mörkt läge");
</script>

<Tooltip.Root>
	<Tooltip.Trigger>
		{#snippet child({ props })}
			<Button {...props} variant="ghost" size="icon" onclick={toggleMode} aria-label={label}>
				{#if mode.current === "dark"}
					<SunIcon />
				{:else}
					<MoonIcon />
				{/if}
			</Button>
		{/snippet}
	</Tooltip.Trigger>
	<Tooltip.Content>{label}</Tooltip.Content>
</Tooltip.Root>
