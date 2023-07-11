import { Vector3 } from "@fivemjs/shared";
import { VirtualEntity as SharedVirtualEntity } from "@fivemjs/shared";
import { CollisionSphere } from "../collision/CollisionSphere";
import { randomUUID } from "../uuid";
import { Resource } from "../resource";

export class VirtualEntity extends SharedVirtualEntity {
	readonly id = randomUUID();
	readonly collision: CollisionSphere;
	readonly streamingPlayers: Set<number> = new Set();
	readonly syncedMeta: Record<string, any>;
	_dimension: number = 0;

	constructor(VirtualEntityType: string, position: Vector3, streamingDistance: number, data?: Record<string, any>) {
		super(VirtualEntityType, position);
		const collision = new CollisionSphere(position, streamingDistance);
		collision.playersOnly = true;
		collision.onBeginOverlap(this.onEnterStreamingRange.bind(this));
		collision.onEndOverlap(this.onLeaveStreamingRange.bind(this));
		this.collision = collision;

		this.syncedMeta = data || {};
	}

    public destroy() {
        this.collision.destroy();
    }

	public get dimension(): number {
		return this._dimension;
	}

	public set dimension(value: number) {
		this._dimension = value;
		this.collision.dimension = value;
	}

	public setSyncedMeta(key: string, value: any) {
		this.syncedMeta[key] = value;
		for (const src of this.streamingPlayers) {
			Resource.emitClient(this.event.onVirtualEntitySyncedMetaChange, src, this.id, key, value);
		}
	}

	private getSyncData(): Record<string, any> {
		return {
			id: this.id,
			pos: this.pos,
			syncedMeta: this.syncedMeta,
		};
	}

	private onEnterStreamingRange(entity: number) {
		const src = NetworkGetEntityOwner(entity);
		this.streamingPlayers.add(src);
		const data = this.getSyncData();
		Resource.emitClient(this.event.onVirtualEntityStreamIn, src, data);
	}

	private onLeaveStreamingRange(entity: number) {
		const src = NetworkGetEntityOwner(entity);
		this.streamingPlayers.delete(src);
		const data = this.getSyncData();
		Resource.emitClient(this.event.onVirtualEntityStreamOut, src, data);
	}
}