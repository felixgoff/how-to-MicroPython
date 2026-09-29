/**
 * Förberedelser som körs på det emulerade kortet innan elevens kod.
 *
 * Emulatorn kan inte skriva till kortets flashminne, så MicroPython får inget
 * filsystem när det startar. Vi monterar i stället ett filsystem i RAM – samma
 * teknik som MicroPythons dokumentation visar för egna lagringsenheter. Då går
 * det att spara filer och importera drivrutiner, precis som på ett riktigt kort.
 */
export const RAM_FILESYSTEM = `import os
class RAMBlockDev:
    def __init__(self, block_size, num_blocks):
        self.block_size = block_size
        self.data = bytearray(block_size * num_blocks)
    def readblocks(self, block, buf, offset=0):
        start = block * self.block_size + offset
        buf[:] = self.data[start:start + len(buf)]
    def writeblocks(self, block, buf, offset=0):
        start = block * self.block_size + offset
        self.data[start:start + len(buf)] = buf
    def ioctl(self, op, arg):
        if op == 4:
            return len(self.data) // self.block_size
        if op == 5:
            return self.block_size
        if op == 6:
            return 0
_bdev = RAMBlockDev(512, 96)
os.VfsLfs2.mkfs(_bdev)
os.mount(os.VfsLfs2(_bdev), '/')
del RAMBlockDev, _bdev
`;

function toBase64(text: string) {
	let binary = "";
	for (const byte of new TextEncoder().encode(text)) binary += String.fromCharCode(byte);
	return btoa(binary);
}

/** Python-kod som skriver en fil på kortet. Innehållet skickas som base64 så att åäö och \ klarar resan. */
export function writeFileScript(name: string, content: string) {
	return `import ubinascii
with open('${name}', 'wb') as f:
    f.write(ubinascii.a2b_base64('${toBase64(content)}'))
`;
}
