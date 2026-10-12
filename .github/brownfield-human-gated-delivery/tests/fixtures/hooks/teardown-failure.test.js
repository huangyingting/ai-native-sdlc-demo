afterEach(() => { throw new Error("Broken afterEach teardown"); });
test("expected behavior", () => { expect("actual").toBe("expected"); });
