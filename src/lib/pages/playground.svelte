<script lang="ts">
	import PlayIcon from "@lucide/svelte/icons/play";
	import SquareIcon from "@lucide/svelte/icons/square";
	import DownloadIcon from "@lucide/svelte/icons/download";
	import FolderOpenIcon from "@lucide/svelte/icons/folder-open";
	import UsbIcon from "@lucide/svelte/icons/usb";
	import SaveIcon from "@lucide/svelte/icons/save";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
	import CircuitBoardIcon from "@lucide/svelte/icons/circuit-board";
	import FootprintsIcon from "@lucide/svelte/icons/footprints";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import WifiOffIcon from "@lucide/svelte/icons/wifi-off";
	import CodeEditor from "$lib/components/code-editor.svelte";
	import SerialConsole from "$lib/components/serial-console.svelte";
	import VirtualBoard from "$lib/components/virtual-board.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Tabs from "$lib/components/ui/tabs/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import * as ToggleGroup from "$lib/components/ui/toggle-group/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Toggle } from "$lib/components/ui/toggle/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { Separator } from "$lib/components/ui/separator/index.js";
	import { PicoSimulator } from "$lib/sim/pico-simulator.svelte.js";
	import { PicoDevice } from "$lib/device/pico-device.svelte.js";
	import { examples } from "$lib/sim/examples.js";
	import { defaultParts, type Part } from "$lib/sim/parts.js";
	import { LAB_CODE_KEY } from "$lib/lab.js";

	const STORAGE_KEY = LAB_CODE_KEY;
	const PARTS_KEY = "playground-parts";

	function storedParts(): Part[] {
		try {
			const saved = localStorage.getItem(PARTS_KEY);
			return saved ? (JSON.parse(saved) as Part[]) : defaultParts;
		} catch {
			return defaultParts;
		}
	}

	const simulator = new PicoSimulator();
	const device = new PicoDevice();

	// Stäng av emulatorn när man lämnar kodlabbet, så att den inte kör i bakgrunden
	$effect(() => () => simulator.stop());

	let code = $state(localStorage.getItem(STORAGE_KEY) ?? examples[0].code);
	let filename = $state("main.py");
	let chosenExample = $state("");
	let trackLines = $state(true);
	let fileInput = $state<HTMLInputElement>();
	let parts = $state<Part[]>(storedParts());

	$effect(() => {
		localStorage.setItem(STORAGE_KEY, code);
	});

	$effect(() => {
		localStorage.setItem(PARTS_KEY, JSON.stringify(parts));
	});

	// Knappar kopplas till jord och läses med intern pull-up: stiftet ligger
	// högt tills någon trycker. Nivån sätts om när simulatorn startas.
	$effect(() => {
		if (!simulator.running) return;
		for (const part of parts) {
			if (part.kind === "button") simulator.setInput(part.pin, true);
		}
	});

	const statusText = $derived(
		{
			idle: "Stoppad",
			loading: "Hämtar firmware…",
			booting: "Startar MicroPython…",
			running: "Kör",
			error: "Fel",
		}[simulator.status],
	);

	function loadExample(id: string) {
		const example = examples.find((item) => item.id === id);
		if (example) code = example.code;
		chosenExample = "";
	}

	function download() {
		const url = URL.createObjectURL(new Blob([code], { type: "text/x-python" }));
		const link = document.createElement("a");
		link.href = url;
		link.download = filename.endsWith(".py") ? filename : `${filename}.py`;
		link.click();
		URL.revokeObjectURL(url);
	}

	async function openFile(event: Event) {
		const file = (event.target as HTMLInputElement).files?.[0];
		if (!file) return;
		code = await file.text();
		filename = file.name;
		if (fileInput) fileInput.value = "";
	}
</script>

