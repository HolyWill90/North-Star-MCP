/**
 * Custom error classes for North Star MCP
 */

export class NorthStarError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NorthStarError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends NorthStarError {
  constructor(
    message: string,
    public details?: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class StorageError extends NorthStarError {
  constructor(
    message: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'StorageError';
    if (cause) {
      this.stack = `${this.stack}\nCaused by: ${cause.stack}`;
    }
  }
}

export class LockError extends StorageError {
  constructor(message: string, cause?: Error) {
    super(message, cause);
    this.name = 'LockError';
  }
}

export class CorruptionError extends StorageError {
  constructor(
    message: string,
    public filePath: string,
    cause?: Error
  ) {
    super(message, cause);
    this.name = 'CorruptionError';
  }
}

export class AlignmentError extends NorthStarError {
  constructor(
    message: string,
    public score: number
  ) {
    super(message);
    this.name = 'AlignmentError';
  }
}

export class NotFoundError extends NorthStarError {
  constructor(resource: string) {
    super(`${resource} not found`);
    this.name = 'NotFoundError';
  }
}
