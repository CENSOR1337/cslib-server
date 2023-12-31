import { Vector3, EventContext } from "@cfx/server";
import { VirtualEntity as SharedVirtualEntity } from "@cfx-cslib/shared";
import { CollisionSphere } from "./CollisionSphere";
import { randomUUID } from "./utils/uuid";
import { Resource } from "./Resource";
import { Player } from "./Player";
import { Event } from "@cfx/server";
import * as cfx from "@cfx/server";

export class VirtualEntity extends SharedVirtualEntity {
	readonly id = randomUUID();
	readonly collision: CollisionSphere;
	readonly streamingPlayers: Set<number> = new Set();
	readonly syncedMeta: Record<string, any>;
	_dimension: number = 0;

	constructor(position: Vector3, streamingDistance: number, data?: Record<string, any>) {
		super(position);
		const collision = new CollisionSphere(position, streamingDistance);
		collision.playersOnly = true;
		collision.onBeginOverlap(this.onEnterStreamingRange.bind(this));
		collision.onEndOverlap(this.onLeaveStreamingRange.bind(this));
		this.collision = collision;

		this.syncedMeta = data || {};
		//Events.onPlayerDropped(this.onPlayerDisconnected.bind(this));
		Event.onPlayerDropped(this.onPlayerDisconnected.bind(this));
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
		if (!cfx.doesEntityExist(entity)) return;
		const src = NetworkGetEntityOwner(entity);
		this.streamingPlayers.delete(src);
		const data = this.getSyncData();
		Resource.emitClient(this.event.onVirtualEntityStreamOut, src, data);
	}

	private onPlayerDisconnected({ source, reason }: EventContext["onPlayerDropped"]) {
		if (!this.streamingPlayers.has(source)) return;
		this.streamingPlayers.delete(source);
	}
}
