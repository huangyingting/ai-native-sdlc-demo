beforeEach(() => { throw new Error("Broken beforeEach setup"); });
test("expected behavior", () => { expect("actual").toBe("expected"); });
