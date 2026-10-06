<script lang="ts">
	import ArrowLeftIcon from "@lucide/svelte/icons/arrow-left";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import CheckIcon from "@lucide/svelte/icons/check";
	import CircleAlertIcon from "@lucide/svelte/icons/circle-alert";
	import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
	import { openInLab } from "$lib/lab.js";
	import WiringDiagram from "$lib/components/wiring-diagram.svelte";
	import CodeBlock from "$lib/components/code-block.svelte";
	import ComponentTester from "$lib/components/component-tester.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Accordion from "$lib/components/ui/accordion/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { componentGuides, type ComponentGuide } from "$lib/data/components/index.js";

	let { guide }: { guide: ComponentGuide } = $props();

	const index = $derived(componentGuides.indexOf(guide));
	const previous = $derived(componentGuides[index - 1]);
	const next = $derived(componentGuides[index + 1]);

	const sections = [
		{ id: "koppla", label: "Koppla in" },
		{ id: "koden", label: "Koden" },
		{ id: "felsok", label: "Felsök" },
		{ id: "testa", label: "Testa" },
		{ id: "riktig-pico", label: "Kör på Pico" },
	];
</script>

<article class="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-8 sm:px-8 sm:py-12">
	<header class="flex flex-col gap-6">
		<div class="flex flex-col gap-4">
			<Badge variant="default" class="text-primary">Komponent {index + 1} av {componentGuides.length}</Badge>
			<h1 class="text-3xl font-bold tracking-tight text-balance sm:text-5xl">{guide.title}</h1>
			<p class="max-w-3xl text-lg text-pretty text-muted-foreground">{guide.tagline}</p>
			<div class="flex flex-wrap gap-3">
				{#each guide.tags as tag (tag)}
					<Badge variant="outline">{tag}</Badge>
				{/each}
			</div>
		</div>

		<dl class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
			{#each guide.facts as fact (fact.label)}
				<div class="flex flex-col gap-1 border bg-card p-4">
					<dt class="text-xs text-muted-foreground">{fact.label}</dt>
					<dd class="font-semibold">{fact.value}</dd>
				</div>
			{/each}
		</dl>

		<nav aria-label="På den här sidan" class="flex flex-wrap items-center gap-2">
			<span class="text-sm text-muted-foreground">Hoppa till:</span>
			{#each sections as section (section.id)}
				<Button href={`#${section.id}`} variant="ghost" size="sm">{section.label}</Button>
			{/each}
		</nav>
	</header>

	<section aria-labelledby="hur-rubrik" class="grid gap-8 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
		<div class="flex flex-col gap-4">
			<h2 id="hur-rubrik" class="text-2xl font-bold tracking-tight">Så fungerar den</h2>
			{#each guide.how as paragraph, i (i)}
				<p class="max-w-prose text-pretty">{paragraph}</p>
			{/each}
		</div>

		<Card.Root size="sm" class="self-start">
			<Card.Header>
				<Card.Title class="text-sm">Det här behöver du</Card.Title>
			</Card.Header>
			<Card.Content>
				<ul class="flex flex-col gap-3">
					{#each guide.needs as need (need.item)}
						<li class="flex gap-3">
							<CheckIcon class="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
							<span>
								{need.item}
								{#if need.note}<span class="block text-sm text-muted-foreground">{need.note}</span>{/if}
							</span>
						</li>
					{/each}
				</ul>
			</Card.Content>
		</Card.Root>
	</section>

	<section id="koppla" aria-labelledby="koppla-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="koppla-rubrik" class="text-2xl font-bold tracking-tight">Koppla in den</h2>
			<p class="max-w-3xl text-muted-foreground">
				Följ animationen steg för steg. Den startar när du kommer hit, och du kan pausa eller bläddra med pilarna.
				Koppla alltid bort USB-sladden medan du kopplar.
			</p>
		</div>

		<WiringDiagram diagram={guide.diagram} />

		<Card.Root size="sm">
			<Card.Header>
				<Card.Title class="text-sm">Kopplingen i korthet</Card.Title>
			</Card.Header>
			<Card.Content>
				<table class="w-full text-left">
					<thead class="sr-only">
						<tr><th>Komponent</th><th>Pico WH</th></tr>
					</thead>
					<tbody>
						{#each guide.connections as connection (connection.from)}
							<tr class="border-b last:border-0">
								<td class="py-2 pr-4">{connection.from}</td>
								<td class="py-2 text-muted-foreground" aria-hidden="true">→</td>
								<td class="py-2 pl-4 font-mono text-sm">{connection.to}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</Card.Content>
		</Card.Root>
	</section>

	<section id="koden" aria-labelledby="koden-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<h2 id="koden-rubrik" class="text-2xl font-bold tracking-tight">Koden</h2>
		<div class="grid gap-8 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
			<div class="flex min-w-0 flex-col items-start gap-4">
				<div class="w-full">
					<CodeBlock code={guide.code.source} filename={guide.code.filename} />
				</div>
				<p class="text-sm text-muted-foreground">
					Vill du köra koden på ett riktigt kort? Öppna den i Kodlabbet, anslut Picon och tryck på Kör på Picon.
				</p>
				<Button onclick={() => openInLab(guide.code.source)} variant="outline" size="sm">
					<FlaskConicalIcon />
					Öppna i Kodlabbet
				</Button>
			</div>
			<dl class="flex flex-col gap-4">
				{#each guide.code.notes as note (note.lines)}
					<div class="grid grid-cols-[4.5rem_1fr] gap-3">
						<dt><Badge variant="outline" class="font-mono">Rad {note.lines}</Badge></dt>
						<dd class="text-pretty text-muted-foreground">{note.text}</dd>
					</div>
				{/each}
			</dl>
		</div>
	</section>

	<section id="felsok" aria-labelledby="felsok-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="felsok-rubrik" class="text-2xl font-bold tracking-tight">Vanliga fel</h2>
			<p class="max-w-3xl text-muted-foreground">Fungerar det inte? Börja här – de här felen står för de flesta problemen.</p>
		</div>
		<Accordion.Root type="multiple" class="max-w-3xl">
			{#each guide.pitfalls as pitfall (pitfall.title)}
				<Accordion.Item value={pitfall.title}>
					<Accordion.Trigger>
						<span class="flex items-center gap-3">
							<CircleAlertIcon class="size-4 shrink-0 text-primary" aria-hidden="true" />
							{pitfall.title}
						</span>
					</Accordion.Trigger>
					<Accordion.Content>
						<p class="pl-7 text-muted-foreground">{pitfall.text}</p>
					</Accordion.Content>
				</Accordion.Item>
			{/each}
		</Accordion.Root>
	</section>

	<section id="testa" aria-labelledby="testa-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="testa-rubrik" class="text-2xl font-bold tracking-tight">Testa koden</h2>
			<p class="max-w-3xl text-muted-foreground">
				Kör koden i en emulerad Pico WH där komponenten redan är inkopplad precis som i schemat. Ändra i koden
				{#if (guide.sim.controls ?? []).length > 0}och dra i reglagen för att se hur mätvärdena ändras{:else}och se vad som händer{/if}.
			</p>
		</div>
		<ComponentTester {guide} />
	</section>

	<Separator />

	<nav aria-label="Andra komponenter" class="flex flex-wrap items-center justify-between gap-4">
		{#if previous}
			<Button href={`#/komponent/${previous.slug}`} variant="outline">
				<ArrowLeftIcon />
				{previous.title}
			</Button>
		{:else}
			<span></span>
		{/if}
		{#if next}
			<Button href={`#/komponent/${next.slug}`} variant="outline">
				{next.title}
				<ArrowRightIcon />
			</Button>
		{/if}
	</nav>
</article>
