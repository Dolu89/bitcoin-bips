export interface PluginContract {
    name: string;
    enable: boolean;
    start(): Promise<void>;
    schedule(): Promise<void>;
}