<script lang="ts">
	import { tick } from "svelte";
	import { cn } from "$lib/utils.js";

	let {
		text,
		placeholder = "Ingen utdata än.",
		onsend,
		class: className,
	}: {
		text: string;
		placeholder?: string;
		/** Anropas när användaren skriver i konsolen (om REPL:en tar emot tecken) */
		onsend?: (text: string) => void;
		class?: string;
	} = $props();

	let viewport = $state<HTMLDivElement>();
	let input = $state("");

	// Rulla ner automatiskt när ny text kommer, om användaren inte scrollat upp
	$effect(() => {
		text;
		if (!viewport) return;
		const atBottom = viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 80;
		if (atBottom) void tick().then(() => viewport?.scrollTo({ top: viewport.scrollHeight }));
	});

	function submit(event: SubmitEvent) {
		event.preventDefault();
		onsend?.(`${input}\r\n`);
		input = "";
	}
</script>

<div class={cn("flex min-h-0 flex-col bg-muted/40", className)}>
	<!-- Rutan går att fokusera så att den också kan scrollas med tangentbordet -->
	<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
	<div
		bind:this={viewport}
		role="log"
		aria-label="Seriell konsol"
		aria-live="polite"
		tabindex="0"
		class="min-h-0 flex-1 overflow-auto p-4 font-mono text-xs leading-relaxed whitespace-pre-wrap outline-none focus-visible:ring-3 focus-visible:ring-ring"
	>{text || placeholder}</div>

	{#if onsend}
		<form onsubmit={submit} class="flex items-center gap-2 border-t px-3 py-2">
			<span aria-hidden="true" class="font-mono text-xs text-muted-foreground">&gt;&gt;&gt;</span>
			<input
				bind:value={input}
				aria-label="Skicka kommando till REPL"
				placeholder="Skriv ett kommando och tryck Enter"
				class="min-w-0 flex-1 bg-transparent font-mono text-xs outline-none placeholder:text-muted-foreground"
			/>
		</form>
	{/if}
</div>
