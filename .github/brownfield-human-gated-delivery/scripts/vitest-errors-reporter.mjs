import { writeFileSync } from "node:fs";

// Vitest's JSON reporter omits these errors. Failed hooks emit a public
// onHookStart event but no onHookEnd; track unmatched starts independently of assertions.
export default class LifecycleErrorsReporter {
  activeHooks = new Map();

  onTestRunStart() {
    this.activeHooks.clear();
  }

  onHookStart({ name, entity }) {
    const key = `${entity.id}:${name}`;
    const hook = this.activeHooks.get(key) ?? { name, test: entity.fullName ?? entity.id, count: 0 };
    hook.count += 1;
    this.activeHooks.set(key, hook);
  }

  onHookEnd({ name, entity }) {
    const key = `${entity.id}:${name}`;
    const hook = this.activeHooks.get(key);
    if (!hook) throw new Error(`Hook completed without a start: ${key}`);
    hook.count -= 1;
    if (!hook.count) this.activeHooks.delete(key);
  }

  onTestRunEnd(modules, unhandledErrors, reason) {
    const suiteErrors = [];
    for (const module of modules) {
      for (const suite of [module, ...module.children.allSuites()]) {
        suiteErrors.push(...suite.errors().map((error) => error.message));
      }
    }
    writeFileSync(process.env.VITEST_ERRORS_REPORT, JSON.stringify({
      reason,
      unhandledErrors: unhandledErrors.map((error) => error.message),
      suiteErrors,
      hookErrors: [...this.activeHooks.values()],
    }));
  }
}
