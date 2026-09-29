<script lang="ts" module>
	import hljs from "highlight.js/lib/core";
	import python from "highlight.js/lib/languages/python";

	// Standardgrammatiken färgar inte funktionsanrop, klassnamn eller konstanter,
	// så vi lägger till dem för att koden ska se ut som i en riktig editor.
	hljs.registerLanguage("python", (api) => {
		const language = python(api);
		language.contains.push(
			{ scope: "variable.constant", match: /(?<=\.)[A-Z][A-Z0-9_]*\b/ },
			{ scope: "title.class", match: /\b(?!True\b|False\b|None\b)[A-Z]\w*\b/ },
			{ scope: "title.function.invoke", match: /\b[a-z_]\w*(?=\()/ },
		);
		return language;
	});
</script>

<script lang="ts">
	import CopyIcon from "@lucide/svelte/icons/copy";
	import CheckIcon from "@lucide/svelte/icons/check";
	import * as Card from "$lib/components/ui/card/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { ScrollArea } from "$lib/components/ui/scroll-area/index.js";
	import { cn } from "$lib/utils.js";

	let { code, filename = "Python", class: className }: { code: string; filename?: string; class?: string } = $props();

	const trimmed = $derived(code.trim());
	const html = $derived(hljs.highlight(trimmed, { language: "python" }).value);

	let copied = $state(false);
	let timer: ReturnType<typeof setTimeout>;

	async function copy() {
		await navigator.clipboard.writeText(trimmed);
		copied = true;
		clearTimeout(timer);
		timer = setTimeout(() => (copied = false), 2000);
	}
</script>

<Card.Root size="sm" class={cn("gap-0 py-0 shadow-none", className)}>
	<Card.Header class="items-center border-b py-1.5 [.border-b]:pb-1.5">
		<Card.Description class="font-mono text-xs">{filename}</Card.Description>
		<Card.Action class="self-center">
			<Button variant="ghost" size="sm" onclick={copy} aria-label={copied ? "Kod kopierad" : "Kopiera kod"}>
				{#if copied}
					<CheckIcon class="text-primary" />
					Kopierad!
				{:else}
					<CopyIcon />
					Kopiera
				{/if}
			</Button>
		</Card.Action>
	</Card.Header>
	<Card.Content class="bg-muted/40 px-0">
		<ScrollArea orientation="horizontal">
			<pre class="p-4 font-mono text-sm leading-relaxed"><code class="hljs language-python">{@html html}</code></pre>
		</ScrollArea>
	</Card.Content>
	<span class="sr-only" aria-live="polite">{copied ? "Koden har kopierats till urklipp" : ""}</span>
</Card.Root>
