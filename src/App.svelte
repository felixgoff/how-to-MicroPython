<script lang="ts">
	import * as Sidebar from "$lib/components/ui/sidebar/index.js";
	import AppSidebar from "$lib/components/app-sidebar.svelte";
	import ThemeToggle from "$lib/components/theme-toggle.svelte";
	import Intro from "$lib/pages/intro.svelte";
	import Playground from "$lib/pages/playground.svelte";
	import ComponentPage from "$lib/pages/component-page.svelte";
	import { guideFor } from "$lib/data/components/index.js";
	import { router } from "$lib/router.svelte.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
	import BookOpenIcon from "@lucide/svelte/icons/book-open";
	import { ModeWatcher } from "mode-watcher";

	const guide = $derived(router.component ? guideFor(router.component) : undefined);
</script>

<ModeWatcher />

<a
	href="#innehall"
	class="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
>
	Hoppa till innehållet
</a>

<Sidebar.Provider>
	<AppSidebar />
	<Sidebar.Inset>
		<header class="sticky top-0 z-10 flex h-14 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur">
			<Sidebar.Trigger aria-label="Visa eller dölj menyn" />
			<p class="font-semibold">Pico WH Guide</p>
			<div class="ml-auto flex items-center gap-2">
				{#if router.path === "/kodlabb"}
					<Button href="#/" variant="outline" size="sm">
						<BookOpenIcon />
						Guiden
					</Button>
				{:else}
					<Button href="#/kodlabb" size="sm">
						<FlaskConicalIcon />
						Kodlabb
					</Button>
				{/if}
				<ThemeToggle />
			</div>
		</header>

		<div id="innehall" tabindex="-1" class="flex-1 outline-none">
			{#if router.path === "/kodlabb"}
				<Playground />
			{:else if guide}
				<!-- En ny sida för varje komponent, så att simulatorn och animationen börjar om -->
				{#key guide.slug}
					<ComponentPage {guide} />
				{/key}
			{:else}
				<Intro />
			{/if}
		</div>

		<footer class="border-t px-4 py-6 text-center text-sm text-muted-foreground sm:px-8">
			Lärplattform för Raspberry Pi Pico WH och MicroPython
		</footer>
	</Sidebar.Inset>
</Sidebar.Provider>
