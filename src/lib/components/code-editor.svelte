<script lang="ts">
	import { EditorView, basicSetup } from "codemirror";
	import { EditorState, Compartment, StateEffect, StateField } from "@codemirror/state";
	import { Decoration, keymap, type DecorationSet } from "@codemirror/view";
	import { indentWithTab } from "@codemirror/commands";
	import { python } from "@codemirror/lang-python";
	import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
	import { tags } from "@lezer/highlight";
	import { mode } from "mode-watcher";
	import { untrack } from "svelte";

	let {
		value = $bindable(""),
		activeLine = null,
		class: className,
	}: {
		value?: string;
		/** Raden som körs just nu (1-indexerad), markeras i editorn */
		activeLine?: number | null;
		class?: string;
	} = $props();

	/** Hur länge en rad ligger kvar och tonar ut efter att koden lämnat den */
	const FADE_MS = 500;
	/** Så många utdöende rader visas samtidigt – ett kort spår genom koden */
	const MAX_FADING = 4;
	/** Hur ofta uttoningen ritas om */
	const TICK_MS = 40;

	type LineMark = { line: number; opacity: number };

	// Markering av raden som körs, som en dekoration över hela radens bredd.
	// Uttoningen ritas med inline-stil i stället för en CSS-animation: när en
	// rad körs om (t.ex. i en loop) återanvänder CodeMirror samma element, och
	// då startar en CSS-animation inte om.
	const setMarks = StateEffect.define<LineMark[]>();
	const activeLineField = StateField.define<DecorationSet>({
		create: () => Decoration.none,
		update(decorations, transaction) {
			decorations = decorations.map(transaction.changes);
			for (const effect of transaction.effects) {
				if (!effect.is(setMarks)) continue;
				const ranges = effect.value
					.filter((mark) => mark.line >= 1 && mark.line <= transaction.state.doc.lines)
					.map((mark) =>
						Decoration.line({
							class: "cm-running-line",
							// Procenttalen räknas ut här i stället för med calc() i CSS,
							// så att färgen fungerar likadant i alla webbläsare
							attributes: {
								style:
									`background-color: color-mix(in oklch, var(--primary) ${(mark.opacity * 22).toFixed(1)}%, transparent);` +
									`box-shadow: inset 3px 0 0 0 color-mix(in oklch, var(--primary) ${(mark.opacity * 100).toFixed(1)}%, transparent);`,
							},
						}).range(transaction.state.doc.line(mark.line).from),
					);
				return Decoration.set(ranges, true);
			}
			return decorations;
		},
		provide: (field) => EditorView.decorations.from(field),
	});

	let host = $state<HTMLDivElement>();
	let view: EditorView | undefined;
	const themeCompartment = new Compartment();

	// Samma färger som i kodrutorna på resten av sidan
	const highlightStyle = (dark: boolean) =>
		HighlightStyle.define([
			{ tag: [tags.keyword, tags.operatorKeyword, tags.bool, tags.null], color: dark ? "oklch(0.78 0.13 300)" : "oklch(0.45 0.2 300)" },
			{ tag: [tags.string, tags.special(tags.string)], color: dark ? "oklch(0.8 0.14 150)" : "oklch(0.47 0.13 150)" },
			{ tag: [tags.number, tags.constant(tags.name)], color: dark ? "oklch(0.8 0.13 60)" : "oklch(0.5 0.15 50)" },
			{ tag: [tags.comment], color: dark ? "oklch(0.68 0 0)" : "oklch(0.5 0 0)", fontStyle: "italic" },
			{ tag: [tags.function(tags.variableName), tags.definition(tags.variableName)], color: dark ? "oklch(0.78 0.12 250)" : "oklch(0.45 0.15 250)" },
			{ tag: [tags.className, tags.typeName], color: dark ? "oklch(0.8 0.1 195)" : "oklch(0.45 0.1 195)" },
		]);

	const editorTheme = (dark: boolean) =>
		EditorView.theme(
			{
				"&": { height: "100%", fontSize: "0.875rem", backgroundColor: "transparent" },
				".cm-scroller": { fontFamily: "var(--font-mono, ui-monospace, monospace)", lineHeight: "1.6" },
				".cm-content": { caretColor: "var(--foreground)" },
				".cm-gutters": {
					backgroundColor: "transparent",
					color: "var(--muted-foreground)",
					border: "none",
					borderRight: "1px solid var(--border)",
				},
				".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "color-mix(in oklch, var(--muted) 60%, transparent)" },
				"&.cm-focused": { outline: "none" },
				".cm-selectionBackground, &.cm-focused .cm-selectionBackground, ::selection": {
					backgroundColor: "color-mix(in oklch, var(--primary) 25%, transparent)",
				},
				".cm-cursor": { borderLeftColor: "var(--foreground)" },
				// Markeringen av raden som körs ligger i app.css
			},
			{ dark },
		);

	const themeExtensions = (dark: boolean) => [editorTheme(dark), syntaxHighlighting(highlightStyle(dark))];

	// Editorn skapas en enda gång. Koden och färgtemat läses med untrack, annars
	// skulle varje tangenttryck bygga om editorn – då tappar man markören.
	$effect(() => {
		if (!host) return;
		const dark = untrack(() => mode.current === "dark");

		view = new EditorView({
			parent: host,
			state: EditorState.create({
				doc: untrack(() => value),
				extensions: [
					basicSetup,
					python(),
					keymap.of([indentWithTab]),
					activeLineField,
					themeCompartment.of(themeExtensions(dark)),
					EditorView.updateListener.of((update) => {
						if (update.docChanged) value = update.state.doc.toString();
					}),
				],
			}),
		});

		return () => {
			view?.destroy();
			view = undefined;
		};
	});

	// Byt färgtema när användaren växlar mellan ljust och mörkt läge
	$effect(() => {
		const dark = mode.current === "dark";
		view?.dispatch({ effects: themeCompartment.reconfigure(themeExtensions(dark)) });
	});

	/** Rader som lämnats nyligen, med tidpunkten då de slutade köra */
	let trail: { line: number; leftAt: number }[] = [];
	let shownLine: number | null = null;
	let ticker: ReturnType<typeof setInterval> | undefined;

	function render(scroll = false) {
		if (!view) return;
		const now = Date.now();
		trail = trail.filter((entry) => now - entry.leftAt < FADE_MS);

		const marks: LineMark[] = trail.map((entry) => {
			const progress = (now - entry.leftAt) / FADE_MS;
			// Tonar ut snabbt i början och mjukt på slutet
			return { line: entry.line, opacity: (1 - progress) ** 1.6 };
		});
		if (shownLine !== null) marks.push({ line: shownLine, opacity: 1 });

		const effects: StateEffect<unknown>[] = [setMarks.of(marks)];
		if (scroll && shownLine !== null && shownLine >= 1 && shownLine <= view.state.doc.lines) {
			// "nearest" scrollar bara när raden ligger utanför synfältet
			effects.push(EditorView.scrollIntoView(view.state.doc.line(shownLine).from, { y: "nearest" }));
		}
		view.dispatch({ effects });

		if (trail.length === 0) stopTicker();
	}

	function startTicker() {
		if (ticker !== undefined) return;
		ticker = setInterval(() => render(), TICK_MS);
	}

	function stopTicker() {
		clearInterval(ticker);
		ticker = undefined;
	}

	// Flytta markeringen när simulatorn går vidare till nästa rad. Den gamla
	// raden ligger kvar en stund och tonar ut, så att snabba hopp syns.
	$effect(() => {
		const line = activeLine;
		if (!view || line === shownLine) return;

		if (shownLine !== null) {
			trail = [
				{ line: shownLine, leftAt: Date.now() },
				...trail.filter((entry) => entry.line !== shownLine),
			].slice(0, MAX_FADING);
		}
		// En rad som körs igen ska lysa helt, inte tona ut
		if (line !== null) trail = trail.filter((entry) => entry.line !== line);

		shownLine = line;
		render(true);
		if (trail.length > 0) startTicker();
	});

	$effect(() => () => stopTicker());

	// Om koden byts utifrån (t.ex. när man väljer ett exempel) uppdateras editorn
	$effect(() => {
		const next = value;
		if (view && next !== view.state.doc.toString()) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } });
		}
	});
</script>

<div bind:this={host} class={className} spellcheck="false"></div>
