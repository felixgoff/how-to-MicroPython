export type PinKind = "gpio" | "gnd" | "power" | "system";

export type Pin = {
	/** Fysiskt stiftnummer på kortet (1–40) */
	number: number;
	name: string;
	kind: PinKind;
	/** GPIO-nummer, om stiftet är ett GPIO */
	gpio?: number;
	adc?: string;
	i2c?: string[];
	spi?: string[];
	uart?: string[];
	description?: string;
};

export type Category = "gpio" | "gnd" | "power" | "adc" | "i2c" | "pwm" | "system";

export const categories: { id: Category; label: string; description: string }[] = [
	{
		id: "gpio",
		label: "GPIO",
		description:
			"General Purpose Input/Output – stift som kan styras från koden, antingen som utgång (t.ex. tända en LED) eller ingång (t.ex. läsa en knapp). Logiknivån är 3,3 V.",
	},
	{
		id: "gnd",
		label: "GND",
		description: "Jord (0 V). Alla komponenter måste ha gemensam jord med Picon för att kretsen ska fungera.",
	},
	{
		id: "power",
		label: "Ström",
		description:
			"Matningsstift. 3V3 ger 3,3 V till sensorer, VBUS är 5 V direkt från USB och VSYS är kortets huvudmatning (1,8–5,5 V).",
	},
	{
		id: "adc",
		label: "ADC",
		description:
			"Analog-till-digital-omvandlare. Läser en spänning mellan 0 och 3,3 V och ger ett värde mellan 0 och 65535 med read_u16(). Används t.ex. för LDR och jordfuktighetssensorer. På Pico WH finns tre analoga stift på kanten (ADC0–ADC2); ADC3 sitter inne i kortet och delas med WiFi-chippet.",
	},
	{
		id: "i2c",
		label: "I2C",
		description:
			"Tvåtrådsbuss (SDA = data, SCL = klocka) för att prata med t.ex. OLED-skärmar. Picon har två I2C-bussar, I2C0 och I2C1, som kan läggas på flera olika stiftpar.",
	},
	{
		id: "pwm",
		label: "PWM",
		description:
			"Pulsbreddsmodulering – slår av och på signalen snabbt för att simulera en lägre spänning (dimma en LED) eller skapa en frekvens (toner i en buzzer). Alla GPIO-stift kan ge PWM.",
	},
	{
		id: "system",
		label: "Övrigt",
		description: "Systemstift som styr kortet självt, t.ex. omstart (RUN) och referensspänning för ADC.",
	},
];

function gp(number: number, gpio: number, extra: Partial<Pin> = {}): Pin {
	return { number, name: `GP${gpio}`, kind: "gpio", gpio, ...extra };
}

function gnd(number: number): Pin {
	return { number, name: "GND", kind: "gnd", description: "Jord, 0 V." };
}

/** Vänster sida uppifrån och ned (stift 1–20), USB-kontakten uppåt. */
export const leftPins: Pin[] = [
	gp(1, 0, { i2c: ["I2C0 SDA"], spi: ["SPI0 RX"], uart: ["UART0 TX"] }),
	gp(2, 1, { i2c: ["I2C0 SCL"], spi: ["SPI0 CSn"], uart: ["UART0 RX"] }),
	gnd(3),
	gp(4, 2, { i2c: ["I2C1 SDA"], spi: ["SPI0 SCK"] }),
	gp(5, 3, { i2c: ["I2C1 SCL"], spi: ["SPI0 TX"] }),
	gp(6, 4, { i2c: ["I2C0 SDA"], spi: ["SPI0 RX"], uart: ["UART1 TX"] }),
	gp(7, 5, { i2c: ["I2C0 SCL"], spi: ["SPI0 CSn"], uart: ["UART1 RX"] }),
	gnd(8),
	gp(9, 6, { i2c: ["I2C1 SDA"], spi: ["SPI0 SCK"] }),
	gp(10, 7, { i2c: ["I2C1 SCL"], spi: ["SPI0 TX"] }),
	gp(11, 8, { i2c: ["I2C0 SDA"], spi: ["SPI1 RX"], uart: ["UART1 TX"] }),
	gp(12, 9, { i2c: ["I2C0 SCL"], spi: ["SPI1 CSn"], uart: ["UART1 RX"] }),
	gnd(13),
	gp(14, 10, { i2c: ["I2C1 SDA"], spi: ["SPI1 SCK"] }),
	gp(15, 11, { i2c: ["I2C1 SCL"], spi: ["SPI1 TX"] }),
	gp(16, 12, { i2c: ["I2C0 SDA"], spi: ["SPI1 RX"], uart: ["UART0 TX"] }),
	gp(17, 13, { i2c: ["I2C0 SCL"], spi: ["SPI1 CSn"], uart: ["UART0 RX"] }),
	gnd(18),
	gp(19, 14, { i2c: ["I2C1 SDA"], spi: ["SPI1 SCK"] }),
	gp(20, 15, { i2c: ["I2C1 SCL"], spi: ["SPI1 TX"] }),
];

