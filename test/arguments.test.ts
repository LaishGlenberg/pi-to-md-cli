import assert from "node:assert/strict";
import test from "node:test";

import { ArgumentError, parseArguments, type ParsedArguments } from "../src/index.ts";

function base(overrides: Partial<ParsedArguments> = {}): ParsedArguments {
  return {
    input: null,
    output: null,
    mode: "all",
    leaf: null,
    noThinking: false,
    includeBash: false,
    timestamps: false,
    groupTurns: true,
    cut: null,
    time: { enabled: false, minutes: null },
    help: false,
    version: false,
    ...overrides,
  };
}

test("defaults with no arguments", () => {
  assert.deepEqual(parseArguments([]), base());
});

test("output supports detached, attached and equals forms", () => {
  assert.equal(parseArguments(["-o", "out.md"]).output, "out.md");
  assert.equal(parseArguments(["-oout.md"]).output, "out.md");
  assert.equal(parseArguments(["--output", "out.md"]).output, "out.md");
  assert.equal(parseArguments(["--output=out.md"]).output, "out.md");
  assert.equal(parseArguments(["-o", "-"]).output, "-");
});

test("converter flags are parsed", () => {
  const args = parseArguments([
    "--mode",
    "branch",
    "--leaf",
    "m1",
    "--no-thinking",
    "--include-bash",
    "--timestamps",
    "--no-group-turns",
  ]);
  assert.equal(args.mode, "branch");
  assert.equal(args.leaf, "m1");
  assert.equal(args.noThinking, true);
  assert.equal(args.includeBash, true);
  assert.equal(args.timestamps, true);
  assert.equal(args.groupTurns, false);
});

test("cut accepts detached, attached and equals forms", () => {
  assert.equal(parseArguments(["-c", "2"]).cut, 2);
  assert.equal(parseArguments(["-c2"]).cut, 2);
  assert.equal(parseArguments(["--cut", "3"]).cut, 3);
  assert.equal(parseArguments(["--cut=4"]).cut, 4);
  assert.throws(() => parseArguments(["-c", "x"]), ArgumentError);
});

test("time optionally consumes a numeric value", () => {
  assert.deepEqual(parseArguments(["-t"]).time, { enabled: true, minutes: null });
  assert.deepEqual(parseArguments(["-t", "15"]).time, { enabled: true, minutes: 15 });
  assert.deepEqual(parseArguments(["-t15"]).time, { enabled: true, minutes: 15 });
  assert.deepEqual(parseArguments(["--time=5"]).time, { enabled: true, minutes: 5 });

  const withFlag = parseArguments(["-t", "--no-thinking"]);
  assert.deepEqual(withFlag.time, { enabled: true, minutes: null });
  assert.equal(withFlag.noThinking, true);
});

test("positional input and -- terminator", () => {
  assert.equal(parseArguments(["session.jsonl"]).input, "session.jsonl");
  assert.equal(parseArguments(["--", "-weird.jsonl"]).input, "-weird.jsonl");
  assert.throws(() => parseArguments(["a.jsonl", "b.jsonl"]), ArgumentError);
});

test("invalid options and values are rejected", () => {
  assert.throws(() => parseArguments(["--nope"]), ArgumentError);
  assert.throws(() => parseArguments(["--mode", "sideways"]), ArgumentError);
});

test("help and version flags", () => {
  assert.equal(parseArguments(["--help"]).help, true);
  assert.equal(parseArguments(["-h"]).help, true);
  assert.equal(parseArguments(["--version"]).version, true);
  assert.equal(parseArguments(["-V"]).version, true);
});