<article class="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-8">
	<header class="flex flex-col gap-3">
		<Badge>Kodlabb</Badge>
		<h1 class="text-3xl font-bold tracking-tight text-balance sm:text-4xl">Skriv, testa och kör din kod</h1>
		<p class="max-w-3xl text-pretty text-muted-foreground">
			Koden körs i en riktig RP2040-emulator direkt i webbläsaren – samma chip som sitter i din Pico WH, med samma
			MicroPython-firmware. När koden fungerar kan du ladda ner den som en <code class="bg-muted px-1 font-mono text-[0.9em]">.py</code>-fil
			eller skicka den vidare till en Pico WH som sitter i USB-porten.
		</p>
	</header>

	<div class="flex flex-wrap items-center gap-2">
		<span class="text-sm text-muted-foreground">Exempel:</span>
		<ToggleGroup.Root
			type="single"
			variant="outline"
			size="sm"
			spacing={2}
			bind:value={chosenExample}
			onValueChange={loadExample}
			aria-label="Ladda ett exempel"
			class="flex-wrap"
		>
			{#each examples as example (example.id)}
				<ToggleGroup.Item value={example.id}>{example.title}</ToggleGroup.Item>
			{/each}
		</ToggleGroup.Root>
	</div>

	<div class="grid min-h-0 gap-6 lg:grid-cols-2">
		<Card.Root size="sm" class="min-h-[28rem] gap-0 py-0 lg:h-[38rem]">
			<Card.Header class="items-center border-b py-2 [.border-b]:pb-2">
				<Card.Description class="font-mono text-xs">{filename}</Card.Description>
				<Card.Action class="flex items-center gap-1 self-center">
					<Toggle
						size="sm"
						bind:pressed={trackLines}
						title="Markera raden som körs. Gör körningen lite långsammare."
						aria-label="Följ raden som körs"
					>
						<FootprintsIcon />
						Följ rad
					</Toggle>
					<Button variant="ghost" size="sm" onclick={() => fileInput?.click()}>
						<FolderOpenIcon />
						Öppna
					</Button>
					<Button variant="ghost" size="sm" onclick={download}>
						<DownloadIcon />
						Ladda ner
					</Button>
				</Card.Action>
			</Card.Header>
			<Card.Content class="min-h-0 flex-1 overflow-hidden px-0">
				<CodeEditor bind:value={code} activeLine={trackLines ? simulator.currentLine : null} class="h-full overflow-auto" />
			</Card.Content>
		</Card.Root>

		<Card.Root size="sm" class="min-h-[28rem] gap-0 py-0 lg:h-[38rem]">
			<Card.Header class="items-center border-b py-2 [.border-b]:pb-2">
				<Card.Description class="flex items-center gap-2">
					Simulator
					<Badge variant={simulator.status === "error" ? "destructive" : "secondary"}>{statusText}</Badge>
					{#if trackLines && simulator.currentLine !== null}
						<Badge variant="outline" class="font-mono">Rad {simulator.currentLine}</Badge>
					{/if}
				</Card.Description>
				<Card.Action class="flex items-center gap-1 self-center">
					<Button size="sm" onclick={() => simulator.runCode(code, { trackLines })} disabled={simulator.status === "loading"}>
						<PlayIcon />
						Kör
					</Button>
					<Button variant="ghost" size="sm" onclick={() => simulator.interrupt()} disabled={!simulator.running}>
						<SquareIcon />
						Avbryt
					</Button>
					<Button variant="ghost" size="icon-sm" onclick={() => simulator.stop()} disabled={!simulator.running} aria-label="Stäng av simulatorn">
						<RotateCcwIcon />
					</Button>
				</Card.Action>
			</Card.Header>

			<Card.Content class="flex min-h-0 flex-1 flex-col px-0">
				<Tabs.Root value="board" class="flex min-h-0 flex-1 flex-col gap-0">
					<Tabs.List class="mx-4 mt-3 w-fit">
						<Tabs.Trigger value="board">
							<CircuitBoardIcon />
							Koppling
						</Tabs.Trigger>
						<Tabs.Trigger value="console">Konsol</Tabs.Trigger>
					</Tabs.List>

					<Tabs.Content value="board" class="min-h-0 flex-1 overflow-auto">
						<VirtualBoard
							bind:parts
							pins={simulator.pins}
							running={simulator.running}
							onpress={(pin, pressed) => simulator.setInput(pin, !pressed)}
						/>
					</Tabs.Content>

					<Tabs.Content value="console" class="mt-3 min-h-0 flex-1">
						<SerialConsole
							class="h-full"
							text={simulator.output}
							placeholder="Tryck på Kör för att starta simulatorn."
							onsend={(text) => simulator.write(text)}
						/>
					</Tabs.Content>
				</Tabs.Root>
			</Card.Content>
		</Card.Root>
	</div>

	<Alert.Root role="note">
		<WifiOffIcon />
		<Alert.Title>Det här kan simulatorn inte</Alert.Title>
		<Alert.Description>
			Emulatorn härmar RP2040-chippet, men inte WiFi-chippet på Pico WH. Kod med
			<code class="bg-muted px-1 font-mono text-[0.9em]">network</code> eller den inbyggda lampan
			(<code class="bg-muted px-1 font-mono text-[0.9em]">Pin("LED")</code>) behöver ett riktigt kort. Använd lysdioderna
			på GP14 och GP15 här i simulatorn – precis som när du bygger på en kopplingsplatta.
		</Alert.Description>
	</Alert.Root>

	{#if simulator.error}
		<Alert.Root variant="destructive">
			<TriangleAlertIcon />
			<Alert.Title>Simulatorn kunde inte starta</Alert.Title>
			<Alert.Description>{simulator.error}</Alert.Description>
		</Alert.Root>
	{/if}

	<Separator />

	<section aria-labelledby="usb-rubrik" class="flex flex-col gap-4">
		<div class="flex flex-col gap-2">
			<h2 id="usb-rubrik" class="text-2xl font-bold tracking-tight">Kör på en riktig Pico WH</h2>
			<p class="max-w-3xl text-muted-foreground">
				Anslut en Pico WH med MicroPython till USB-porten. Webbläsaren frågar vilken enhet den får använda, sedan
				skickas koden till kortet utan att du behöver öppna Thonny. Här fungerar även WiFi och den inbyggda lampan,
				till skillnad från i simulatorn. Kräver Chrome eller Edge på dator.
			</p>
		</div>

		{#if !PicoDevice.supported}
			<Alert.Root role="note">
				<TriangleAlertIcon />
				<Alert.Title>Webbläsaren stöder inte USB-anslutning</Alert.Title>
				<Alert.Description>
					Web Serial finns i Chrome och Edge på dator. I andra webbläsare fungerar simulatorn och nerladdningen som
					vanligt – öppna den nerladdade filen i Thonny i stället.
				</Alert.Description>
			</Alert.Root>
		{:else}
			<div class="flex flex-wrap items-center gap-2">
				{#if !device.connected}
					<Button onclick={() => device.connect()} disabled={device.status === "connecting"}>
						<UsbIcon />
						Anslut Pico WH
					</Button>
				{:else}
					<Button onclick={() => device.runCode(code)} disabled={device.status === "busy"}>
						<PlayIcon />
						Kör på Picon
					</Button>
					<Button variant="outline" onclick={() => device.saveAsMain(code)} disabled={device.status === "busy"}>
						<SaveIcon />
						Spara som main.py
					</Button>
					<Button variant="outline" onclick={() => device.interrupt()}>
						<SquareIcon />
						Avbryt
					</Button>
					<Button variant="outline" onclick={() => device.reset()}>
						<RotateCcwIcon />
						Starta om
					</Button>
					<Button variant="ghost" onclick={() => device.disconnect()}>Koppla från</Button>
					<Badge variant="secondary">Ansluten</Badge>
				{/if}
			</div>

			{#if device.error}
				<Alert.Root variant="destructive">
					<TriangleAlertIcon />
					<Alert.Title>Något gick fel med anslutningen</Alert.Title>
					<Alert.Description>{device.error}</Alert.Description>
				</Alert.Root>
			{/if}

			<Card.Root size="sm" class="h-64 gap-0 py-0">
				<Card.Header class="items-center border-b py-2 [.border-b]:pb-2">
					<Card.Description>Konsol – Pico via USB</Card.Description>
					<Card.Action class="self-center">
						<Button variant="ghost" size="sm" onclick={() => device.clearOutput()}>Rensa</Button>
					</Card.Action>
				</Card.Header>
				<Card.Content class="min-h-0 flex-1 px-0">
					<SerialConsole
						class="h-full"
						text={device.output}
						placeholder="Anslut ett kort för att se vad det skriver ut."
					/>
				</Card.Content>
			</Card.Root>
		{/if}
	</section>

	<input
		bind:this={fileInput}
		type="file"
		accept=".py,text/x-python"
		onchange={openFile}
		class="sr-only"
		aria-hidden="true"
		tabindex="-1"
	/>
</article>
