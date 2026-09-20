const encode = (value: string) => new TextEncoder().encode(value);

function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** Standard ZIP STORE records, UTF-8 names, CRC-32; no runtime or network dependency. */
export function zip(files: Array<{ name: string; content: string }>): Uint8Array {
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const file of files) {
    const name = encode(file.name);
    const bytes = encode(file.content);
    const checksum = crc32(bytes);
    const local = new Uint8Array(30 + name.length);
    const view = new DataView(local.buffer);
    view.setUint32(0, 0x04034b50, true); view.setUint16(4, 20, true); view.setUint16(6, 0x0800, true);
    view.setUint16(12, 33, true); view.setUint32(14, checksum, true); view.setUint32(18, bytes.length, true); view.setUint32(22, bytes.length, true); view.setUint16(26, name.length, true);
    local.set(name, 30);
    const directory = new Uint8Array(46 + name.length);
    const directoryView = new DataView(directory.buffer);
    directoryView.setUint32(0, 0x02014b50, true); directoryView.setUint16(4, 20, true); directoryView.setUint16(6, 20, true); directoryView.setUint16(8, 0x0800, true);
    directoryView.setUint16(14, 33, true); directoryView.setUint32(16, checksum, true); directoryView.setUint32(20, bytes.length, true); directoryView.setUint32(24, bytes.length, true); directoryView.setUint16(28, name.length, true); directoryView.setUint32(42, offset, true);
    directory.set(name, 46);
    parts.push(local, bytes); central.push(directory);
    offset += local.length + bytes.length;
  }
  const centralSize = central.reduce((total, part) => total + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  endView.setUint32(0, 0x06054b50, true); endView.setUint16(8, files.length, true); endView.setUint16(10, files.length, true); endView.setUint32(12, centralSize, true); endView.setUint32(16, offset, true);
  const result = new Uint8Array(offset + centralSize + end.length);
  let cursor = 0;
  for (const part of [...parts, ...central, end]) { result.set(part, cursor); cursor += part.length; }
  return result;
}
