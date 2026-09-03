import { describe, expect, it } from "vitest";

import { AsyncSerialQueue } from "../../src/application/async-serial-queue.js";

describe("AsyncSerialQueue", () => {
  it("runs overlapping asynchronous operations in submission order", async () => {
    const queue = new AsyncSerialQueue();
    const executionOrder: string[] = [];

    let releaseFirst!: () => void;

    const firstCanFinish = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });

    const first = queue.run(async () => {
      executionOrder.push("first-started");
      await firstCanFinish;
      executionOrder.push("first-finished");
    });

    const second = queue.run(async () => {
      executionOrder.push("second-started");
      executionOrder.push("second-finished");
    });

    await Promise.resolve();

    expect(executionOrder).toEqual(["first-started"]);

    releaseFirst();

    await Promise.all([first, second]);

    expect(executionOrder).toEqual([
      "first-started",
      "first-finished",
      "second-started",
      "second-finished",
    ]);
  });

  it("continues processing after an operation fails", async () => {
    const queue = new AsyncSerialQueue();

    const failed = queue.run(async () => {
      throw new Error("Operation failed");
    });

    const succeeded = queue.run(async () => "completed");

    await expect(failed).rejects.toThrow("Operation failed");
    await expect(succeeded).resolves.toBe("completed");
  });
});
