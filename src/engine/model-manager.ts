import { spawn, ChildProcess } from 'child_process';
import { alignmentLogger } from '../logging/logger.js';

export class ModelManager {
  private flmProcess: ChildProcess | null = null;
  private readonly port = 52625;
  private readonly endpoint = `http://127.0.0.1:${this.port}/v1/models`;

  /**
   * Ping the FLM server to check if it's alive.
   */
  async ping(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 1000);

      const response = await fetch(this.endpoint, {
        method: 'GET',
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      return response.ok;
    } catch (_e) {
      return false;
    }
  }

  /**
   * Ensure the model is running. If not, start it and wait until ready.
   */
  async start(): Promise<void> {
    const isAlive = await this.ping();
    if (isAlive) {
      alignmentLogger.info('Local LLM is already running on port 52625.');
      return;
    }

    alignmentLogger.info('Local LLM is down. Starting FLM server...');

    this.flmProcess = spawn('flm', ['serve', 'deepseek-r1:8b'], {
      shell: true,
      detached: false,
      stdio: 'ignore', // VERY IMPORTANT: ignore stdout to prevent corrupting MCP stdio
    });

    this.flmProcess.on('error', (err) => {
      alignmentLogger.error(
        { error: err },
        'Failed to start FLM process. Is FLM installed and in PATH?'
      );
    });

    this.flmProcess.on('exit', (code) => {
      alignmentLogger.info({ code }, 'FLM process exited');
      this.flmProcess = null;
    });

    let attempts = 0;
    while (attempts < 60) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      const ready = await this.ping();
      if (ready) {
        alignmentLogger.info('Local LLM is online and ready.');
        return;
      }
      attempts++;
    }

    throw new Error(
      'Timed out waiting for FLM server to start. Check if FLM is installed correctly.'
    );
  }

  /**
   * Gracefully stop the FLM process if we started it.
   */
  stop(): void {
    if (this.flmProcess) {
      alignmentLogger.info('Stopping Local LLM server...');
      this.flmProcess.kill('SIGINT');
      this.flmProcess = null;
    }
  }
}
