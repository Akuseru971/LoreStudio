export function concatMp3Buffers(buffers: Buffer[]) {
  const validBuffers = buffers.filter((buffer) => buffer.length > 0);
  if (validBuffers.length === 0) {
    throw new Error("No audio buffers to merge.");
  }

  return Buffer.concat(validBuffers);
}
