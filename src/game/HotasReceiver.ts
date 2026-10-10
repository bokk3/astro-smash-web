import { Peer, type DataConnection } from 'peerjs';

export interface HotasFrame {
  pitch: number;
  roll: number;
  throttle: number;
  fire: boolean;
  boost: boolean;
  rcsUp: boolean;
  rcsDown: boolean;
  rcsLeft: boolean;
  rcsRight: boolean;
  powerMode: number;
  sequenceNumber: number;
}

export class HotasReceiver {
  private peer: Peer | null = null;
  private connection: DataConnection | null = null;
  private roomCode: string = 'TACHYON-7492';
  private isConnected: boolean = false;
  private onFrameCallback: ((frame: HotasFrame) => void) | null = null;
  private onConnectionChangeCallback: ((connected: boolean) => void) | null = null;

  constructor(roomCode?: string) {
    if (roomCode) {
      this.roomCode = roomCode;
    }
    this.initPeer();
  }

  public getRoomCode(): string {
    return this.roomCode;
  }

  public getIsConnected(): boolean {
    return this.isConnected;
  }

  public onFrame(cb: (frame: HotasFrame) => void): void {
    this.onFrameCallback = cb;
  }

  public onConnectionChange(cb: (connected: boolean) => void): void {
    this.onConnectionChangeCallback = cb;
  }

  private initPeer(): void {
    try {
      // Create Peer with clean ID matching roomCode (lowercase sanitize)
      const peerId = `host-${this.roomCode.toLowerCase()}`;
      this.peer = new Peer(peerId, {
        debug: 1,
        config: {
          iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' }
          ]
        }
      });

      this.peer.on('open', (id) => {
        console.log('[HotasReceiver] Host Peer open with ID:', id);
      });

      this.peer.on('connection', (conn) => {
        console.log('[HotasReceiver] Incoming connection from Mobile HOTAS:', conn.peer);
        this.connection = conn;

        conn.on('open', () => {
          this.isConnected = true;
          if (this.onConnectionChangeCallback) this.onConnectionChangeCallback(true);
        });

        conn.on('data', (data: any) => {
          this.handleIncomingData(data);
        });

        conn.on('close', () => {
          this.isConnected = false;
          if (this.onConnectionChangeCallback) this.onConnectionChangeCallback(false);
        });

        conn.on('error', (err) => {
          console.error('[HotasReceiver] Connection error:', err);
          this.isConnected = false;
          if (this.onConnectionChangeCallback) this.onConnectionChangeCallback(false);
        });
      });

      this.peer.on('error', (err) => {
        console.warn('[HotasReceiver] Peer error (fallback active):', err);
      });
    } catch (e) {
      console.warn('[HotasReceiver] Failed to initialize PeerJS:', e);
    }
  }

  private handleIncomingData(data: any): void {
    if (data instanceof ArrayBuffer && data.byteLength === 16) {
      const floatView = new Float32Array(data);
      const uint8View = new Uint8Array(data);
      const uint16View = new Uint16Array(data);

      const pitch = floatView[0];
      const roll = floatView[1];
      const throttle = floatView[2];
      const bitmask = uint8View[12];
      const powerMode = uint8View[13];
      const sequenceNumber = uint16View[7];

      const frame: HotasFrame = {
        pitch,
        roll,
        throttle,
        fire: (bitmask & (1 << 0)) !== 0,
        boost: (bitmask & (1 << 1)) !== 0,
        rcsUp: (bitmask & (1 << 2)) !== 0,
        rcsDown: (bitmask & (1 << 3)) !== 0,
        rcsLeft: (bitmask & (1 << 4)) !== 0,
        rcsRight: (bitmask & (1 << 5)) !== 0,
        powerMode,
        sequenceNumber
      };

      if (this.onFrameCallback) {
        this.onFrameCallback(frame);
      }
    } else if (typeof data === 'object' && data !== null) {
      // JSON format support
      if (this.onFrameCallback) {
        this.onFrameCallback({
          pitch: data.pitch || 0,
          roll: data.roll || 0,
          throttle: data.throttle || 0,
          fire: !!data.fire,
          boost: !!data.boost,
          rcsUp: !!data.rcsUp,
          rcsDown: !!data.rcsDown,
          rcsLeft: !!data.rcsLeft,
          rcsRight: !!data.rcsRight,
          powerMode: data.powerMode || 0,
          sequenceNumber: data.sequenceNumber || 0
        });
      }
    }
  }

  public destroy(): void {
    if (this.connection) {
      this.connection.close();
      this.connection = null;
    }
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
  }
}