/** Höger sida uppifrån och ned (stift 40–21), USB-kontakten uppåt. */
export const rightPins: Pin[] = [
	{ number: 40, name: "VBUS", kind: "power", description: "5 V direkt från USB-kontakten. Bra för komponenter som kräver 5 V, t.ex. HC-SR04." },
	{ number: 39, name: "VSYS", kind: "power", description: "Kortets huvudmatning, 1,8–5,5 V. Här kan du ansluta batterier." },
	gnd(38),
	{ number: 37, name: "3V3_EN", kind: "system", description: "Kopplas till GND för att stänga av 3,3 V-regulatorn. Lämna okopplad." },
	{ number: 36, name: "3V3(OUT)", kind: "power", description: "3,3 V ut till sensorer och moduler. Max ca 300 mA totalt." },
	{ number: 35, name: "ADC_VREF", kind: "system", description: "Referensspänning för ADC. Används sällan – lämna okopplad." },
	gp(34, 28, { adc: "ADC2" }),
	{ number: 33, name: "AGND", kind: "gnd", description: "Analog jord. Används med ADC-stiften för lägre brus, men fungerar som vanlig GND." },
	gp(32, 27, { adc: "ADC1", i2c: ["I2C1 SCL"] }),
	gp(31, 26, { adc: "ADC0", i2c: ["I2C1 SDA"] }),
	{ number: 30, name: "RUN", kind: "system", description: "Koppla till GND för att starta om Picon. Kan användas som reset-knapp." },
	gp(29, 22),
	gnd(28),
	gp(27, 21, { i2c: ["I2C0 SCL"] }),
	gp(26, 20, { i2c: ["I2C0 SDA"] }),
	gp(25, 19, { i2c: ["I2C1 SCL"], spi: ["SPI0 TX"] }),
	gp(24, 18, { i2c: ["I2C1 SDA"], spi: ["SPI0 SCK"] }),
	gnd(23),
	gp(22, 17, { i2c: ["I2C0 SCL"], spi: ["SPI0 CSn"], uart: ["UART0 RX"] }),
	gp(21, 16, { i2c: ["I2C0 SDA"], spi: ["SPI0 RX"], uart: ["UART0 TX"] }),
];

/**
 * Fyra GPIO-stift går inte ut till kanten på ett Pico WH – de är kopplade till
 * WiFi- och Bluetooth-chippet (CYW43439) inuti kortet. Bra att känna till, för
 * de dyker upp i felsökning och i andras kodexempel.
 */
export const internalPins = [
	{ name: "GP23", description: "Slår på det trådlösa chippet (WL_ON)." },
	{ name: "GP24", description: "Datalinje till det trådlösa chippet." },
	{
		name: "GP25",
		description:
			"Chip select till det trådlösa chippet. På en Pico utan WiFi sitter den inbyggda lampan här – på Pico WH styrs lampan i stället av WiFi-chippet, via Pin(\"LED\").",
	},
	{
		name: "GP29",
		description: "Klocka till det trådlösa chippet, och ADC3 som mäter matningsspänningen VSYS.",
	},
];

/** PWM-kanal för ett GPIO, t.ex. GP15 → "PWM7 B". */
export function pwmChannel(gpio: number): string {
	return `PWM${(gpio >> 1) & 7} ${gpio % 2 === 0 ? "A" : "B"}`;
}

export function pinCategories(pin: Pin): Category[] {
	const result: Category[] = [];
	if (pin.kind === "gpio") result.push("gpio", "pwm");
	if (pin.kind === "gnd") result.push("gnd");
	if (pin.kind === "power") result.push("power");
	if (pin.kind === "system") result.push("system");
	if (pin.adc) result.push("adc");
	if (pin.i2c) result.push("i2c");
	return result;
}
