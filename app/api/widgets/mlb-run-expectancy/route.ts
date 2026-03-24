import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

const RE24 = {
  states: [
    { bases: "Empty",    outs0: 0.544, outs1: 0.291, outs2: 0.112, scorePct0: 0.279, scorePct1: 0.167, scorePct2: 0.067 },
    { bases: "1st",      outs0: 0.953, outs1: 0.573, outs2: 0.245, scorePct0: 0.451, scorePct1: 0.281, scorePct2: 0.133 },
    { bases: "2nd",      outs0: 1.189, outs1: 0.725, outs2: 0.344, scorePct0: 0.624, scorePct1: 0.415, scorePct2: 0.221 },
    { bases: "3rd",      outs0: 1.482, outs1: 0.983, outs2: 0.387, scorePct0: 0.850, scorePct1: 0.663, scorePct2: 0.257 },
    { bases: "1st+2nd",  outs0: 1.573, outs1: 0.971, outs2: 0.466, scorePct0: 0.643, scorePct1: 0.434, scorePct2: 0.234 },
    { bases: "1st+3rd",  outs0: 1.904, outs1: 1.243, outs2: 0.538, scorePct0: 0.853, scorePct1: 0.653, scorePct2: 0.299 },
    { bases: "2nd+3rd",  outs0: 2.052, outs1: 1.467, outs2: 0.634, scorePct0: 0.851, scorePct1: 0.680, scorePct2: 0.374 },
    { bases: "Loaded",   outs0: 2.417, outs1: 1.650, outs2: 0.815, scorePct0: 0.867, scorePct1: 0.671, scorePct2: 0.413 },
  ],
  source: "2015-2022 MLB average RE24 matrix (Tom Tango / Baseball Reference)",
};

export async function GET() {
  return NextResponse.json({
    data: { states: RE24.states, source: RE24.source },
    meta: {
      sourceUsed: "demo",
      updatedAt: new Date().toISOString(),
      requestId: randomUUID(),
    },
  });
}
