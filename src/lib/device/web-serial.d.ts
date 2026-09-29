// Minimala typer för Web Serial API (finns ännu inte i TypeScripts DOM-typer).
interface SerialPort {
	readonly readable: ReadableStream<Uint8Array> | null;
	readonly writable: WritableStream<Uint8Array> | null;
	open(options: { baudRate: number }): Promise<void>;
	close(): Promise<void>;
	getInfo(): { usbVendorId?: number; usbProductId?: number };
}

interface Serial {
	requestPort(options?: { filters?: { usbVendorId?: number; usbProductId?: number }[] }): Promise<SerialPort>;
	getPorts(): Promise<SerialPort[]>;
}

interface Navigator {
	readonly serial?: Serial;
}
