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
	import FlaskConicalIcon from "@lucide/svelte/icons/flask-conical";
	import { Button } from "$lib/components/ui/button/index.js";
	import { componentGuides } from "$lib/data/components/index.js";
	import { examples } from "$lib/sim/examples.js";
	import { openInLab } from "$lib/lab.js";

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
			<h2 id="kom-igang-rubrik" class="text-2xl font-bold tracking-tight">Snabbguide: Kom igång med Kodlabbet</h2>
			<p class="max-w-3xl text-muted-foreground">
				Kodlabbet är sidans egen kodeditor. Där testar du koden i en simulerad Pico WH, och skickar den sedan till ett
				riktigt kort via USB – direkt från webbläsaren, utan att installera något program.
			</p>
		</div>

		<ol class="flex max-w-3xl flex-col gap-4">
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 1</Card.Description>
						<Card.Title>Testa utan kort</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col items-start gap-4 text-muted-foreground">
						<p>
							Öppna Kodlabbet och tryck på <strong class="text-foreground">Kör</strong>. MicroPython startar i en
							simulerad Pico WH och lysdioden på GP15 börjar blinka. Allt händer i webbläsaren, så du kan prova redan
							innan du har ett kort framför dig.
						</p>
						<Button onclick={() => openInLab(examples[0].code)} size="sm">
							<FlaskConicalIcon />
							Öppna Kodlabbet
						</Button>
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 2</Card.Description>
						<Card.Title>Installera MicroPython på Picon</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col gap-3 text-muted-foreground">
						<p>
							Ett nytt kort har inget MicroPython. Håll in den vita <strong class="text-foreground">BOOTSEL</strong>-knappen
							medan du kopplar in micro-USB-sladden, och släpp den sedan. Picon dyker upp som en USB-enhet, som en
							USB-sticka.
						</p>
						<p>
							Ladda ner rätt {@render inlineCode(".uf2")}-fil för <strong class="text-foreground">just din modell</strong>
							och dra den till enheten. Picon startar om och enheten försvinner – då är MicroPython installerat. Det här
							behövs bara en gång per kort.
						</p>
						<div class="overflow-x-auto border">
							<table class="w-full text-left text-sm">
								<thead class="bg-muted/50 text-foreground">
									<tr>
										<th scope="col" class="px-3 py-2 font-semibold">Ditt kort</th>
										<th scope="col" class="px-3 py-2 font-semibold">Ladda ner</th>
										<th scope="col" class="px-3 py-2 font-semibold">Enheten heter</th>
									</tr>
								</thead>
								<tbody>
									{#each [
										{ board: "Pico W / Pico WH", id: "RPI_PICO_W", drive: "RPI-RP2" },
										{ board: "Pico 2 W", id: "RPI_PICO2_W", drive: "RP2350" },
										{ board: "Pico 2", id: "RPI_PICO2", drive: "RP2350" },
									] as row (row.id)}
										<tr class="border-t">
											<th scope="row" class="px-3 py-2 font-medium text-foreground">{row.board}</th>
											<td class="px-3 py-2">
												<a
													href={`https://micropython.org/download/${row.id}/`}
													class="font-mono text-primary underline underline-offset-4">{row.id}</a
												>
											</td>
											<td class="px-3 py-2 font-mono">{row.drive}</td>
										</tr>
									{/each}
								</tbody>
							</table>
						</div>
						<p>
							Välj en fil med <strong class="text-foreground">W</strong> i namnet om kortet har WiFi – bara den har
							drivrutinen för WiFi-chippet, som också styr den inbyggda lampan. Filerna är inte utbytbara mellan Pico och
							Pico 2: de har olika processorer, och Pico 2 tar inte emot en fil som byggts för Pico.
						</p>
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 3</Card.Description>
						<Card.Title>Använd Chrome eller Edge</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Kodlabbet pratar med kortet via Web Serial, som bara finns i Chrome och Edge på dator. I andra webbläsare
						fungerar simulatorn som vanligt, men inte ett riktigt kort.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 4</Card.Description>
						<Card.Title>Anslut kortet</Card.Title>
					</Card.Header>
					<Card.Content class="text-muted-foreground">
						Längst ned i Kodlabbet, under <strong class="text-foreground">Kör på en riktig Pico WH</strong>, trycker du på
						<strong class="text-foreground">Anslut Pico WH</strong>. Webbläsaren visar en lista där bara Pico-kort finns
						med – välj ditt och tryck på Anslut. När kortet är anslutet syns allt det skriver ut i konsolen under knapparna.
					</Card.Content>
				</Card.Root>
			</li>
			<li>
				<Card.Root size="sm">
					<Card.Header>
						<Card.Description>Steg 5</Card.Description>
						<Card.Title>Kör ditt första program på kortet</Card.Title>
					</Card.Header>
					<Card.Content class="flex flex-col items-start gap-4 text-muted-foreground">
						<p>
							Öppna koden nedan i Kodlabbet och tryck på <strong class="text-foreground">Kör på Picon</strong>. Lampan på
							kortet börjar blinka. Den inbyggda lampan styrs av WiFi-chippet, så den syns bara på ett riktigt kort –
							inte i simulatorn.
						</p>
						<div class="w-full">
							<CodeBlock code={blink} filename="main.py" />
						</div>
						<Button onclick={() => openInLab(blink)} variant="outline" size="sm">
							<FlaskConicalIcon />
							Öppna i Kodlabbet
						</Button>
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
						Tryck på <strong class="text-foreground">Spara som main.py</strong>. Då ligger koden kvar på kortet och
						startar av sig själv varje gång Picon får ström – även utan dator. Med
						<strong class="text-foreground">Avbryt</strong> stoppar du programmet och med
						<strong class="text-foreground">Starta om</strong> startar kortet om.
					</Card.Content>
				</Card.Root>
			</li>
		</ol>

		<Alert.Root role="note" class="max-w-3xl">
			<LightbulbIcon />
			<Alert.Title>Tips vid problem</Alert.Title>
			<Alert.Description>
				<ul class="list-disc pl-5">
					<li>
						Visas inget kort i listan? Prova en annan USB-sladd – vissa klarar bara laddning, inte data. Kontrollera också
						att MicroPython är installerat (steg 2).
					</li>
					<li>
						Går kortet inte att ansluta? Ett annat program eller en annan flik använder det redan. Stäng det och försök
						igen.
					</li>
					<li>Koppla alltid bort USB-sladden innan du ändrar något på kopplingsdäcket.</li>
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

		<div class="flex max-w-3xl flex-col items-start gap-4">
			<div class="w-full">
				<CodeBlock code={wifi} filename="wifi.py" />
			</div>
			<Button onclick={() => openInLab(wifi)} variant="outline" size="sm">
				<FlaskConicalIcon />
				Öppna i Kodlabbet
			</Button>
		</div>

		<Alert.Root role="note" class="max-w-3xl">
			<WifiIcon />
			<Alert.Title>Kör bara på ett riktigt kort</Alert.Title>
			<Alert.Description>
				WiFi-chippet finns inte i Kodlabbets simulator – den härmar bara RP2040:an. Ändra nätverkets namn och lösenord,
				anslut en Pico WH och tryck på Kör på Picon. Samma sak gäller den inbyggda lampan, som ju styrs av WiFi-chippet.
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
