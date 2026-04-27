export interface Command {
  name: string;
  description: string;
  run: (ctx: Context, args: any) => Promise<void>;
}

export interface AuthService {
  get(service: string): Promise<string | null>;
  set(service: string, value: string): Promise<void>;
}

export interface StateService {
  get<T = unknown>(key: string): Promise<T | null>;
  set(key: string, value: unknown): Promise<void>;
  push(key: string, value: unknown): Promise<void>;
}

export interface Context {
  auth: AuthService;
  state: StateService;
  log: (msg: string) => void;
  debug: boolean;
}
