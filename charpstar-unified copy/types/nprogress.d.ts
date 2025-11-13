declare module "nprogress" {
  interface NProgressOptions {
    minimum?: number;
    easing?: string;
    positionUsing?: string;
    speed?: number;
    trickle?: boolean;
    trickleSpeed?: number;
    showSpinner?: boolean;
    barSelector?: string;
    spinnerSelector?: string;
    parent?: string;
    template?: string;
  }

  interface NProgress {
    configure(options: NProgressOptions): NProgress;
    start(): NProgress;
    set(n: number): NProgress;
    isStarted(): boolean;
    done(force?: boolean): NProgress;
    remove(): void;
    status: number | null;
  }

  const nprogress: NProgress;
  export = nprogress;
}
