<script lang="ts">
	import CpuIcon from "@lucide/svelte/icons/cpu";
	import ZapIcon from "@lucide/svelte/icons/zap";
	import WifiIcon from "@lucide/svelte/icons/wifi";
	import CableIcon from "@lucide/svelte/icons/cable";
	import LightbulbIcon from "@lucide/svelte/icons/lightbulb";
	import Pinout from "$lib/components/pinout.svelte";
	import CodeBlock from "$lib/components/code-block.svelte";
	import * as Card from "$lib/components/ui/card/index.js";
	import * as Alert from "$lib/components/ui/alert/index.js";
	import * as Kbd from "$lib/components/ui/kbd/index.js";
	import { Badge } from "$lib/components/ui/badge/index.js";
	import ArrowRightIcon from "@lucide/svelte/icons/arrow-right";
	import { componentGuides } from "$lib/data/components/index.js";

	const facts = [
		{ icon: CpuIcon, title: "RP2040-chip", text: "Dubbelkärnig ARM Cortex-M0+ på 133 MHz med 264 kB RAM och 2 MB flashminne." },
		{ icon: WifiIcon, title: "WiFi och Bluetooth", text: "Ett CYW43439-chip på kortet. Den inbyggda lampan styrs också av det." },
		{ icon: CableIcon, title: "Färdiglödda stift", text: "H:et i WH betyder headers – stiftlisterna sitter redan på, så kortet kan tryckas rakt ner i en kopplingsplatta." },
		{ icon: ZapIcon, title: "3,3 V logik", text: "Stiften tål inte 5 V – använd spänningsdelare för 5 V-signaler." },
	];

	const blink = `
from machine import Pin
import time

# På Pico WH sitter den inbyggda lampan på WiFi-chippet.
# Därför skriver man "LED" i stället för ett GPIO-nummer.
led = Pin("LED", Pin.OUT)

while True:
    led.toggle()      # Växla mellan av och på
    time.sleep(0.5)   # Vänta en halv sekund
`;

	const wifi = `
import network
import time

wlan = network.WLAN(network.STA_IF)
wlan.active(True)
wlan.connect("NATVERKETS_NAMN", "LOSENORD")

# Vänta tills kortet fått en IP-adress
while not wlan.isconnected():
    print("Ansluter...")
    time.sleep(1)

print("Ansluten! IP:", wlan.ifconfig()[0])
`;
</script>

