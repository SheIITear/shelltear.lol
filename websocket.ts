import { EventEmitter } from "events";
import { Socket } from "net";

// based on:
//        - https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API/Writing_WebSocket_servers

export class WebSocket extends EventEmitter {
  private socket: Socket;
  private buffer: Buffer;

  constructor(socket: Socket) {
    super();
    this.socket = socket;
    this.buffer = Buffer.alloc(0);

    this.socket.on("data", (data: Buffer) => {
      (data.length === 6 || data.length > 200) ? this.handleEnd() : this.handleData(data); // we dont want to handle too big messages as those can be used to dos and we only need one number
                                                                                           // 6 is for empty messages, need to make a better way to handle them, than just ignoring
    });
    this.socket.on("end", () => this.handleEnd());
  }

  private readUInt16(data: Buffer, offset: number): number {
    return data.readUInt16BE(offset);
  }

  private readUInt64(data: Buffer, offset: number): bigint {
    return data.readBigUInt64BE(offset);
  }

  private readMaskingKey(data: Buffer, offset: number): Buffer {
    return data.slice(offset, offset + 4);
  }

  private decodePayload(
    data: Buffer,
    offset: number,
    length: number,
    maskingKey?: Buffer
  ): string {
    const decodedData = Buffer.alloc(length);

    for (let i = 0; i < length; i++) {
      const maskedByte = maskingKey
        ? data[offset + i] ^ maskingKey[i % 4]
        : data[offset + i];
      decodedData.writeUInt8(maskedByte, i);
    }

    return decodedData.toString("utf-8");
  }

  private handleData(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data]);

    while (this.buffer.length >= 2) {
      const secondByte = this.buffer.readUInt8(1);

      const isMasked = (secondByte & 0b10000000) !== 0;
      let payloadLength = secondByte & 0b01111111;

      let offset = 2;

      if (payloadLength === 126) {
        if (this.buffer.length < offset + 2) return;
        payloadLength = this.readUInt16(this.buffer, offset);
        offset += 2;
      } else if (payloadLength === 127) {
        if (this.buffer.length < offset + 8) return;
        payloadLength = Number(this.readUInt64(this.buffer, offset));
        offset += 8;
      }

      let maskingKey;
      if (isMasked) {
        if (this.buffer.length < offset + 4) return;
        maskingKey = this.readMaskingKey(this.buffer, offset);
        offset += 4;
      }

      if (this.buffer.length < offset + payloadLength) return;

      const payload = this.decodePayload(
        this.buffer,
        offset,
        payloadLength,
        maskingKey
      );
      offset += payloadLength;

      this.emit("message", payload);

      this.buffer = this.buffer.slice(offset);
    }
  }

  private handleEnd() {
    this.emit("close");
    this.socket.end();
  }

  public send(data: string) {
    const opcode = 0x81; // meaans that the frames are supposed to be merged in client side
    const payload = Buffer.from(data, "utf-8");

    const chunkSize = 125; // bigger will fail
    for (let i = 0; i < payload.length; i += chunkSize) {
      const frame = Buffer.alloc(Math.min(chunkSize, payload.length - i) + 2);
      const isFinalFrame = i + chunkSize >= payload.length;

      frame.writeUInt8(opcode | (isFinalFrame ? 0x80 : 0), 0); // 0x80 marks the final frame || if frame < 125
      frame.writeUInt8(frame.length - 2, 1);

      payload.copy(frame, 2, i, i + frame.length - 2);

      this.socket.write(frame);
    }
  }
}
export { Socket }; // so we dont need to import it again in the main file
