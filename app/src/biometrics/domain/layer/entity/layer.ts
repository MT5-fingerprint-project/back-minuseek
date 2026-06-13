export type LayerType = 'ANNOTATION' | 'FILTER';

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

export type LayerSettings = { [key: string]: JsonValue };

export interface LayerPrimitives {
  id: string;
  fingerprintId: string;
  name: string;
  type: LayerType;
  zIndex: number;
  isVisible: boolean;
  settings: LayerSettings;
}

interface CreateLayerProps {
  id: string;
  fingerprintId: string;
  name: string;
  type: LayerType;
  zIndex: number;
  settings: LayerSettings;
}

export class Layer {
  private constructor(
    private readonly _id: string,
    private readonly _fingerprintId: string,
    private _name: string,
    private readonly _type: LayerType,
    private _zIndex: number,
    private _isVisible: boolean,
    private _settings: LayerSettings,
  ) {}

  static create(props: CreateLayerProps): Layer {
    return new Layer(
      props.id,
      props.fingerprintId,
      props.name,
      props.type,
      props.zIndex,
      true,
      props.settings,
    );
  }

  static reconstitute(primitives: LayerPrimitives): Layer {
    return new Layer(
      primitives.id,
      primitives.fingerprintId,
      primitives.name,
      primitives.type,
      primitives.zIndex,
      primitives.isVisible,
      primitives.settings,
    );
  }

  update(props: {
    name?: string;
    zIndex?: number;
    isVisible?: boolean;
    settings?: LayerSettings;
  }): void {
    if (props.name !== undefined) this._name = props.name;
    if (props.zIndex !== undefined) this._zIndex = props.zIndex;
    if (props.isVisible !== undefined) this._isVisible = props.isVisible;
    if (props.settings !== undefined) this._settings = props.settings;
  }

  toPrimitives(): LayerPrimitives {
    return {
      id: this._id,
      fingerprintId: this._fingerprintId,
      name: this._name,
      type: this._type,
      zIndex: this._zIndex,
      isVisible: this._isVisible,
      settings: this._settings,
    };
  }

  get id(): string {
    return this._id;
  }
  get fingerprintId(): string {
    return this._fingerprintId;
  }
}