{#snippet inlineCode(text: string)}
	<code class="bg-muted px-1 font-mono text-[0.9em] text-foreground">{text}</code>
{/snippet}

<article class="mx-auto flex w-full max-w-6xl flex-col gap-16 px-4 py-8 sm:px-8 sm:py-12">
	<header id="introduktion" class="flex scroll-mt-20 flex-col gap-4">
		<Badge variant="default" class="text-primary">Introduktion</Badge>
		<h1 class="text-3xl font-bold tracking-tight text-balance sm:text-5xl">Kom igång med Raspberry Pi Pico WH</h1>
		<p class="max-w-3xl text-lg text-pretty text-muted-foreground">
			Raspberry Pi Pico WH är en liten och billig mikrokontroller. Till skillnad från en vanlig Raspberry Pi kör den
			inget operativsystem – den kör ett enda program som styr lampor, läser av sensorer och visar data på skärmar.
			<strong class="text-foreground">W</strong> står för wireless (WiFi och Bluetooth) och
			<strong class="text-foreground">H</strong> för headers, alltså färdiglödda stiftlister. Vi programmerar den i
			<strong class="text-foreground">MicroPython</strong>, en version av Python gjord för små datorer.
		</p>
	</header>

	<section aria-labelledby="oversikt-rubrik" class="flex flex-col gap-6">
		<h2 id="oversikt-rubrik" class="text-2xl font-bold tracking-tight">Översikt</h2>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			{#each facts as fact (fact.title)}
				<li class="flex">
					<Card.Root size="sm" class="w-full">
						<Card.Header>
							<fact.icon class="mb-2 size-6 text-primary" aria-hidden="true" />
							<Card.Title class="text-sm">{fact.title}</Card.Title>
							<Card.Description>{fact.text}</Card.Description>
						</Card.Header>
					</Card.Root>
				</li>
			{/each}
		</ul>
		<p class="max-w-3xl">
			En mikrokontroller passar perfekt när något ska hända automatiskt i den fysiska världen: en lampa som tänds när det
			blir mörkt, en larmsignal när något kommer för nära eller en termometer som visar temperaturen på en skärm. Guiden går
			igenom sju sådana komponenter, och alla kopplas till Picons stift – så börja med att lära dig vad stiften gör.
		</p>
	</section>

	<section id="pinout" aria-labelledby="pinout-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="pinout-rubrik" class="text-2xl font-bold tracking-tight">Interaktiv pinout</h2>
			<p class="max-w-3xl text-muted-foreground">
				Pico WH har 40 stift, 20 på varje sida, med färdiglödda stiftlister. Hovra över eller klicka på ett stift för
				att se vad det kan användas till. Med tangentbordet: tabba till kortet och flytta med
				<Kbd.Group><Kbd.Root>↑</Kbd.Root><Kbd.Root>↓</Kbd.Root><Kbd.Root>←</Kbd.Root><Kbd.Root>→</Kbd.Root></Kbd.Group>.
			</p>
		</div>
		<Pinout />
	</section>

	<section id="kom-igang" aria-labelledby="kom-igang-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="kom-igang-rubrik" class="text-2xl font-bold tracking-tight">Snabbguide: MicroPython och Thonny</h2>
			<p class="max-w-3xl text-muted-foreground">
				Thonny är en enkel Python-editor som kan prata direkt med Picon. Så här får du igång ditt första program.
			</p>
		</div>

		<ol class="flex max-w-3xl flex-col gap-4">
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 1</Card.Description>
						<Card.Title>Installera Thonny</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Ladda ner och installera Thonny från
						<a href="https://thonny.org" class="font-medium text-primary underline underline-offset-4">thonny.org</a>.
						Det finns för Windows, macOS och Linux.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 2</Card.Description>
						<Card.Title>Anslut Picon i BOOTSEL-läge</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Håll in den vita <strong class="text-foreground">BOOTSEL</strong>-knappen på kortet medan du kopplar in
						micro-USB-kabeln. Släpp knappen – Picon dyker upp som en USB-enhet som heter {@render inlineCode("RPI-RP2")}. Det
						här behövs bara första gången.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 3</Card.Description>
						<Card.Title>Installera MicroPython</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Klicka på tolk-väljaren längst ned till höger i Thonny och välj
						<strong class="text-foreground">Configure interpreter… → Install or update MicroPython</strong>. Välj
						varianten <em>Raspberry Pi Pico W / Pico WH</em> – den innehåller drivrutinen för WiFi-chippet, som också
						styr den inbyggda lampan. Klicka sedan <strong class="text-foreground">Install</strong>.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 4</Card.Description>
						<Card.Title>Välj tolk</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Välj <strong class="text-foreground">MicroPython (Raspberry Pi Pico)</strong> i samma meny – samma val
						gäller för Pico WH. I skalet (Shell)
						längst ned ska du nu se {@render inlineCode(">>>")} – då är Picon redo. Testa att skriva
						{@render inlineCode('print("Hej!")')}.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 5</Card.Description>
						<Card.Title>Kör ditt första program</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col gap-4 text-muted-foreground">
						<p>
							Klistra in koden nedan och tryck på den gröna <strong class="text-foreground">Run</strong>-knappen
							(<Kbd.Root>F5</Kbd.Root>). Lampan på kortet börjar blinka.
						</p>
						<CodeBlock code={blink} filename="main.py" />
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 6</Card.Description>
						<Card.Title>Spara på Picon</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Välj <strong class="text-foreground">File → Save as… → Raspberry Pi Pico</strong> och döp filen till
						{@render inlineCode("main.py")}. Då startar programmet automatiskt varje gång Picon får ström – även utan
						dator.
					</Card.Content>
				</Card.Root>
			</li>
		</ol>

		<Alert.Root role="note" class="max-w-3xl">
			<LightbulbIcon />
			<Alert.Title>Tips vid problem</Alert.Title>
			<Alert.Description>
				<ul class="list-disc pl-5">
					<li>Syns ingen enhet? Prova en annan USB-kabel – vissa kablar klarar bara laddning, inte data.</li>
					<li>Står det att enheten är upptagen? Tryck på den röda Stop-knappen i Thonny och försök igen.</li>
					<li>Koppla alltid bort strömmen innan du ändrar något på kopplingsplattan.</li>
				</ul>
			</Alert.Description>
		</Alert.Root>
	</section>

	<section id="wifi" aria-labelledby="wifi-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="wifi-rubrik" class="text-2xl font-bold tracking-tight">WiFi på Pico WH</h2>
			<p class="max-w-3xl text-muted-foreground">
				Det är WiFi-chippet som skiljer en Pico WH från en vanlig Pico. Med modulen
				{@render inlineCode("network")} kopplar kortet upp sig mot skolans eller hemmets nät, och kan sedan skicka
				sensorvärden vidare eller hämta data från internet. Kortet klarar bara 2,4 GHz-nät.
			</p>
		</div>

		<div class="max-w-3xl">
			<CodeBlock code={wifi} filename="wifi.py" />
		</div>

		<Alert.Root role="note" class="max-w-3xl">
			<WifiIcon />
			<Alert.Title>Kör bara på ett riktigt kort</Alert.Title>
			<Alert.Description>
				WiFi-chippet finns inte i simulatorn i kodlabbet – den härmar bara RP2040:an. Koden ovan behöver alltså en
				riktig Pico WH. Samma sak gäller den inbyggda lampan, som ju styrs av WiFi-chippet.
			</Alert.Description>
		</Alert.Root>
	</section>

	<section id="komponenter" aria-labelledby="komponenter-rubrik" class="flex scroll-mt-20 flex-col gap-6">
		<div class="flex flex-col gap-2">
			<h2 id="komponenter-rubrik" class="text-2xl font-bold tracking-tight">Komponenterna</h2>
			<p class="max-w-3xl text-muted-foreground">
				Varje komponent har en egen sida med en animerad kopplingsguide, färdig kod, vanliga fel och en simulator där du
				kan testa koden direkt.
			</p>
		</div>
		<ul class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each componentGuides as guide, i (guide.slug)}
				<li class="flex">
					<a
						href={`#/komponent/${guide.slug}`}
						class="group flex w-full flex-col gap-3 border bg-card p-5 transition-colors outline-none hover:bg-muted/50 focus-visible:ring-3 focus-visible:ring-ring"
					>
						<span class="font-mono text-xs text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
						<span class="flex items-center justify-between gap-2 font-semibold">
							{guide.title}
							<ArrowRightIcon
								class="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1"
								aria-hidden="true"
							/>
						</span>
						<span class="text-sm text-pretty text-muted-foreground">{guide.tagline}</span>
						<span class="mt-auto flex flex-wrap gap-3 pt-1">
							{#each guide.tags as tag (tag)}
								<Badge variant="outline">{tag}</Badge>
							{/each}
						</span>
					</a>
				</li>
			{/each}
		</ul>
	</section>
</article>
