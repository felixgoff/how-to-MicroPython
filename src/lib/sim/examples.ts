/** Färdiga exempel som passar komponenterna i den simulerade kopplingen. */
export type Example = { id: string; title: string; code: string };

export const examples: Example[] = [
	{
		id: "blink",
		title: "Blinka",
		code: `from machine import Pin
import time

led = Pin(15, Pin.OUT)
lyser = False

while True:
    lyser = not lyser
    led.value(lyser)
    print("LED:", "pa" if lyser else "av")
    time.sleep(0.5)
`,
	},
	{
		id: "pwm",
		title: "Dimmer (PWM)",
		code: `from machine import Pin, PWM
import time

led = PWM(Pin(15))
led.freq(1000)

while True:
    # Tona upp och ner: 0 = slackt, 65535 = full styrka
    for duty in range(0, 65536, 1024):
        led.duty_u16(duty)
        time.sleep(0.01)
    for duty in range(65535, -1, -1024):
        led.duty_u16(duty)
        time.sleep(0.01)
`,
	},
	{
		id: "buzzer",
		title: "Melodi",
		code: `from machine import Pin, PWM
import time

buzzer = PWM(Pin(16))

# Frekvens i hertz – ju hogre tal, desto ljusare ton
melodi = [262, 294, 330, 349, 392, 440, 494, 523]

for ton in melodi:
    buzzer.freq(ton)
    buzzer.duty_u16(30000)   # Halvt oppen = ljud
    time.sleep(0.25)

buzzer.duty_u16(0)           # Tyst igen
print("Klart!")
`,
	},
	{
		id: "knapp",
		title: "Knapp",
		code: `from machine import Pin
import time

# Knappen kopplas mellan stiftet och GND. Med intern pull-up ligger
# stiftet hogt (1) tills knappen trycks ner, da blir det lagt (0).
knapp = Pin(13, Pin.IN, Pin.PULL_UP)
led = Pin(15, Pin.OUT)

while True:
    if knapp.value() == 0:
        led.on()
        print("Nedtryckt")
    else:
        led.off()
    time.sleep(0.1)
`,
	},
	{
		id: "trafikljus",
		title: "Tva lampor",
		code: `from machine import Pin
import time

# Tva lysdioder pa var sitt stift, som ett litet trafikljus
rod = Pin(15, Pin.OUT)
gron = Pin(14, Pin.OUT)

while True:
    gron.on()
    rod.off()
    print("Kor!")
    time.sleep(1)

    gron.off()
    rod.on()
    print("Stopp!")
    time.sleep(1)
`,
	},
];
