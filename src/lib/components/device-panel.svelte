<script lang="ts">
	import PlayIcon from "@lucide/svelte/icons/play";
	import SquareIcon from "@lucide/svelte/icons/square";
	import RotateCcwIcon from "@lucide/svelte/icons/rotate-ccw";
	import UsbIcon from "@lucide/svelte/icons/usb";
	import SaveIcon from "@lucide/svelte/icons/save";
	import TriangleAlertIcon from "@lucide/svelte/icons/triangle-alert";
	import CircleHelpIcon from "@lucide/svelte/icons/circle-help";
	import SerialConsole from "$lib/components/serial-console.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import { Button } from "$lib/components/ui/button/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import { PicoDevice } from "$lib/device/pico-device.svelte.js";
	import { openGuide } from "$lib/lab.js";

	/** Koden som skickas till kortet – oftast det som står i editorn just nu */
	let { code }: { code: string } = $props();

	const device = new PicoDevice();

	// Släpp USB-porten när man lämnar sidan. Annars förblir den upptagen och
	// nästa sida kan inte ansluta till kortet.
	$effect(() => () => void device.disconnect());
</script>

{#if !PicoDevice.supported}
	<Alert.Root role="note">
		<TriangleAlertIcon />
		<Alert.Title>Webbläsaren stöder inte USB-anslutning</Alert.Title>
		<Alert.Description>
			Web Serial finns i Chrome och Edge på dator. I andra webbläsare fungerar simulatorn och nerladdningen som vanligt –
			öppna sidan i Chrome eller Edge när du vill köra koden på ett riktigt kort.
		</Alert.Description>
	</Alert.Root>
{:else}
	<div class="flex flex-col gap-4">
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

		{#if device.activity}
			<p class="text-sm text-muted-foreground" aria-live="polite">{device.activity}</p>
		{/if}

		{#if device.noPortFound && !device.connected}
			<Alert.Root role="status">
				<CircleHelpIcon />
				<Alert.Title>
					{device.triedAllPorts ? "Datorn ser ingen seriell enhet från kortet" : "Hittade inget kort i listan"}
				</Alert.Title>
				<Alert.Description>
					<div class="flex flex-col gap-3">
						<p>
							Kortet måste visa sig som en seriell port för att webbläsaren ska kunna prata med det. Gå igenom i den
							här ordningen:
						</p>
						<ol class="list-decimal space-y-2 pl-5">
							<li>
								<strong class="text-foreground">Har kortet MicroPython?</strong> Ett nytt kort har det inte. Varje
								kortmodell behöver sin egen fil: <strong class="text-foreground">Pico 2 behöver RPI_PICO2</strong>
								(eller RPI_PICO2_W med WiFi) – filen för Pico W fungerar inte på Pico 2. Se steg 2 i
								<a href="#/" onclick={openGuide} class="font-medium text-primary underline underline-offset-4">Kom igång</a>.
							</li>
							<li>
								<strong class="text-foreground">Står kortet i startläge?</strong> Syns en enhet som
								<span class="font-mono">RPI-RP2</span> eller <span class="font-mono">RP2350</span> i Utforskaren har
								kortet ingen seriell port. Dra ur USB-sladden och sätt i den igen <em>utan</em> att hålla in BOOTSEL.
							</li>
							<li>
								<strong class="text-foreground">Klarar sladden data?</strong> Vissa USB-sladdar laddar bara. Prova
								en annan.
							</li>
							<li>
								<strong class="text-foreground">Kör kortet ett annat program?</strong> Ett program som inte
								använder USB-serieporten (till exempel C++ eller CircuitPython) syns inte som en MicroPython-enhet.
							</li>
						</ol>
						{#if !device.triedAllPorts}
							<div class="flex flex-col items-start gap-2">
								<p>
									Vill du se om datorn alls hittar något? Visa alla seriella enheter, inte bara Raspberry Pi-kort.
								</p>
								<Button variant="outline" size="sm" onclick={() => device.connect({ all: true })}>
									Visa alla seriella enheter
								</Button>
							</div>
						{:else}
							<p>
								Syns kortet nu i listan (till exempel som <span class="font-mono">USB-seriell enhet</span>) fungerar
								anslutningen – välj det. Syns det inte ens här är det punkt 1–3 ovan som gäller.
							</p>
						{/if}
					</div>
				</Alert.Description>
			</Alert.Root>
		{/if}

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
	</div>
{/if}
