import {Injectable} from '@nestjs/common';
import {fromEvent} from "rxjs";
import {EventEmitter} from "events";

@Injectable()
export class SSEService {
  readonly emitter: EventEmitter;
  constructor() {
    this.emitter = new EventEmitter();
  }

  subscribe(id: string) {
    return fromEvent(this.emitter, id);
  }

  async emit(id: string, data: Object) {
    return this.emitter.emit(id, {data});
  }
}